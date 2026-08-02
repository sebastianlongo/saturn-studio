import { SwissEphemeris } from "@swisseph/browser";
import { Planet, LunarPoint, HouseSystem } from "@swisseph/core";
import { analyzeVitality, buildVitalityResult } from "./hyleg.js";
import { DONATION_LINKS } from "./donate-config.js";

const SIGN_NAMES = [
  "Aries",
  "Tauro",
  "Géminis",
  "Cáncer",
  "Leo",
  "Virgo",
  "Libra",
  "Escorpio",
  "Sagitario",
  "Capricornio",
  "Acuario",
  "Piscis",
];

/** Elemento por signo: 0 fuego, 1 tierra, 2 aire, 3 agua */
const SIGN_ELEMENTS = [
  "fire",
  "earth",
  "air",
  "water",
  "fire",
  "earth",
  "air",
  "water",
  "fire",
  "earth",
  "air",
  "water",
];

const CHART_BODIES = [
  { name: "Sol", body: Planet.Sun, glyph: "☉" },
  { name: "Luna", body: Planet.Moon, glyph: "☽" },
  { name: "Mercurio", body: Planet.Mercury, glyph: "☿" },
  { name: "Venus", body: Planet.Venus, glyph: "♀" },
  { name: "Marte", body: Planet.Mars, glyph: "♂" },
  { name: "Júpiter", body: Planet.Jupiter, glyph: "♃" },
  { name: "Saturno", body: Planet.Saturn, glyph: "♄" },
  { name: "Urano", body: Planet.Uranus, glyph: "♅" },
  { name: "Neptuno", body: Planet.Neptune, glyph: "♆" },
  { name: "Plutón", body: Planet.Pluto, glyph: "♇" },
  { name: "Lilith", body: LunarPoint.MeanApogee, glyph: "⚸" },
  { name: "Nodo Norte", body: LunarPoint.MeanNode, glyph: "☊" },
];

/** Fracciones del radio de la rueda (0–1). */
const WHEEL_SIGN_RADIUS_FRAC = 0.92;
const WHEEL_BODY_RADIUS_FRAC = 0.62;

const TRINE_ANGLE = 120;
const SEXTILE_ANGLE = 60;
const SQUARE_ANGLE = 90;
const OPPOSITION_ANGLE = 180;
const CONJUNCTION_ANGLE = 0;
const ASPECT_ORB = 5;

let swePromise = null;

function getSwe() {
  if (!swePromise) {
    swePromise = (async () => {
      const swe = new SwissEphemeris();
      await swe.init();
      return swe;
    })();
  }
  return swePromise;
}

function parseCoordinate(raw) {
  const normalized = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!normalized || normalized === "-" || normalized === "+") {
    return NaN;
  }
  return Number.parseFloat(normalized);
}

function normalizeLongitude(longitude) {
  return ((longitude % 360) + 360) % 360;
}

function getSignIndexFromLongitude(longitude) {
  return Math.floor(normalizeLongitude(longitude) / 30);
}

function getSignFromLongitude(longitude) {
  return SIGN_NAMES[getSignIndexFromLongitude(longitude)];
}

