import { SwissEphemeris } from "@swisseph/browser";
import {
  Asteroid,
  CalculationFlag,
  Planet,
  LunarPoint,
  HouseSystem,
} from "@swisseph/core";
import { analyzeVitality, buildVitalityResult } from "./hyleg.js";
import { findRegion, getCountryRegions, getRegionLabel, resolveImplicitUtcOffset } from "./location-regions.js";

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

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map(
  (g) => `${g}\uFE0E`
);

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
  { name: "Kiron", body: Asteroid.Chiron, glyph: "⚷", useSwiss: true },
  { name: "Nodo Norte", body: LunarPoint.MeanNode, glyph: "☊", displayName: "Nodo N (m)" },
  { name: "Lilith", body: LunarPoint.MeanApogee, glyph: "⚸", displayName: "Lilith (m)" },
];

/** Puntos que el usuario puede mostrar u ocultar en rueda, tabla y aspectos. */
const DISPLAYABLE_BODIES = [
  { id: "Sol", label: "Sol", glyph: "☉", group: "astro" },
  { id: "Luna", label: "Luna", glyph: "☽", group: "astro" },
  { id: "Mercurio", label: "Mercurio", glyph: "☿", group: "astro" },
  { id: "Venus", label: "Venus", glyph: "♀", group: "astro" },
  { id: "Marte", label: "Marte", glyph: "♂", group: "astro" },
  { id: "Júpiter", label: "Júpiter", glyph: "♃", group: "astro" },
  { id: "Saturno", label: "Saturno", glyph: "♄", group: "astro" },
  { id: "Urano", label: "Urano", glyph: "♅", group: "astro" },
  { id: "Neptuno", label: "Neptuno", glyph: "♆", group: "astro" },
  { id: "Plutón", label: "Plutón", glyph: "♇", group: "astro" },
  { id: "Kiron", label: "Kiron", glyph: "⚷", group: "astro" },
  { id: "Nodo Norte", label: "Nodo Norte", glyph: "☊", group: "astro" },
  { id: "Nodo Sur", label: "Nodo Sur", glyph: "☋", group: "astro" },
  { id: "Lilith", label: "Lilith", glyph: "⚸", group: "astro" },
  { id: "Fortuna", label: "Fortuna", glyph: "⊕", group: "lot" },
  { id: "Infortunio", label: "Infortunio", glyph: "⊖", group: "lot" },
];

const CLASSIC_BODY_IDS = ["Sol", "Luna", "Mercurio", "Venus", "Marte", "Júpiter", "Saturno"];
const LOT_BODY_IDS = DISPLAYABLE_BODIES.filter((b) => b.group === "lot").map((b) => b.id);
const VISIBLE_BODIES_STORAGE_KEY = "saturn-visible-bodies";

/** Fracciones del radio de la rueda (0–1). */
const WHEEL_SIGN_RADIUS_FRAC = 0.915;
const WHEEL_BODY_RADIUS_FRAC = 0.62;

const TRINE_ANGLE = 120;
const SEXTILE_ANGLE = 60;
const SEMISEXTILE_ANGLE = 30;
const SQUARE_ANGLE = 90;
const QUINCUNX_ANGLE = 150;
const OPPOSITION_ANGLE = 180;
const CONJUNCTION_ANGLE = 0;
const ASPECT_ORB = 5;
const QUINCUNX_ORB = 3;
/** Orbe máximo para aspectos que involucran puntos matemáticos. */
const POINT_ASPECT_ORB = 3;
/** Orbe máximo para aspectos que involucran Kiron (Quirón). */
const CHIRON_ASPECT_ORB = 3;
/** Orbes recomendados para aspectos a ángulos (Asc / MC). */
const ANGLE_ASPECT_ORB = {
  [CONJUNCTION_ANGLE]: 6,
  [OPPOSITION_ANGLE]: 6,
  [SQUARE_ANGLE]: 5,
  [TRINE_ANGLE]: 5,
  [SEXTILE_ANGLE]: 4,
  [SEMISEXTILE_ANGLE]: 2,
  [QUINCUNX_ANGLE]: 2,
};

const MATHEMATICAL_POINT_NAMES = new Set([
  "Lilith",
  "Fortuna",
  "Infortunio",
  "Nodo Norte",
  "Nodo Sur",
]);

let swePromise = null;
let lastNatalChart = null;
let visibleBodyIds = loadVisibleBodyIds();