function formatDegreesInSign(longitude) {
  const inSign = normalizeLongitude(longitude) % 30;
  const deg = Math.floor(inSign);
  const min = Math.floor((inSign - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

function getHouseForLongitude(longitude, cusps) {
  const lon = normalizeLongitude(longitude);

  for (let house = 1; house <= 12; house++) {
    const cuspStart = normalizeLongitude(cusps[house]);
    const nextHouse = house === 12 ? 1 : house + 1;
    const cuspEnd = normalizeLongitude(cusps[nextHouse]);

    if (cuspStart <= cuspEnd) {
      if (lon >= cuspStart && lon < cuspEnd) {
        return house;
      }
    } else if (lon >= cuspStart || lon < cuspEnd) {
      return house;
    }
  }

  return 1;
}

/** Punto medio eclíptico entre dos cúspides (hacia adelante). */
function midLongitudeBetween(startLon, endLon) {
  const span = normalizeLongitude(endLon - startLon);
  return normalizeLongitude(startLon + span / 2);
}

const HOUSE_SYSTEM_OPTIONS = {
  equal: {
    id: "equal",
    label: "Iguales (12 × 30° desde el Asc.)",
    shortLabel: "iguales",
    swe: HouseSystem.Equal,
  },
  placidus: {
    id: "placidus",
    label: "Placidus",
    shortLabel: "Placidus",
    swe: HouseSystem.Placidus,
  },
};

function resolveHouseSystem(id) {
  return HOUSE_SYSTEM_OPTIONS[id] ?? HOUSE_SYSTEM_OPTIONS.equal;
}

function buildHouseCusps(ascendant, seCusps, systemId) {
  if (systemId === "placidus") {
    const cusps = [undefined];
    for (let house = 1; house <= 12; house++) {
      cusps[house] = normalizeLongitude(seCusps[house]);
    }
    return cusps;
  }
  return buildEqualHouseCusps(ascendant);
}

/**
 * Carta tradicional: Asc (este) a la izquierda; la longitud crece antihorario,
 * así la casa 1 queda bajo el horizonte.
 */
function longitudeToSvgRad(longitude, ascendant) {
  const rel = normalizeLongitude(longitude - ascendant);
  return ((180 - rel) * Math.PI) / 180;
}

/** Posición en % del anillo (centro = 50,50), radioFrac ∈ 0–1. */
function longitudeToPercentPos(longitude, ascendant, radiusFrac) {
  const rad = longitudeToSvgRad(longitude, ascendant);
  return {
    x: 50 + 50 * radiusFrac * Math.cos(rad),
    y: 50 + 50 * radiusFrac * Math.sin(rad),
  };
}

function buildEqualHouseCusps(ascendant) {
  const asc = normalizeLongitude(ascendant);
  const cusps = [undefined];
  for (let house = 1; house <= 12; house++) {
    cusps[house] = normalizeLongitude(asc + (house - 1) * 30);
  }
  return cusps;
}

/**
 * Punto árabe de la Fortuna (Pars Fortunae).
 * Diurno (Sol sobre el horizonte, casas 7–12): Asc + Luna − Sol
 * Nocturno (Sol bajo el horizonte, casas 1–6): Asc + Sol − Luna
 */
function calculatePartOfFortune(ascendant, sunLon, moonLon, sunHouse) {
  const isDayChart = sunHouse >= 7;
  const asc = normalizeLongitude(ascendant);
  const sun = normalizeLongitude(sunLon);
  const moon = normalizeLongitude(moonLon);
  const longitude = isDayChart
    ? normalizeLongitude(asc + moon - sun)
    : normalizeLongitude(asc + sun - moon);
  return {
    longitude,
    isDayChart,
    formula: isDayChart ? "Asc + Luna − Sol" : "Asc + Sol − Luna",
  };
}

/**
 * Punto árabe del Infortunio (Marte / Saturno).
 * Diurno: Asc + Marte − Saturno
 * Nocturno: Asc + Saturno − Marte
 */
function calculatePartOfInfortune(ascendant, marsLon, saturnLon, sunHouse) {
  const isDayChart = sunHouse >= 7;
  const asc = normalizeLongitude(ascendant);
  const mars = normalizeLongitude(marsLon);
  const saturn = normalizeLongitude(saturnLon);
  const longitude = isDayChart
    ? normalizeLongitude(asc + mars - saturn)
    : normalizeLongitude(asc + saturn - mars);
  return {
    longitude,
    isDayChart,
    formula: isDayChart ? "Asc + Marte − Saturno" : "Asc + Saturno − Marte",
  };
}

function makeBodyEntry(name, glyph, longitude, cusps, extra = {}) {
  return {
    name,
    glyph,
    longitude,
    sign: getSignFromLongitude(longitude),
    degreesInSign: formatDegreesInSign(longitude),
    house: getHouseForLongitude(longitude, cusps),
    ...extra,
  };
}

/** Arco más corto entre dos longitudes (0–180°). */
function shortestArcDegrees(lonA, lonB) {
  let d = Math.abs(normalizeLongitude(lonA) - normalizeLongitude(lonB));
  if (d > 180) d = 360 - d;
  return d;
}

function findAspects(bodies, angle, orb = ASPECT_ORB) {
  const aspects = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      // El eje nodal es siempre oposición; no listarlo como aspecto entre nodos.
      const names = new Set([bodies[i].name, bodies[j].name]);
      if (names.has("Nodo Norte") && names.has("Nodo Sur")) continue;

      const separation = shortestArcDegrees(bodies[i].longitude, bodies[j].longitude);
      const orbUsed = Math.abs(separation - angle);
      if (orbUsed <= orb) {
        aspects.push({
          a: bodies[i],
          b: bodies[j],
          separation,
          orb: orbUsed,
          angle,
        });
      }
    }
  }
  return aspects;
}

/** Regentes modernos por signo (0 Aries … 11 Piscis). */
const SIGN_RULERS = [
  "Marte",
  "Venus",
  "Mercurio",
  "Luna",
  "Sol",
  "Mercurio",
  "Venus",
  "Plutón",
  "Júpiter",
  "Saturno",
  "Urano",
  "Neptuno",
];

/** Domicilios modernos (un regente por signo externo). */
const DOMICILES = {
  Sol: [4],
  Luna: [3],
  Mercurio: [2, 5],
  Venus: [1, 6],
  Marte: [0],
  Júpiter: [8],
  Saturno: [9],
  Urano: [10],
  Neptuno: [11],
  Plutón: [7],
};

/** Exaltaciones tradicionales (+ modernas habituales para externos). */
const EXALTATIONS = {
  Sol: [0],
  Luna: [1],
  Mercurio: [5],
  Venus: [11],
  Marte: [9],
  Júpiter: [3],
  Saturno: [6],
  Urano: [7],
  Neptuno: [3],
  Plutón: [4],
};

const DOMINANT_PLANET_NAMES = [
  "Sol",
  "Luna",
  "Mercurio",
  "Venus",
  "Marte",
  "Júpiter",
  "Saturno",
  "Urano",
  "Neptuno",
  "Plutón",
];

const SCORE_HOUSE_ANGULAR = 5;
const SCORE_HOUSE_SUCCEDENT = 3;
const SCORE_HOUSE_CADENT = 1;
const SCORE_ASC_RULER = 6;
const SCORE_DOMICILE = 5;
const SCORE_EXALTATION = 4;
const SCORE_ASPECT_CONJ = 4;
const SCORE_ASPECT_HARD_SOFT = 2;
const SCORE_ASC_CONJ = 4;
const SCORE_ASC_TRINE = 2;
const SCORE_ASC_OPP = 2;

function houseStrengthPoints(house) {
  if ([1, 4, 7, 10].includes(house)) {
    return { points: SCORE_HOUSE_ANGULAR, label: `casa ${house} angular` };
  }
  if ([2, 5, 8, 11].includes(house)) {
    return { points: SCORE_HOUSE_SUCCEDENT, label: `casa ${house} sucedente` };
  }
  return { points: SCORE_HOUSE_CADENT, label: `casa ${house} cadente` };
}

function aspectToPoint(planetLon, pointLon, angle, score, label) {
  const sep = shortestArcDegrees(planetLon, pointLon);
  const orb = Math.abs(sep - angle);
  if (orb > ASPECT_ORB) return null;
  return {
    points: score,
    label: `${label} (orbe ${orb.toFixed(1)}°)`,
  };
}

function aspectToLuminary(planet, luminary, angle, score, label) {
  return aspectToPoint(
    planet.longitude,
    luminary.longitude,
    angle,
    score,
    `${label} ${luminary.name}`
  );
}

/**
 * Planeta dominante (método ponderado).
 * Casas + regente Asc + dignidades + aspectos a Sol/Luna.
 */
function scoreDominantPlanets(bodies, ascendant) {
  const planets = bodies.filter((b) => DOMINANT_PLANET_NAMES.includes(b.name));
  const sun = planets.find((b) => b.name === "Sol");
  const moon = planets.find((b) => b.name === "Luna");
  const ascSign = getSignIndexFromLongitude(ascendant);
  const ascRuler = SIGN_RULERS[ascSign];

  const scored = planets.map((planet) => {
    const reasons = [];
    let total = 0;

    const houseScore = houseStrengthPoints(planet.house);
    total += houseScore.points;
    reasons.push(houseScore);

    if (planet.name === ascRuler) {
      const r = {
        points: SCORE_ASC_RULER,
        label: `regente del Asc (${SIGN_NAMES[ascSign]})`,
      };
      total += r.points;
      reasons.push(r);
    }

    const signIndex = getSignIndexFromLongitude(planet.longitude);
    if (DOMICILES[planet.name]?.includes(signIndex)) {
      const r = { points: SCORE_DOMICILE, label: `domicilio en ${SIGN_NAMES[signIndex]}` };
      total += r.points;
      reasons.push(r);
    }
    if (EXALTATIONS[planet.name]?.includes(signIndex)) {
      const r = {
        points: SCORE_EXALTATION,
        label: `exaltación en ${SIGN_NAMES[signIndex]}`,
      };
      total += r.points;
      reasons.push(r);
    }

    for (const lum of [sun, moon]) {
      if (!lum || lum.name === planet.name) continue;
      const conj = aspectToLuminary(
        planet,
        lum,
        CONJUNCTION_ANGLE,
        SCORE_ASPECT_CONJ,
        "conjunción a"
      );
      if (conj) {
        total += conj.points;
        reasons.push(conj);
        continue;
      }
      const tri = aspectToLuminary(
        planet,
        lum,
        TRINE_ANGLE,
        SCORE_ASPECT_HARD_SOFT,
        "trígono a"
      );
      if (tri) {
        total += tri.points;
        reasons.push(tri);
        continue;
      }
      const sq = aspectToLuminary(
        planet,
        lum,
        SQUARE_ANGLE,
        SCORE_ASPECT_HARD_SOFT,
        "cuadratura a"
      );
      if (sq) {
        total += sq.points;
        reasons.push(sq);
        continue;
      }
      const opp = aspectToLuminary(
        planet,
        lum,
        OPPOSITION_ANGLE,
        SCORE_ASPECT_HARD_SOFT,
        "oposición a"
      );
      if (opp) {
        total += opp.points;
        reasons.push(opp);
      }
    }

    const ascConj = aspectToPoint(
      planet.longitude,
      ascendant,
      CONJUNCTION_ANGLE,
      SCORE_ASC_CONJ,
      "conjunción al Asc"
    );
    if (ascConj) {
      total += ascConj.points;
      reasons.push(ascConj);
    } else {
      const ascTri = aspectToPoint(
        planet.longitude,
        ascendant,
        TRINE_ANGLE,
        SCORE_ASC_TRINE,
        "trígono al Asc"
      );
      if (ascTri) {
        total += ascTri.points;
        reasons.push(ascTri);
      } else {
        const ascOpp = aspectToPoint(
          planet.longitude,
          ascendant,
          OPPOSITION_ANGLE,
          SCORE_ASC_OPP,
          "oposición al Asc"
        );
        if (ascOpp) {
          total += ascOpp.points;
          reasons.push(ascOpp);
        }
      }
      // Cuadratura al Asc: no suma ni resta (tensión ≠ menos dominancia)
    }

    return {
      name: planet.name,
      glyph: planet.glyph,
      sign: planet.sign,
      degreesInSign: planet.degreesInSign,
      house: planet.house,
      total,
      reasons,
    };
  });

  scored.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  const max = scored[0]?.total ?? 0;
  return {
    ranking: scored,
    dominant: scored.filter((p) => p.total === max),
    ascRuler,
    ascSignName: SIGN_NAMES[ascSign],
  };
}

function buildDominantResult(placeLabel, dateUtc, houses, bodies, localLabel, tzOffset, houseSystem) {
  const dateUtcStr = dateUtc.toISOString().replace(".000Z", "Z");
  const tzLabel = tzOffset === 0 ? "UTC±0" : `UTC${tzOffset > 0 ? "+" : ""}${tzOffset}`;
  const { ranking, dominant, ascRuler, ascSignName } = scoreDominantPlanets(
    bodies,
    houses.ascendant
  );
  const maxScore = ranking[0]?.total || 1;

  const winnerHtml = dominant
    .map(
      (p) => `
      <div class="dominant-winner">
        <span class="dominant-winner__glyph" aria-hidden="true">${p.glyph}</span>
        <div>
          <p class="dominant-winner__name">${p.name}</p>
          <p class="dominant-winner__meta">${p.sign} <span class="num">${p.degreesInSign}</span> · casa ${p.house} · <strong>${p.total} pts</strong></p>
        </div>
      </div>`
    )
    .join("");

  const reasonsHtml = dominant
    .map((p) => {
      const items = p.reasons
        .map((r) => `<li><span class="num">+${r.points}</span> ${r.label}</li>`)
        .join("");
      return `
        <div class="dominant-reasons">
          <h3 class="dominant-reasons__title">Por qué destaca ${p.name}</h3>
          <ul>${items}</ul>
        </div>`;
    })
    .join("");

  const rankRows = ranking
    .map((p, i) => {
      const pct = Math.round((p.total / maxScore) * 100);
      const isTop = p.total === ranking[0].total;
      return `
      <tr class="${isTop ? "data-table__dominant" : ""}">
        <td class="num">${i + 1}</td>
        <td>${p.glyph} ${p.name}</td>
        <td>${p.sign} <span class="num">${p.degreesInSign}</span></td>
        <td class="num">${p.house}</td>
        <td>
          <div class="score-bar" title="${p.total} pts">
            <div class="score-bar__fill" style="width:${pct}%"></div>
            <span class="score-bar__label num">${p.total}</span>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const tieNote =
    dominant.length > 1
      ? `<p class="cusps-note">Empate: ${dominant.map((p) => p.name).join(" y ")} comparten la mayor puntuación.</p>`
      : "";

  return `
    <div class="result-block">
      <h2 class="result-heading">Datos</h2>
      <dl class="meta-list">
        <dt>Lugar</dt><dd>${placeLabel}</dd>
        <dt>Hora local</dt><dd>${localLabel} (${tzLabel})</dd>
        <dt>Equivalente UTC</dt><dd>${dateUtcStr}</dd>
        <dt>Sistema de casas</dt><dd>${houseSystem.label}</dd>
        <dt>Ascendente</dt><dd>${ascSignName} · regente ${ascRuler}</dd>
      </dl>
    </div>
    <div class="result-block">
      <h2 class="result-heading">Planeta dominante</h2>
      ${winnerHtml}
      ${tieNote}
      ${reasonsHtml}
    </div>
    <div class="result-block">
      <h2 class="result-heading">Ranking</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Planeta</th><th>Signo</th><th>Casa</th><th>Puntos</th></tr>
          </thead>
          <tbody>
            ${rankRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function polar(cx, cy, r, rad) {
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Sector anular (territorio de un signo) entre dos longitudes eclípticas. */
function annularSectorPath(cx, cy, rInner, rOuter, lonStart, lonEnd, ascendant) {
  const a0 = longitudeToSvgRad(lonStart, ascendant);
  const a1 = longitudeToSvgRad(lonEnd, ascendant);
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  // Relación angular corta (~30°): sweep según sentido de a0→a1 en SVG
  let delta = a1 - a0;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const sweep = delta >= 0 ? 1 : 0;
  const large = Math.abs(delta) > Math.PI ? 1 : 0;
  return [
    `M ${p0o.x.toFixed(2)} ${p0o.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} ${sweep} ${p1o.x.toFixed(2)} ${p1o.y.toFixed(2)}`,
    `L ${p1i.x.toFixed(2)} ${p1i.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} ${sweep ^ 1} ${p0i.x.toFixed(2)} ${p0i.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function buildWheelSvg(cusps, ascendant, activeSignIndex, bodies = []) {
  const cx = 100;
  const cy = 100;
  const rOuter = 99;
  const rZodiacInner = 84;
  const rHouseOuter = rZodiacInner;
  const rInner = 8;
  const rAspect = 100 * WHEEL_BODY_RADIUS_FRAC;

  const zodiacSectors = [];
  const zodiacDividers = [];
  for (let i = 0; i < 12; i++) {
    const lon0 = i * 30;
    const lon1 = lon0 + 30;
    const element = SIGN_ELEMENTS[i];
    const active = i === activeSignIndex ? " sun-wheel__zodiac-sector--active" : "";
    zodiacSectors.push(
      `<path class="sun-wheel__zodiac-sector sun-wheel__zodiac-sector--${element}${active}" d="${annularSectorPath(cx, cy, rZodiacInner, rOuter, lon0, lon1, ascendant)}" />`
    );
    const rad = longitudeToSvgRad(lon0, ascendant);
    const a = polar(cx, cy, rZodiacInner, rad);
    const b = polar(cx, cy, rOuter, rad);
    zodiacDividers.push(
      `<line class="sun-wheel__zodiac-divider" x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" />`
    );
  }

  const houseLines = [];
  const houseLabels = [];
  for (let house = 1; house <= 12; house++) {
    const cuspLon = cusps[house];
    const rad = longitudeToSvgRad(cuspLon, ascendant);
    const a = polar(cx, cy, rInner, rad);
    const b = polar(cx, cy, rHouseOuter, rad);
    const isHorizon = house === 1 || house === 7;
    const isMeridian = house === 4 || house === 10;
    const cls = isHorizon || isMeridian ? ' class="sun-wheel__axis"' : "";
    houseLines.push(
      `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}"${cls} />`
    );

    const midLon = midLongitudeBetween(cuspLon, cusps[house === 12 ? 1 : house + 1]);
    const midRad = longitudeToSvgRad(midLon, ascendant);
    const rLabel = (rInner + rHouseOuter) * 0.42;
    const lp = polar(cx, cy, rLabel, midRad);
    houseLabels.push(
      `<text x="${lp.x.toFixed(2)}" y="${lp.y.toFixed(2)}" class="sun-wheel__house-num">${house}</text>`
    );
  }

  const trines = findAspects(bodies, TRINE_ANGLE, ASPECT_ORB);
  const sextiles = findAspects(bodies, SEXTILE_ANGLE, ASPECT_ORB);
  const squares = findAspects(bodies, SQUARE_ANGLE, ASPECT_ORB);
  const oppositions = findAspects(bodies, OPPOSITION_ANGLE, ASPECT_ORB);
  const conjunctions = findAspects(bodies, CONJUNCTION_ANGLE, ASPECT_ORB);
  const aspectLines = [
    ...trines.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--trine" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
    }),
    ...sextiles.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--sextile" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
    }),
    ...squares.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--square" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
    }),
    ...oppositions.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--opposition" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
    }),
    ...conjunctions.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--conjunction" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
    }),
  ];

  const horizon = `<line x1="${(cx - rHouseOuter).toFixed(2)}" y1="${cy}" x2="${(cx + rHouseOuter).toFixed(2)}" y2="${cy}" class="sun-wheel__horizon" />`;
  const meridian = `<line x1="${cx}" y1="${(cy - rHouseOuter).toFixed(2)}" x2="${cx}" y2="${(cy + rHouseOuter).toFixed(2)}" class="sun-wheel__meridian" />`;
  const eastLabel = `<text x="${(cx - rOuter + 6).toFixed(2)}" y="${(cy + 3.5).toFixed(2)}" class="sun-wheel__cardinal">E</text>`;
  const westLabel = `<text x="${(cx + rOuter - 6).toFixed(2)}" y="${(cy + 3.5).toFixed(2)}" class="sun-wheel__cardinal">O</text>`;

  return `
    <svg class="sun-wheel__houses" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${rZodiacInner}" class="sun-wheel__zodiac-inner" />
      <g class="sun-wheel__zodiac">${zodiacSectors.join("")}${zodiacDividers.join("")}</g>
      ${horizon}
      ${meridian}
      ${houseLines.join("")}
      <g class="sun-wheel__aspects">${aspectLines.join("")}</g>
      ${houseLabels.join("")}
      ${eastLabel}
      ${westLabel}
    </svg>
  `;
}

function buildAspectList(aspects, title, modClass, orb = ASPECT_ORB) {
  if (!aspects.length) {
    return `<p class="aspect-list aspect-list--empty aspect-list--${modClass}">No hay ${title.toLowerCase()} con orbe ≤ ${orb}°.</p>`;
  }
  const items = aspects
    .map((t) => {
      const orbStr = t.orb.toFixed(1).replace(".", ",");
      return `<li><span class="aspect-list__mark" aria-hidden="true"></span>${t.a.glyph} ${t.a.name} — ${t.b.glyph} ${t.b.name} <span class="num">Δ ${orbStr}°</span></li>`;
    })
    .join("");
  return `
    <div class="aspect-list aspect-list--${modClass}">
      <h3 class="aspect-list__title">${title} <span class="aspect-list__orb">orbe ≤ ${orb}°</span></h3>
      <ul>${items}</ul>
    </div>
  `;
}

function buildSunWheel(signIndex, bodies, cusps, ascendant) {
  const signs = SIGN_NAMES.map((name, i) => {
    const { x, y } = longitudeToPercentPos(i * 30 + 15, ascendant, WHEEL_SIGN_RADIUS_FRAC);
    const element = SIGN_ELEMENTS[i];
    const activeClass = i === signIndex ? " sun-wheel__sign--active" : "";
    return `
      <div class="sun-wheel__sign sun-wheel__sign--${element}${activeClass}" style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%;">
        <span>${name}</span>
      </div>
    `;
  }).join("");

  const sortedBodies = [...bodies].sort((a, b) => a.longitude - b.longitude);
  const bodyItems = sortedBodies
    .map((b) => {
      const { x, y } = longitudeToPercentPos(b.longitude, ascendant, WHEEL_BODY_RADIUS_FRAC);
      const sunClass = b.name === "Sol" ? " sun-wheel__body--sun" : "";
      const lotClass = b.kind === "lot" ? " sun-wheel__body--lot" : "";
      const tip =
        b.kind === "lot"
          ? `${b.name} (${b.formula}) — ${b.sign} ${b.degreesInSign}, casa ${b.house}`
          : `${b.name} — ${b.sign} ${b.degreesInSign}, casa ${b.house}`;
      return `
      <div class="sun-wheel__body${sunClass}${lotClass}" style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%;" title="${tip}">
        <span>${b.glyph}</span>
      </div>
    `;
    })
    .join("");

  const trines = findAspects(bodies, TRINE_ANGLE, ASPECT_ORB);
  const sextiles = findAspects(bodies, SEXTILE_ANGLE, ASPECT_ORB);
  const squares = findAspects(bodies, SQUARE_ANGLE, ASPECT_ORB);
  const oppositions = findAspects(bodies, OPPOSITION_ANGLE, ASPECT_ORB);
  const conjunctions = findAspects(bodies, CONJUNCTION_ANGLE, ASPECT_ORB);

  return `
    <div class="sun-wheel">
      <div class="sun-wheel__ring">
        ${buildWheelSvg(cusps, ascendant, signIndex, bodies)}
        ${signs}
        ${bodyItems}
      </div>
    </div>
    ${buildAspectList(trines, "Trígono", "trine")}
    ${buildAspectList(sextiles, "Sextil", "sextile")}
    ${buildAspectList(squares, "Cuadratura", "square")}
    ${buildAspectList(oppositions, "Oposición", "opposition")}
    ${buildAspectList(conjunctions, "Conjunción", "conjunction")}
  `;
}