function loadVisibleBodyIds() {
  const fallback = new Set(DISPLAYABLE_BODIES.map((b) => b.id));
  try {
    const raw = localStorage.getItem(VISIBLE_BODIES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const allowed = new Set(DISPLAYABLE_BODIES.map((b) => b.id));
    const next = new Set(parsed.filter((id) => allowed.has(id)));
    return next;
  } catch {
    return fallback;
  }
}

function saveVisibleBodyIds() {
  try {
    localStorage.setItem(VISIBLE_BODIES_STORAGE_KEY, JSON.stringify([...visibleBodyIds]));
  } catch {
    /* ignore quota / private mode */
  }
}

function filterVisibleBodies(bodies) {
  return bodies.filter((b) => visibleBodyIds.has(b.name));
}

function bodyVisibilityCheckbox(item, idPrefix) {
  const inputId = `${idPrefix}-${item.id.replace(/\s+/g, "-").toLowerCase()}`;
  const checked = visibleBodyIds.has(item.id) ? " checked" : "";
  return `
    <label class="body-visibility__option" for="${inputId}">
      <input type="checkbox" id="${inputId}" name="${idPrefix}-body" value="${item.id}"${checked} />
      <span class="body-visibility__glyph" aria-hidden="true">${item.glyph}\uFE0E</span>
      <span>${item.label}</span>
    </label>`;
}

function buildBodyVisibilityGroupsHtml(idPrefix) {
  const astros = DISPLAYABLE_BODIES.filter((b) => b.group === "astro");
  const lots = DISPLAYABLE_BODIES.filter((b) => b.group === "lot");
  return `
    <div class="body-visibility__group">
      <h3 class="body-visibility__group-title">Astros</h3>
      <div class="body-visibility__grid">
        ${astros.map((item) => bodyVisibilityCheckbox(item, idPrefix)).join("")}
      </div>
    </div>
    <div class="body-visibility__group">
      <h3 class="body-visibility__group-title">Partes arábicas</h3>
      <div class="body-visibility__grid">
        ${lots.map((item) => bodyVisibilityCheckbox(item, idPrefix)).join("")}
      </div>
    </div>
  `;
}

function applyVisibilityAction(action) {
  if (action === "all") {
    visibleBodyIds = new Set(DISPLAYABLE_BODIES.map((b) => b.id));
  } else if (action === "none") {
    visibleBodyIds = new Set();
  } else if (action === "classics") {
    visibleBodyIds = new Set(CLASSIC_BODY_IDS);
  } else if (action === "lots") {
    visibleBodyIds = new Set(LOT_BODY_IDS);
  } else {
    return;
  }
  saveVisibleBodyIds();
  syncBodyVisibilityCheckboxes();
  rerenderNatalChart();
}

function syncBodyVisibilityCheckboxes() {
  document.querySelectorAll(".body-visibility input[type='checkbox']").forEach((input) => {
    input.checked = visibleBodyIds.has(input.value);
  });
}

function rerenderNatalChart() {
  if (!lastNatalChart) return;
  const output = document.getElementById("chart-output");
  if (!output || output.hidden) return;
  const {
    placeLabel,
    dateUtc,
    houses,
    bodies,
    localLabel,
    tzOffset,
    houseSystem,
  } = lastNatalChart;
  output.innerHTML = buildChartResult(
    placeLabel,
    dateUtc,
    houses,
    bodies,
    localLabel,
    tzOffset,
    houseSystem
  );
}

function getSwe() {
  if (!swePromise) {
    swePromise = (async () => {
      const swe = new SwissEphemeris();
      await swe.init();
      // Kiron (y otros asteroides) requieren seas_*.se1; Moshier no los incluye.
      await swe.loadStandardEphemeris();
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

function formatDegreesPrecise(longitude) {
  const inSign = normalizeLongitude(longitude) % 30;
  let totalSec = Math.round(inSign * 3600);
  if (totalSec >= 30 * 3600) totalSec = 30 * 3600 - 1;
  const deg = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  return `${deg}°${String(min).padStart(2, "0")}'${String(sec).padStart(2, "0")}"`;
}

function formatZodiacPosition(longitude) {
  const si = getSignIndexFromLongitude(longitude);
  return `<span class="zodiac-glyph" aria-hidden="true">${SIGN_GLYPHS[si]}</span><span class="zodiac-name">${SIGN_NAMES[si]}</span> <span class="num">${formatDegreesPrecise(longitude)}</span>`;
}

function bodyLabel(body) {
  return body.displayName || body.name;
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
  return HOUSE_SYSTEM_OPTIONS[id] ?? HOUSE_SYSTEM_OPTIONS.placidus;
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
  const longitudeSpeed = extra.longitudeSpeed ?? 0;
  return {
    name,
    glyph,
    longitude,
    longitudeSpeed,
    retrograde: longitudeSpeed < 0,
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

function isMathematicalPoint(body) {
  return MATHEMATICAL_POINT_NAMES.has(body.name) || body.kind === "lot";
}

function isChiron(body) {
  return body.name === "Kiron";
}

function isChartAngle(body) {
  return body.kind === "angle";
}

/** Cuerpos + Asc/MC para aspectos (no se muestran en la tabla de planetas). */
function withAnglesForAspects(bodies, { ascendant, mc, cusps }) {
  const ascLon = normalizeLongitude(ascendant);
  const mcLon = normalizeLongitude(
    Number.isFinite(mc) ? mc : cusps?.[10]
  );
  return [
    ...bodies,
    makeBodyEntry("Ascendente", "Asc", ascLon, cusps, { kind: "angle" }),
    makeBodyEntry("Medio cielo", "MC", mcLon, cusps, { kind: "angle" }),
  ];
}

/** Orbe efectivo: Kiron ≤ 3°; ángulos (Asc/MC) tienen pautas propias; puntos matemáticos ≤ 3°. */
function aspectOrbForPair(a, b, angle, defaultOrb) {
  if (isChiron(a) || isChiron(b)) {
    return Math.min(defaultOrb, CHIRON_ASPECT_ORB);
  }
  if (isChartAngle(a) || isChartAngle(b)) {
    return ANGLE_ASPECT_ORB[angle] ?? defaultOrb;
  }
  if (isMathematicalPoint(a) || isMathematicalPoint(b)) {
    return Math.min(defaultOrb, POINT_ASPECT_ORB);
  }
  return defaultOrb;
}

function findAspects(bodies, angle, orb = ASPECT_ORB) {
  const aspects = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      // El eje nodal es siempre oposición; no listarlo como aspecto entre nodos.
      const names = new Set([bodies[i].name, bodies[j].name]);
      if (names.has("Nodo Norte") && names.has("Nodo Sur")) continue;
      // No listar aspectos entre ángulos (Asc–MC suele ser ~cuadratura).
      if (isChartAngle(bodies[i]) && isChartAngle(bodies[j])) continue;
      // Semisextil solo para aspectos a Asc/MC.
      if (
        angle === SEMISEXTILE_ANGLE &&
        !isChartAngle(bodies[i]) &&
        !isChartAngle(bodies[j])
      ) {
        continue;
      }

      const separation = shortestArcDegrees(bodies[i].longitude, bodies[j].longitude);
      const orbUsed = Math.abs(separation - angle);
      const maxOrb = aspectOrbForPair(bodies[i], bodies[j], angle, orb);
      if (orbUsed <= maxOrb) {
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

function collectAspectGroups(aspectBodies) {
  return {
    trines: findAspects(aspectBodies, TRINE_ANGLE, ASPECT_ORB),
    sextiles: findAspects(aspectBodies, SEXTILE_ANGLE, ASPECT_ORB),
    semisextiles: findAspects(
      aspectBodies,
      SEMISEXTILE_ANGLE,
      ANGLE_ASPECT_ORB[SEMISEXTILE_ANGLE]
    ),
    squares: findAspects(aspectBodies, SQUARE_ANGLE, ASPECT_ORB),
    quincunxes: findAspects(aspectBodies, QUINCUNX_ANGLE, QUINCUNX_ORB),
    oppositions: findAspects(aspectBodies, OPPOSITION_ANGLE, ASPECT_ORB),
    conjunctions: findAspects(aspectBodies, CONJUNCTION_ANGLE, ASPECT_ORB),
  };
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

function aspectToPoint(planetLon, pointLon, angle, score, label, maxOrb = ASPECT_ORB) {
  const sep = shortestArcDegrees(planetLon, pointLon);
  const orb = Math.abs(sep - angle);
  if (orb > maxOrb) return null;
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
      "conjunción al Asc",
      ANGLE_ASPECT_ORB[CONJUNCTION_ANGLE]
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
        "trígono al Asc",
        ANGLE_ASPECT_ORB[TRINE_ANGLE]
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
          "oposición al Asc",
          ANGLE_ASPECT_ORB[OPPOSITION_ANGLE]
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

function buildWheelSvg(cusps, ascendant, activeSignIndex, bodies = [], mc) {
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

  const aspectBodies = withAnglesForAspects(bodies, { ascendant, mc, cusps });
  const {
    trines,
    sextiles,
    semisextiles,
    squares,
    quincunxes,
    oppositions,
    conjunctions,
  } = collectAspectGroups(aspectBodies);
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
    ...semisextiles.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--semisextile" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
    }),
    ...squares.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--square" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
    }),
    ...quincunxes.map((t) => {
      const pa = polar(cx, cy, rAspect, longitudeToSvgRad(t.a.longitude, ascendant));
      const pb = polar(cx, cy, rAspect, longitudeToSvgRad(t.b.longitude, ascendant));
      return `<line class="sun-wheel__aspect sun-wheel__aspect--quincunx" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" />`;
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

  return `
    <svg class="sun-wheel__houses" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${rZodiacInner}" class="sun-wheel__zodiac-inner" />
      <g class="sun-wheel__zodiac">${zodiacSectors.join("")}${zodiacDividers.join("")}</g>
      ${horizon}
      ${meridian}
      ${houseLines.join("")}
      <g class="sun-wheel__aspects">${aspectLines.join("")}</g>
      ${houseLabels.join("")}
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

function buildSunWheel(signIndex, bodies, cusps, ascendant, mc) {
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

  return `
    <div class="sun-wheel">
      <div class="sun-wheel__ring">
        ${buildWheelSvg(cusps, ascendant, signIndex, bodies, mc)}
        ${signs}
        ${bodyItems}
      </div>
    </div>
  `;
}

function buildAspectLists(bodies, ascendant, cusps, mc) {
  const aspectBodies = withAnglesForAspects(bodies, { ascendant, mc, cusps });
  const {
    trines,
    sextiles,
    semisextiles,
    squares,
    quincunxes,
    oppositions,
    conjunctions,
  } = collectAspectGroups(aspectBodies);

  return `
    <div class="result-block">
      <h2 class="result-heading">Aspectos</h2>
      ${buildAspectList(trines, "Trígono", "trine")}
      ${buildAspectList(sextiles, "Sextil", "sextile")}
      ${buildAspectList(semisextiles, "Semisextil (Asc/MC)", "semisextile", ANGLE_ASPECT_ORB[SEMISEXTILE_ANGLE])}
      ${buildAspectList(squares, "Cuadratura", "square")}
      ${buildAspectList(quincunxes, "Quincuncio", "quincunx", QUINCUNX_ORB)}
      ${buildAspectList(oppositions, "Oposición", "opposition")}
      ${buildAspectList(conjunctions, "Conjunción", "conjunction")}
    </div>
  `;
}

const SUN_HOUSE_READINGS = {
  1: `El Sol en la Primera Casa, especialmente con el Sol en conjunción con el Ascendente, indica una fuerte voluntad, una abundante vitalidad y una intensa autoconciencia. Con confianza, optimismo y felicidad, esta posición intensifica el signo del Sol y, en sí misma, confiere honor y éxito. Las personas con esta posición no se dejan influenciar con facilidad por las opiniones o deseos de los demás, manifiestan una fuerte determinación de elegir su propio curso en la vida. Tienen una visión clara de lo que quieren, son firmes, y pueden ser extremadamente individualistas. Con gran iniciativa y capacidad de liderazgo, disfrutan dominar. Sus nativos son por lo general espontáneos, extrovertidos, valientes y entusiastas, pero con muchos aspectos desafiantes pueden ser dictatoriales, egoístas y pomposos. Disfrutan mucho recibir atención y publicidad y son de alguna manera exhibicionistas. Independientes, activos, emprendedores y orgullosos de sus logros, esta posición indica potencial de liderazgo y éxito que se produce a través de sus propios esfuerzos. El Sol en la primera casa adquiere muchas características del signo Aries.

Por lo general, para estos individuos hay una infancia feliz, una constitución fuerte y buena salud. Tienen abundante energía y fuertes poderes de recuperación que les ayudan a superar dolencias físicas y aflicciones de toda naturaleza. Su energía los hace hambrientos de éxito, y trabajarán largo y duro para lograr la distinción personal y la estima a los ojos del mundo. Para ellos, es primordial sentir que son personas de importancia y distinción.`,
  2: `Tienden a atraer el dinero, pero éste entra y sale de sus vidas con la misma velocidad, inclinados a la extravagancia, disfrutan gastar en lujos, aunque muchas de sus posesiones podrían aumentar su valor con el tiempo. Es posible que vengan de familias acomodadas o tengan padres exitosos. Prácticos, persistentes, y creativos en asuntos financieros, a menudo ganan a través de superiores y personas influyentes, y podría haber ganancias por altos cargos y asuntos de gobierno.`,
  3: `El Sol en la Tercera Casa muestra un fuerte impulso para lograr la distinción a través de la brillantez intelectual y los logros mentales, lo cual produce una inclinación científica con ganas de alcanzar el conocimiento y de comprender a fondo el funcionamiento interno de los procesos de la vida. Debido a su curiosidad, estas personas ansían investigar cosas nuevas, especialmente en lo que respecta a los asuntos gobernados por el signo en el que está el Sol en su Carta Astral. Con una mente activa y creativa, suelen ser buenos oradores y escritores, la capacidad de expresar y comunicar sus ideas es importante para ellos. Podrían lograr el éxito escribiendo, enseñando o impartiendo conferencias, su habilidad para expresarse muchas veces les convierte en líderes en su propio campo. La posición indica una posible fama por escritos o investigaciones, y podrían recaer algunos honores sobre los parientes del nativo. Estudios de comunicaciones y medios.

Tienen el deseo de viajar y explorar todas las posibilidades en el medio en el que se mueven. Con una infancia posiblemente feliz, sus parientes, especialmente sus hermanos, y vecinos suelen desempeñar un papel importante en sus vidas, les gusta involucrarse en asuntos de su comunidad. Observadores, optimistas, científicos y flexibles, tienen la capacidad de tomar las decisiones correctas en el momento adecuado. Aunque suelen poseer gran capacidad de estudio, una personalidad fluida y alegre, y ser imparciales y autosuficientes, también podrían ser desorganizados, dominantes y arrogantes, además de que podría existir cierta tendencia a los malentendidos con familiares. El Sol en la Tercera Casa adquiere muchas características del signo Géminis.`,
  4: `El Sol en la 4 casa. Esta posición del Sol indica un gran interés en establecer un hogar y una familia seguros, los nacidos en esta posición están orgullosos de su herencia familiar y podrían tener cierta perspectiva aristocrática. Orgullosos de su hogar y familia, que para ellos son de importancia primordial, desde su juventud sienten una profunda necesidad de establecer raíces. Generalmente, desean hacer de su casa una obra de arte, con belleza y opulencia; hasta dónde llega esta tendencia, y la forma en qué se hace, dependerá, por supuesto, de los medios materiales con los que cuenten y la clase social en la que se desenvuelven. Esta posición suele ser excelente para todas las fases de bienes raíces.

Intuitivos e introvertidos, tienen habitualmente un fuerte sentido de sí mismos, una estrecha vinculación con sus antepasados y cierto interés en el pasado. Encontrar y conocer sus raíces es esencial para su sentido de sí mismos. Con cierta tendencia a sentirse inseguros, es posible que alguno de sus padres, o ambos, sean una influencia dominante en sus vidas, e incluso, en algunos casos, puede que tengan que luchar por su independencia. Generalmente hay fuertes lazos parentales y una feliz vida hogareña, pero si la Carta Astral muestra muchos aspectos desafiantes puede haber cierto deseo de salir de la casa paterna temprano.`,
  5: `Esta posición del Sol confiere un amor por la vida y una poderosa voluntad hacia la autoexpresión creativa. Los nativos generalmente buscan placer y romance, quieren ser notados y apreciados, son altamente competitivos, y tienen cierta inclinación hacia los deportes, la música, el teatro y otras actividades artísticas. Aman a los niños y están activamente interesados en su desarrollo y educación, pero rara vez tienen una familia numerosa. Si en su Carta Astral el Sol está en una de los signos de fuego; Aries, Leo o Sagitario, es posible que tengan pocos hijos propios, o ninguno en absoluto.

El Sol en la quinta casa. Muchas veces encuentran felicidad a través del romance y actividades que les den la oportunidad de expresarse en maneras dramáticas y creativas. Con una excelente disposición general y generalmente irradiando felicidad, suelen atraer a muchos amigos, sin embargo, a veces pueden mostrarse infantiles y egocéntricos, y en algunos casos pueden carecer de madurez y sutileza, mostrando un comportamiento que puede ser descarado y excesivamente dramático. Enérgicos y creativos, disfrutan de los placeres, la buena vida y la compañía de otras personas. Generalmente exitosos con el sexo opuesto, podrían tener muchos amoríos. Los nativos con esta posición del Sol son amantes ardientes, y suelen entregarse por completo cuando están involucrados en una aventura amorosa, sin embargo, son capaces de ser leales y fieles a una persona, aunque si el Sol está en Tauro o Escorpión, podría haber posesividad y celos.`,
  6: `El Sol en la Sexta Casa confiere una salud delicada, requiriendo una atención adecuada a los hábitos alimenticios, del mismo modo, la recuperación después de una enfermedad puede ser prolongada. Una actitud positiva puede ayudarles a superar la debilidad física o la mala salud, igualmente, una rutina regular puede ser necesaria para su bienestar emocional. Determinados y leales, generalmente tienen un gran respeto por la belleza, la dieta, la salud y la higiene.

Con cierta tendencia al perfeccionismo, suelen ser eficientes solucionadores de problemas y poseer talento para la organización, los nativos de esta posición buscan prestigio por medio de su trabajo y servicio, y, por lo general, son excelentes trabajadores que se enorgullecen de su trabajo y de sus logros. Sin embargo, necesitan sentirse apreciados y exigen gestos de agradecimiento por su trabajo, y si estos gestos no llegan, tendrán una mala disposición hacia sus empleadores y compañeros de trabajo e incluso es probable que intenten cambiar de trabajo. Encontrar un trabajo satisfactorio es esencial para ellos porque se dedican a su trabajo y se definen a través de él. Si el nativo de esta posición es el empleador, puede que sea muy exigente y autoritario con respecto a sus empleados, por otra parte, si el nativo es el empleado, es posible que exija muchos derechos y privilegios y esperará ser notado y apreciado.`,
  7: `Las personas nacidas con el Sol en la Séptima Casa expresan su potencial de poder a través de relaciones personales cercanas; el matrimonio y otras asociaciones son esenciales para su identidad, aunque es posible que los nativos de esta posición salten de un lado a otro entre el miedo a la soledad y el miedo al compromiso, si el Sol cuenta con buenos aspectos atraerán compañeros sentimentales fuertes y leales, con un afecto duradero, igualmente, atraerán amigos fuertes, capaces y leales. Sin embargo, los nativos a veces tienen problemas para entender que los deseos de su pareja son tan importantes como los suyos, y podrían surgir enfrentamientos debido a su necesidad de ser dominante en las relaciones. La posición en sí promete honor y éxito en el matrimonio y en otros tipos de asociaciones que, en ambos casos, deberían aportar beneficios materiales, monetarios y sociales. Es posible que el matrimonio llegue hacia el final de la juventud, y su cónyuge probablemente será una persona prominente o de buen carácter y honorable. El sexo podría ser muy importante para ellos en el matrimonio. Si el Sol no está afectado negativamente, podría haber un éxito creciente en la vida después del matrimonio.`,
  8: `El Sol en la Octava Casa puede representar un interés en los misterios más profundos de la vida, como la muerte y la supervivencia de la conciencia después de la muerte. Esto quizás no sea siempre evidente en los primeros años, pero se vuelve más significativo más adelante en la vida. Existe un interés en la superación personal por medio de la propia voluntad. Los nativos necesitan experimentar directamente un nivel profundo de realidad espiritual que trascienda las circunstancias materiales externas, una vez que adquieren esta conciencia, los nativos toman nota de que, mientras se adhieran a los principios de justicia, nada puede dañar su ser fundamental. Es probable que las lecciones que van con el Sol en la Octava Casa sean severas, porque lo que deben aprender es de carácter fundamental.

Son creativos y se enorgullecen de las responsabilidades. Capaces de atraer el apoyo de otras personas, esta puede ser una posición muy política. Filosóficos y con profundas perspectivas, se esfuerzan por mejorarse a sí mismos. Podrían beneficiarse de una herencia, obtener dinero a través de una boda o manejar el dinero de otras personas. Es muy posible que haya preocupación por temas de impuestos, seguros, bienes de personas muertas y los asuntos financieros de socios comerciales. Si el Sol en la Octava Casa cuenta con buenos aspectos, puede indicar que se recibirán legados o herencias.`,
};

function renderSunHouseReading(text) {
  return text
    .split(/\n\n+/)
    .map((paragraph) => `<p class="chart-reading__text">${paragraph.trim()}</p>`)
    .join("");
}

function buildChartReadingSection(sun) {
  const house = sun?.house ?? "";
  return `
    <div class="result-block chart-reading">
      <button type="button" class="btn-primary btn-primary--block" id="chart-reading-btn" data-sun-house="${house}">
        Lectura de Carta Astral
      </button>
      <div id="chart-reading-output" class="chart-reading__output" hidden></div>
    </div>
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
    <div class="result-block result-block--compact">
      <div class="table-wrap table-wrap--compact">
        <table class="data-table data-table--cusps">
          <thead>
            <tr><th>Ángulo</th><th>Signo</th><th>Grado</th><th>Longitud</th></tr>
          </thead>
          <tbody>
            ${angleRows}
          </tbody>
        </table>
      </div>
      <div class="table-wrap table-wrap--compact" style="margin-top: 0.75rem;">
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

function buildCompactBodiesHouses(bodies, houses, houseSystem) {
  const planetRows = bodies.length
    ? bodies
        .map((b) => {
          const retro = b.retrograde ? '<span class="retro-mark" title="Retrógrado">R</span>' : "";
          return `
      <tr>
        <td class="ephem-planet"><span class="body-glyph" aria-hidden="true">${b.glyph}\uFE0E</span> ${bodyLabel(b)}</td>
        <td class="ephem-pos">${formatZodiacPosition(b.longitude)}${retro}</td>
        <td class="ephem-house"><span class="num">${b.house}</span></td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="3" class="ephem-empty">Ningún astro ni parte seleccionada.</td></tr>`;

  const houseRows = Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    const lon = normalizeLongitude(houses.cusps[house]);
    let label = `Casa ${house}`;
    if (house === 1) label = "Casa 1 (AC)";
    // Solo en Placidus la cúspide 10 coincide con el MC; en iguales el MC “flota”.
    if (house === 10 && houseSystem.id === "placidus") label = "Casa 10 (MC)";
    return `
      <tr>
        <td>${label}</td>
        <td class="ephem-pos">${formatZodiacPosition(lon)}</td>
      </tr>`;
  }).join("");

  return `
    <div class="result-block result-block--compact">
      <fieldset class="body-visibility body-visibility--compact">
        <legend class="body-visibility__legend">Mostrar en la carta</legend>
        <div class="body-visibility__toolbar">
          <button type="button" class="body-visibility__btn" data-visibility-action="all">Todos</button>
          <button type="button" class="body-visibility__btn" data-visibility-action="classics">Clásicos</button>
          <button type="button" class="body-visibility__btn" data-visibility-action="lots">Solo partes</button>
          <button type="button" class="body-visibility__btn" data-visibility-action="none">Ninguno</button>
        </div>
        ${buildBodyVisibilityGroupsHtml("result")}
      </fieldset>
      <div class="chart-compact">
        <div class="ephem-panel">
          <table class="ephem-table">
            <thead>
              <tr>
                <th>Planeta</th>
                <th></th>
                <th>Casa</th>
              </tr>
            </thead>
            <tbody>${planetRows}</tbody>
          </table>
        </div>
        <div class="ephem-panel">
          <table class="ephem-table">
            <thead>
              <tr>
                <th colspan="2">Casas (${houseSystem.shortLabel})</th>
              </tr>
            </thead>
            <tbody>${houseRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function buildChartResult(placeLabel, dateUtc, houses, bodies, localLabel, tzOffset, houseSystem) {
  const dateUtcStr = dateUtc.toISOString().replace(".000Z", "Z");
  const visibleBodies = filterVisibleBodies(bodies);
  const sun = bodies.find((b) => b.name === "Sol");
  const fortune = bodies.find((b) => b.name === "Fortuna");
  const infortune = bodies.find((b) => b.name === "Infortunio");
  const signIndex = getSignIndexFromLongitude(sun.longitude);
  const tzLabel = tzOffset === 0 ? "UTC±0" : `UTC${tzOffset > 0 ? "+" : ""}${tzOffset}`;
  const sectLabel = fortune?.isDayChart ? "diurna" : "nocturna";
  const ascLon = normalizeLongitude(houses.ascendant);
  const mcLon = normalizeLongitude(
    Number.isFinite(houses.mc) ? houses.mc : houses.cusps[10]
  );
  const fortuneRow =
    fortune && visibleBodyIds.has("Fortuna")
      ? `<dt>P. Fortuna</dt><dd>${fortune.sign} <span class="num">${fortune.degreesInSign}</span> · casa ${fortune.house} <span class="meta-note">(${sectLabel}: ${fortune.formula})</span></dd>`
      : "";
  const infortuneRow =
    infortune && visibleBodyIds.has("Infortunio")
      ? `<dt>P. Infortunio</dt><dd>${infortune.sign} <span class="num">${infortune.degreesInSign}</span> · casa ${infortune.house} <span class="meta-note">(${sectLabel}: ${infortune.formula})</span></dd>`
      : "";

  return `
    <div class="result-block">
      <h2 class="result-heading">Datos</h2>
      <dl class="meta-list">
        <dt>Lugar</dt><dd>${placeLabel}</dd>
        <dt>Hora local</dt><dd>${localLabel} (${tzLabel})</dd>
        <dt>Equivalente UTC</dt><dd>${dateUtcStr}</dd>
        <dt>Sistema de casas</dt><dd>${houseSystem.label}</dd>
        <dt>Ascendente</dt><dd>${formatZodiacPosition(ascLon)}</dd>
        <dt>Medio cielo</dt><dd>${formatZodiacPosition(mcLon)}</dd>
        ${fortuneRow}
        ${infortuneRow}
      </dl>
    </div>
    <div class="result-block">
      <h2 class="result-heading">Carta natal</h2>
      ${buildSunWheel(signIndex, visibleBodies, houses.cusps, ascLon, mcLon)}
    </div>
    ${buildCompactBodiesHouses(visibleBodies, houses, houseSystem)}
    ${buildAspectLists(visibleBodies, ascLon, houses.cusps, mcLon)}
    ${buildChartReadingSection(sun)}
  `;
}

async function calculateChart(dateUtc, lat, lon, houseSystem) {
  const swe = await getSwe();
  const jd = swe.dateToJulianDay(dateUtc);
  const angles = swe.calculateHouses(jd, lat, lon, houseSystem.swe);
  const cusps = buildHouseCusps(angles.ascendant, angles.cusps, houseSystem.id);
  const houses = {
    ...angles,
    ascendant: normalizeLongitude(angles.ascendant),
    mc: normalizeLongitude(angles.mc),
    cusps,
  };

  const bodies = [];
  const swissFlags = CalculationFlag.SwissEphemeris | CalculationFlag.Speed;
  for (const { name, body, glyph, displayName, useSwiss } of CHART_BODIES) {
    const position = useSwiss
      ? swe.calculatePosition(jd, body, swissFlags)
      : swe.calculatePosition(jd, body);
    bodies.push(
      makeBodyEntry(name, glyph, position.longitude, houses.cusps, {
        longitudeSpeed: position.longitudeSpeed ?? 0,
        displayName,
      })
    );

    if (name === "Nodo Norte") {
      bodies.push(
        makeBodyEntry(
          "Nodo Sur",
          "☋",
          normalizeLongitude(position.longitude + 180),
          houses.cusps,
          {
            longitudeSpeed: -(position.longitudeSpeed ?? 0),
            displayName: "Nodo S",
          }
        )
      );
    }
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
      longitudeSpeed: 0,
    }),
    makeBodyEntry("Infortunio", "⊖", infortune.longitude, houses.cusps, {
      kind: "lot",
      formula: infortune.formula,
      isDayChart: infortune.isDayChart,
      longitudeSpeed: 0,
    })
  );

  return { houses, bodies, fortune, infortune };
}

function readBirthFormFields(ids) {
  const dateStr = document.getElementById(ids.date).value;
  const timeStr = document.getElementById(ids.time).value;
  const tzRaw = document.getElementById(ids.tz).value;
  const tzExplicit = tzRaw !== "";
  const tzOffset = tzExplicit ? Number(tzRaw) : NaN;
  const houseSystem = resolveHouseSystem(document.getElementById(ids.house).value);

  if (ids.locationMode) {
    const mode =
      document.querySelector(`input[name="${ids.locationMode}"]:checked`)?.value || "region";

    if (mode === "region") {
      const country = document.getElementById(ids.country).value.trim();
      const regionId = document.getElementById(ids.region).value.trim();
      const region = findRegion(country, regionId);
      const placeName = document.getElementById(ids.placeRegion).value.trim();
      return {
        dateStr,
        timeStr,
        tzOffset,
        tzExplicit,
        houseSystem,
        locationMode: "region",
        placeName,
        country,
        regionName: region?.name || "",
        lat: region?.lat ?? NaN,
        lon: region?.lon ?? NaN,
      };
    }

    const placeName = document.getElementById(ids.place).value.trim();
    const lat = parseCoordinate(document.getElementById(ids.lat).value);
    const lon = parseCoordinate(document.getElementById(ids.lon).value);
    return {
      dateStr,
      timeStr,
      tzOffset,
      tzExplicit,
      houseSystem,
      locationMode: "manual",
      placeName,
      country: "",
      regionName: "",
      lat,
      lon,
    };
  }

  const placeName = document.getElementById(ids.place).value.trim();
  const country = ids.country
    ? document.getElementById(ids.country).value.trim()
    : "";
  const lat = parseCoordinate(document.getElementById(ids.lat).value);
  const lon = parseCoordinate(document.getElementById(ids.lon).value);
  return {
    dateStr,
    timeStr,
    tzOffset,
    tzExplicit,
    houseSystem,
    locationMode: "manual",
    placeName,
    country,
    regionName: "",
    lat,
    lon,
  };
}

function applyImplicitTimezone(input) {
  if (input.tzExplicit) return null;
  const resolved = resolveImplicitUtcOffset({
    country: input.country,
    dateStr: input.dateStr,
    timeStr: input.timeStr,
    lon: input.lon,
  });
  if (Number.isNaN(resolved)) {
    return "No se pudo inferir el huso. Elegí país o indicá el huso horario.";
  }
  input.tzOffset = resolved;
  return null;
}

function validateBirthInput(input) {
  const { dateStr, timeStr, lat, lon, tzOffset, tzExplicit, locationMode, country, regionName } = input;
  if (!dateStr || !timeStr) return "Indica fecha y hora local.";
  if (locationMode === "region") {
    if (!country) return "Elegí el país de nacimiento.";
    if (!regionName) return "Elegí el departamento o la provincia.";
  }
  if (Number.isNaN(lat) || lat < -90 || lat > 90) return "La latitud debe estar entre −90 y 90.";
  if (Number.isNaN(lon) || lon < -180 || lon > 180) {
    return "La longitud debe estar entre −180 y 180.";
  }
  if (tzExplicit && Number.isNaN(tzOffset)) return "El huso horario no es válido.";
  return null;
}

function birthInputToUtc({
  dateStr,
  timeStr,
  tzOffset,
  placeName,
  country,
  regionName,
  lat,
  lon,
}) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":");
  const hh = Number(timeParts[0] ?? 0);
  const mm = Number(timeParts[1] ?? 0);
  const ss = Number(timeParts[2] ?? 0);
  const dateUtc = new Date(Date.UTC(y, mo - 1, d, hh - tzOffset, mm, ss));
  const localLabel = `${dateStr} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const placeParts = [placeName, regionName, country].filter(Boolean);
  const placeLabel = placeParts.length
    ? `${placeParts.join(", ")} (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`
    : `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  return { dateUtc, localLabel, placeLabel };
}

function wireBirthTool({ form, output, panel, error, fieldIds, buildResult }) {
  const submitBtn = form?.querySelector('button[type="submit"]');
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    error.textContent = "";
    output.innerHTML = "";
    output.hidden = true;
    if (panel) panel.hidden = true;

    const input = readBirthFormFields(fieldIds);
    const validationError = validateBirthInput(input);
    if (validationError) {
      error.textContent = validationError;
      error.hidden = false;
      if (panel) panel.hidden = false;
      return;
    }

    const tzError = applyImplicitTimezone(input);
    if (tzError) {
      error.textContent = tzError;
      error.hidden = false;
      if (panel) panel.hidden = false;
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
      if (panel) panel.hidden = false;
    } catch (err) {
      console.error(err);
      error.textContent =
        err instanceof Error ? err.message : "Error al calcular.";
      error.hidden = false;
      if (panel) panel.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }
  });
}

wireBirthTool({
  form: document.getElementById("birth-form"),
  output: document.getElementById("chart-output"),
  panel: document.getElementById("carta"),
  error: document.getElementById("chart-error"),
  fieldIds: {
    date: "birth-date",
    time: "birth-time",
    tz: "tz-offset",
    house: "house-system",
    locationMode: "location-mode",
    country: "birth-country",
    region: "birth-region",
    placeRegion: "place-name-region",
    place: "place-name",
    lat: "lat",
    lon: "lon",
  },
  buildResult: (placeLabel, dateUtc, houses, bodies, localLabel, tzOffset, houseSystem) => {
    lastNatalChart = {
      placeLabel,
      dateUtc,
      houses,
      bodies,
      localLabel,
      tzOffset,
      houseSystem,
    };
    return buildChartResult(
      placeLabel,
      dateUtc,
      houses,
      bodies,
      localLabel,
      tzOffset,
      houseSystem
    );
  },
});

document.getElementById("chart-body-visibility-fields")?.insertAdjacentHTML(
  "beforeend",
  buildBodyVisibilityGroupsHtml("form")
);

document.addEventListener("change", (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
  if (!input.closest(".body-visibility")) return;
  if (input.checked) visibleBodyIds.add(input.value);
  else visibleBodyIds.delete(input.value);
  saveVisibleBodyIds();
  syncBodyVisibilityCheckboxes();
  rerenderNatalChart();
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-visibility-action]");
  if (!btn) return;
  e.preventDefault();
  applyVisibilityAction(btn.dataset.visibilityAction);
});

document.getElementById("chart-output")?.addEventListener("click", (e) => {
  const btn = e.target.closest("#chart-reading-btn");
  if (!btn) return;
  const out = document.getElementById("chart-reading-output");
  if (!out) return;

  const sunHouse = Number(btn.dataset.sunHouse);
  const reading = SUN_HOUSE_READINGS[sunHouse];
  if (reading) {
    out.innerHTML = renderSunHouseReading(reading);
  } else {
    out.innerHTML = `<p class="chart-reading__empty">Esta lectura aplica cuando el Sol está en las casas 1 a 8. En esta carta el Sol está en la casa ${Number.isFinite(sunHouse) ? sunHouse : "—"}.</p>`;
  }
  out.hidden = false;
  out.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

function wireLocationMode({
  modeName,
  regionPanelId,
  manualPanelId,
  countryId,
  regionId,
  regionLabelId,
  coordsHintId,
  latId,
  lonId,
}) {
  const regionPanel = document.getElementById(regionPanelId);
  const manualPanel = document.getElementById(manualPanelId);
  const countrySelect = document.getElementById(countryId);
  const regionSelect = document.getElementById(regionId);
  const regionLabel = document.getElementById(regionLabelId);
  const coordsHint = document.getElementById(coordsHintId);
  const modeRadios = document.querySelectorAll(`input[name="${modeName}"]`);

  function setMode(mode) {
    const isRegion = mode === "region";
    if (regionPanel) regionPanel.hidden = !isRegion;
    if (manualPanel) manualPanel.hidden = isRegion;
    if (countrySelect) countrySelect.required = isRegion;
    if (regionSelect) regionSelect.required = isRegion;
    const lat = document.getElementById(latId);
    const lon = document.getElementById(lonId);
    if (lat) lat.required = !isRegion;
    if (lon) lon.required = !isRegion;
  }

  function fillRegions(country) {
    if (!regionSelect || !regionLabel) return;
    const regions = getCountryRegions(country);
    regionLabel.textContent = getRegionLabel(country);
    regionSelect.innerHTML = "";
    if (!country || !regions.length) {
      regionSelect.disabled = true;
      regionSelect.innerHTML = '<option value="">Primero elegí un país</option>';
      if (coordsHint) coordsHint.hidden = true;
      return;
    }
    regionSelect.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = `Elegí ${getRegionLabel(country).toLowerCase()}`;
    regionSelect.appendChild(placeholder);
    for (const region of regions) {
      const opt = document.createElement("option");
      opt.value = region.id;
      opt.textContent = region.name;
      regionSelect.appendChild(opt);
    }
    if (coordsHint) coordsHint.hidden = true;
  }

  function updateCoordsHint() {
    if (!coordsHint || !countrySelect || !regionSelect) return;
    const region = findRegion(countrySelect.value, regionSelect.value);
    if (!region) {
      coordsHint.hidden = true;
      coordsHint.textContent = "";
      return;
    }
    coordsHint.hidden = false;
    coordsHint.textContent = `Coordenadas usadas (capital regional): ${region.lat.toFixed(4)}°, ${region.lon.toFixed(4)}°`;
  }

  modeRadios.forEach((radio) => {
    radio.addEventListener("change", () => setMode(radio.value));
  });
  countrySelect?.addEventListener("change", () => {
    fillRegions(countrySelect.value);
  });
  regionSelect?.addEventListener("change", updateCoordsHint);

  setMode(document.querySelector(`input[name="${modeName}"]:checked`)?.value || "region");
}

wireLocationMode({
  modeName: "location-mode",
  regionPanelId: "location-region-fields",
  manualPanelId: "location-manual-fields",
  countryId: "birth-country",
  regionId: "birth-region",
  regionLabelId: "birth-region-label",
  coordsHintId: "region-coords-hint",
  latId: "lat",
  lonId: "lon",
});

wireLocationMode({
  modeName: "dom-location-mode",
  regionPanelId: "dom-location-region-fields",
  manualPanelId: "dom-location-manual-fields",
  countryId: "dom-birth-country",
  regionId: "dom-birth-region",
  regionLabelId: "dom-birth-region-label",
  coordsHintId: "dom-region-coords-hint",
  latId: "dom-lat",
  lonId: "dom-lon",
});

wireLocationMode({
  modeName: "vit-location-mode",
  regionPanelId: "vit-location-region-fields",
  manualPanelId: "vit-location-manual-fields",
  countryId: "vit-birth-country",
  regionId: "vit-birth-region",
  regionLabelId: "vit-birth-region-label",
  coordsHintId: "vit-region-coords-hint",
  latId: "vit-lat",
  lonId: "vit-lon",
});

wireBirthTool({
  form: document.getElementById("dominant-form"),
  output: document.getElementById("dominant-output"),
  panel: document.getElementById("dominante-resultado"),
  error: document.getElementById("dominant-error"),
  fieldIds: {
    date: "dom-birth-date",
    time: "dom-birth-time",
    tz: "dom-tz-offset",
    house: "dom-house-system",
    locationMode: "dom-location-mode",
    country: "dom-birth-country",
    region: "dom-birth-region",
    placeRegion: "dom-place-name-region",
    place: "dom-place-name",
    lat: "dom-lat",
    lon: "dom-lon",
  },
  buildResult: buildDominantResult,
});

wireBirthTool({
  form: document.getElementById("vitality-form"),
  output: document.getElementById("vitality-output"),
  panel: document.getElementById("vitalidad-resultado"),
  error: document.getElementById("vitality-error"),
  fieldIds: {
    date: "vit-birth-date",
    time: "vit-birth-time",
    tz: "vit-tz-offset",
    house: "vit-house-system",
    locationMode: "vit-location-mode",
    country: "vit-birth-country",
    region: "vit-birth-region",
    placeRegion: "vit-place-name-region",
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