function buildAnglesAndCuspsSection(houses) {
  const asc = normalizeLongitude(houses.ascendant);
  const mc = normalizeLongitude(houses.mc);
  const dsc = normalizeLongitude(asc + 180);
  const ic = normalizeLongitude(mc + 180);

  const angleRows = [
    ["Ascendente (Asc)", asc],
    ["Medio cielo (MC)", mc],
    ["Descendente (Dsc)", dsc],
    ["Fondo del cielo (IC)", ic],
  ]
    .map(
      ([label, lon]) => `
      <tr>
        <td>${label}</td>
        <td>${getSignFromLongitude(lon)}</td>
        <td class="num">${formatDegreesInSign(lon)}</td>
        <td class="num">${lon.toFixed(2)}°</td>
      </tr>`
    )
    .join("");

  const cuspRows = Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    const lon = normalizeLongitude(houses.cusps[house]);
    const tag =
      house === 1 ? " · Asc" : house === 7 ? " · Dsc" : house === 10 ? " · MC*" : house === 4 ? " · IC*" : "";
    return `
      <tr>
        <td>Casa ${house}${tag}</td>
        <td>${getSignFromLongitude(lon)}</td>
        <td class="num">${formatDegreesInSign(lon)}</td>
        <td class="num">${lon.toFixed(2)}°</td>
      </tr>`;
  }).join("");

  return `
    <div class="result-block">
      <h2 class="result-heading">Ángulos y cúspides</h2>
      <p class="cusps-lead">Grados de Ascendente, Medio cielo, Descendente e IC, y cúspide de cada casa.</p>
      <div class="table-wrap">
        <table class="data-table data-table--cusps">
          <thead>
            <tr><th>Ángulo</th><th>Signo</th><th>Grado</th><th>Longitud</th></tr>
          </thead>
          <tbody>
            ${angleRows}
          </tbody>
        </table>
      </div>
      <div class="table-wrap" style="margin-top: 1rem;">
        <table class="data-table data-table--cusps">
          <thead>
            <tr><th>Cúspide</th><th>Signo</th><th>Grado</th><th>Longitud</th></tr>
          </thead>
          <tbody>
            ${cuspRows}
          </tbody>
        </table>
      </div>
      <p class="cusps-note">* En casas iguales, la cúspide 10/4 no coincide necesariamente con el MC/IC real (el MC flota).</p>
    </div>
  `;
}

function buildChartResult(placeLabel, dateUtc, houses, bodies, localLabel, tzOffset, houseSystem) {
  const dateUtcStr = dateUtc.toISOString().replace(".000Z", "Z");
  const sun = bodies.find((b) => b.name === "Sol");
  const fortune = bodies.find((b) => b.name === "Fortuna");
  const infortune = bodies.find((b) => b.name === "Infortunio");
  const signIndex = getSignIndexFromLongitude(sun.longitude);
  const tzLabel = tzOffset === 0 ? "UTC±0" : `UTC${tzOffset > 0 ? "+" : ""}${tzOffset}`;
  const sectLabel = fortune?.isDayChart ? "diurna" : "nocturna";

  const rows = bodies
    .map(
      (b) => `
      <tr${b.kind === "lot" ? ' class="data-table__lot"' : ""}>
        <td>${b.glyph} ${b.name}</td>
        <td>${b.sign} <span class="num">${b.degreesInSign}</span></td>
        <td class="num">${b.house}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="result-block">
      <h2 class="result-heading">Datos</h2>
      <dl class="meta-list">
        <dt>Lugar</dt><dd>${placeLabel}</dd>
        <dt>Hora local</dt><dd>${localLabel} (${tzLabel})</dd>
        <dt>Equivalente UTC</dt><dd>${dateUtcStr}</dd>
        <dt>Sistema de casas</dt><dd>${houseSystem.label}</dd>
        <dt>P. Fortuna</dt><dd>${fortune.sign} <span class="num">${fortune.degreesInSign}</span> · casa ${fortune.house} <span class="meta-note">(${sectLabel}: ${fortune.formula})</span></dd>
        <dt>P. Infortunio</dt><dd>${infortune.sign} <span class="num">${infortune.degreesInSign}</span> · casa ${infortune.house} <span class="meta-note">(${sectLabel}: ${infortune.formula})</span></dd>
      </dl>
    </div>
    ${buildAnglesAndCuspsSection(houses)}
    <div class="result-block">
      <h2 class="result-heading">Carta natal</h2>
      ${buildSunWheel(signIndex, bodies, houses.cusps, houses.ascendant)}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Cuerpo / punto</th><th>Signo</th><th>Casa</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function calculateChart(dateUtc, lat, lon, houseSystem) {
  const swe = await getSwe();
  const jd = swe.dateToJulianDay(dateUtc);
  const angles = swe.calculateHouses(jd, lat, lon, houseSystem.swe);
  const cusps = buildHouseCusps(angles.ascendant, angles.cusps, houseSystem.id);
  const houses = {
    ...angles,
    cusps,
  };

  const bodies = CHART_BODIES.map(({ name, body, glyph }) => {
    const position = swe.calculatePosition(jd, body);
    return makeBodyEntry(name, glyph, position.longitude, houses.cusps);
  });

  const northNode = bodies.find((b) => b.name === "Nodo Norte");
  if (northNode) {
    bodies.push(
      makeBodyEntry(
        "Nodo Sur",
        "☋",
        normalizeLongitude(northNode.longitude + 180),
        houses.cusps
      )
    );
  }

  const sun = bodies.find((b) => b.name === "Sol");
  const moon = bodies.find((b) => b.name === "Luna");
  const mars = bodies.find((b) => b.name === "Marte");
  const saturn = bodies.find((b) => b.name === "Saturno");
  const fortune = calculatePartOfFortune(
    houses.ascendant,
    sun.longitude,
    moon.longitude,
    sun.house
  );
  const infortune = calculatePartOfInfortune(
    houses.ascendant,
    mars.longitude,
    saturn.longitude,
    sun.house
  );
  bodies.push(
    makeBodyEntry("Fortuna", "⊕", fortune.longitude, houses.cusps, {
      kind: "lot",
      formula: fortune.formula,
      isDayChart: fortune.isDayChart,
    }),
    makeBodyEntry("Infortunio", "⊖", infortune.longitude, houses.cusps, {
      kind: "lot",
      formula: infortune.formula,
      isDayChart: infortune.isDayChart,
    })
  );

  return { houses, bodies, fortune, infortune };
}

function readBirthFormFields(ids) {
  const dateStr = document.getElementById(ids.date).value;
  const timeStr = document.getElementById(ids.time).value;
  const tzOffset = Number(document.getElementById(ids.tz).value);
  const houseSystem = resolveHouseSystem(document.getElementById(ids.house).value);
  const placeName = document.getElementById(ids.place).value.trim();
  const lat = parseCoordinate(document.getElementById(ids.lat).value);
  const lon = parseCoordinate(document.getElementById(ids.lon).value);
  return { dateStr, timeStr, tzOffset, houseSystem, placeName, lat, lon };
}

function validateBirthInput({ dateStr, timeStr, lat, lon, tzOffset }) {
  if (!dateStr || !timeStr) return "Indica fecha y hora local.";
  if (Number.isNaN(lat) || lat < -90 || lat > 90) return "La latitud debe estar entre −90 y 90.";
  if (Number.isNaN(lon) || lon < -180 || lon > 180) {
    return "La longitud debe estar entre −180 y 180.";
  }
  if (Number.isNaN(tzOffset)) return "Elige un huso horario.";
  return null;
}

function birthInputToUtc({ dateStr, timeStr, tzOffset, placeName, lat, lon }) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":");
  const hh = Number(timeParts[0] ?? 0);
  const mm = Number(timeParts[1] ?? 0);
  const ss = Number(timeParts[2] ?? 0);
  const dateUtc = new Date(Date.UTC(y, mo - 1, d, hh - tzOffset, mm, ss));
  const localLabel = `${dateStr} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const placeLabel = placeName || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  return { dateUtc, localLabel, placeLabel };
}

function wireBirthTool({ form, output, empty, error, fieldIds, buildResult }) {
  const submitBtn = form?.querySelector('button[type="submit"]');
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    error.textContent = "";
    empty.hidden = true;
    output.innerHTML = "";
    output.hidden = true;

    const input = readBirthFormFields(fieldIds);
    const validationError = validateBirthInput(input);
    if (validationError) {
      error.textContent = validationError;
      error.hidden = false;
      empty.hidden = false;
      return;
    }

    const { dateUtc, localLabel, placeLabel } = birthInputToUtc(input);
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");

    try {
      const { houses, bodies } = await calculateChart(
        dateUtc,
        input.lat,
        input.lon,
        input.houseSystem
      );
      output.innerHTML = await buildResult(
        placeLabel,
        dateUtc,
        houses,
        bodies,
        localLabel,
        input.tzOffset,
        input.houseSystem
      );
      output.hidden = false;
    } catch (err) {
      console.error(err);
      error.textContent =
        err instanceof Error ? err.message : "Error al calcular.";
      error.hidden = false;
      empty.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }
  });
}

wireBirthTool({
  form: document.getElementById("birth-form"),
  output: document.getElementById("chart-output"),
  empty: document.getElementById("chart-empty"),
  error: document.getElementById("chart-error"),
  fieldIds: {
    date: "birth-date",
    time: "birth-time",
    tz: "tz-offset",
    house: "house-system",
    place: "place-name",
    lat: "lat",
    lon: "lon",
  },
  buildResult: buildChartResult,
});

wireBirthTool({
  form: document.getElementById("dominant-form"),
  output: document.getElementById("dominant-output"),
  empty: document.getElementById("dominant-empty"),
  error: document.getElementById("dominant-error"),
  fieldIds: {
    date: "dom-birth-date",
    time: "dom-birth-time",
    tz: "dom-tz-offset",
    house: "dom-house-system",
    place: "dom-place-name",
    lat: "dom-lat",
    lon: "dom-lon",
  },
  buildResult: buildDominantResult,
});

wireBirthTool({
  form: document.getElementById("vitality-form"),
  output: document.getElementById("vitality-output"),
  empty: document.getElementById("vitality-empty"),
  error: document.getElementById("vitality-error"),
  fieldIds: {
    date: "vit-birth-date",
    time: "vit-birth-time",
    tz: "vit-tz-offset",
    house: "vit-house-system",
    place: "vit-place-name",
    lat: "vit-lat",
    lon: "vit-lon",
  },
  buildResult: async (placeLabel, dateUtc, houses, bodies, localLabel, tzOffset, houseSystem) => {
    const swe = await getSwe();
    const jd = swe.dateToJulianDay(dateUtc);
    const analysis = await analyzeVitality(swe, jd, houses, bodies);
    return buildVitalityResult(
      placeLabel,
      dateUtc,
      houses,
      bodies,
      localLabel,
      tzOffset,
      houseSystem,
      analysis
    );
  },
});

function wireDonations() {
  const actions = document.getElementById("donate-actions");
  const hint = document.getElementById("donate-hint");
  if (!actions) return;

  const buttons = [];
  if (DONATION_LINKS.mercadopago) {
    buttons.push(
      `<a class="btn-primary" href="${DONATION_LINKS.mercadopago}" target="_blank" rel="noopener noreferrer">Donar con Mercado Pago</a>`
    );
  }
  if (DONATION_LINKS.paypal) {
    buttons.push(
      `<a class="btn-secondary" href="${DONATION_LINKS.paypal}" target="_blank" rel="noopener noreferrer">Donar con PayPal</a>`
    );
  }

  if (buttons.length) {
    actions.innerHTML = buttons.join("");
    if (hint) hint.hidden = true;
  } else {
    actions.innerHTML = "";
    if (hint) {
      hint.hidden = false;
      hint.textContent =
        "Falta configurar el link de donación. Creá un link en Mercado Pago o PayPal y pegalo en src/donate-config.js.";
    }
  }
}

wireDonations();
