/**
 * Años de vitalidad — método Bonatti (Brady / medieval práctico).
 * Hyleg → Alcoccoden → años planetarios. Differentia 3ª si no hay Hyleg.
 * Differentia 1ª/2ª: chequeo simplificado (sin Almudebit completo).
 */

import { Planet } from "@swisseph/core";

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

const CLASSICAL = ["Sol", "Luna", "Mercurio", "Venus", "Marte", "Júpiter", "Saturno"];

const PLANET_YEARS = {
  Sol: { lesser: 19, middle: 69.5, greater: 120 },
  Luna: { lesser: 25, middle: 66.5, greater: 108 },
  Mercurio: { lesser: 20, middle: 48, greater: 76 },
  Venus: { lesser: 8, middle: 45, greater: 82 },
  Marte: { lesser: 15, middle: 40.5, greater: 66 },
  Júpiter: { lesser: 12, middle: 45.5, greater: 79 },
  Saturno: { lesser: 30, middle: 43.5, greater: 57 },
};

/** Domicilios tradicionales (índice de signo). */
const DOMICILE = {
  Sol: [4],
  Luna: [3],
  Mercurio: [2, 5],
  Venus: [1, 6],
  Marte: [0, 7],
  Júpiter: [8, 11],
  Saturno: [9, 10],
};

const EXALTATION = {
  Sol: [0],
  Luna: [1],
  Mercurio: [5],
  Venus: [11],
  Marte: [9],
  Júpiter: [3],
  Saturno: [6],
};

const DETRIMENT = {
  Sol: [10],
  Luna: [9],
  Mercurio: [8, 11],
  Venus: [0, 7],
  Marte: [1, 6],
  Júpiter: [2, 5],
  Saturno: [3, 4],
};

const FALL = {
  Sol: [6],
  Luna: [7],
  Mercurio: [11],
  Venus: [5],
  Marte: [3],
  Júpiter: [9],
  Saturno: [0],
};

/** Triplicidad dorotea: día / noche (participante no usado como “el” trip ruler). */
const TRIPLICITY_DAY = {
  fire: "Sol",
  earth: "Venus",
  air: "Saturno",
  water: "Venus",
};
const TRIPLICITY_NIGHT = {
  fire: "Júpiter",
  earth: "Luna",
  air: "Mercurio",
  water: "Marte",
};

const SIGN_ELEMENT = [
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

/** Términos egipcios: fin acumulado del término en el signo (0–30). */
const EGYPTIAN_TERMS = [
  [
    ["Júpiter", 6],
    ["Venus", 12],
    ["Mercurio", 20],
    ["Marte", 25],
    ["Saturno", 30],
  ],
  [
    ["Venus", 8],
    ["Mercurio", 14],
    ["Júpiter", 22],
    ["Saturno", 27],
    ["Marte", 30],
  ],
  [
    ["Mercurio", 6],
    ["Júpiter", 12],
    ["Venus", 17],
    ["Marte", 24],
    ["Saturno", 30],
  ],
  [
    ["Marte", 7],
    ["Venus", 13],
    ["Mercurio", 19],
    ["Júpiter", 26],
    ["Saturno", 30],
  ],
  [
    ["Júpiter", 6],
    ["Venus", 11],
    ["Saturno", 18],
    ["Mercurio", 24],
    ["Marte", 30],
  ],
  [
    ["Mercurio", 7],
    ["Venus", 17],
    ["Júpiter", 21],
    ["Marte", 28],
    ["Saturno", 30],
  ],
  [
    ["Saturno", 6],
    ["Mercurio", 14],
    ["Júpiter", 21],
    ["Venus", 28],
    ["Marte", 30],
  ],
  [
    ["Marte", 7],
    ["Venus", 11],
    ["Mercurio", 19],
    ["Júpiter", 24],
    ["Saturno", 30],
  ],
  [
    ["Júpiter", 12],
    ["Venus", 17],
    ["Mercurio", 21],
    ["Saturno", 26],
    ["Marte", 30],
  ],
  [
    ["Mercurio", 7],
    ["Júpiter", 14],
    ["Venus", 22],
    ["Saturno", 26],
    ["Marte", 30],
  ],
  [
    ["Mercurio", 7],
    ["Venus", 13],
    ["Júpiter", 20],
    ["Marte", 25],
    ["Saturno", 30],
  ],
  [
    ["Venus", 12],
    ["Júpiter", 16],
    ["Mercurio", 19],
    ["Marte", 28],
    ["Saturno", 30],
  ],
];

const PTOLEMAIC_ANGLES = [0, 60, 90, 120, 180];
/** Orbes por planeta (moiety aproximada) para aspectos hylegíacos. */
const PLANET_ORBS = {
  Sol: 12,
  Luna: 10,
  Mercurio: 7,
  Venus: 7,
  Marte: 8,
  Júpiter: 9,
  Saturno: 9,
};
const HYLEG_ORB = 8; // fallback
const PARTILE_ORB = 1;

function normalizeLongitude(longitude) {
  return ((longitude % 360) + 360) % 360;
}

function signIndex(lon) {
  return Math.floor(normalizeLongitude(lon) / 30);
}

function degInSign(lon) {
  return normalizeLongitude(lon) % 30;
}

function shortestArc(a, b) {
  let d = Math.abs(normalizeLongitude(a) - normalizeLongitude(b));
  if (d > 180) d = 360 - d;
  return d;
}

function isMasculineSign(si) {
  return si % 2 === 0;
}

function isFeminineSign(si) {
  return !isMasculineSign(si);
}

function houseClass(house) {
  if ([1, 4, 7, 10].includes(house)) return "angular";
  if ([2, 5, 8, 11].includes(house)) return "succedent";
  return "cadent";
}

function termRuler(lon) {
  const si = signIndex(lon);
  const d = degInSign(lon);
  for (const [name, end] of EGYPTIAN_TERMS[si]) {
    if (d < end) return name;
  }
  return EGYPTIAN_TERMS[si][4][0];
}

function domicileRuler(si) {
  for (const [name, signs] of Object.entries(DOMICILE)) {
    if (signs.includes(si)) return name;
  }
  return null;
}

function exaltationRuler(si) {
  for (const [name, signs] of Object.entries(EXALTATION)) {
    if (signs.includes(si)) return name;
  }
  return null;
}

function triplicityRuler(si, isDay) {
  const el = SIGN_ELEMENT[si];
  return isDay ? TRIPLICITY_DAY[el] : TRIPLICITY_NIGHT[el];
}

/** Los cuatro regentes del grado (domicilio, exaltación, triplicidad de secta, término). */
function fourRulersOfDegree(lon, isDay) {
  const si = signIndex(lon);
  const rulers = [
    domicileRuler(si),
    exaltationRuler(si),
    triplicityRuler(si, isDay),
    termRuler(lon),
  ].filter(Boolean);
  return [...new Set(rulers)];
}

function dignityScoreAt(planetName, lon, isDay) {
  const si = signIndex(lon);
  let score = 0;
  const parts = [];
  if (DOMICILE[planetName]?.includes(si)) {
    score += 5;
    parts.push("domicilio");
  }
  if (EXALTATION[planetName]?.includes(si)) {
    score += 4;
    parts.push("exaltación");
  }
  if (triplicityRuler(si, isDay) === planetName) {
    score += 3;
    parts.push("triplicidad");
  }
  if (termRuler(lon) === planetName) {
    score += 2;
    parts.push("término");
  }
  return { score, parts };
}

function inDetrimentOrFall(planetName, lon) {
  const si = signIndex(lon);
  return (
    Boolean(DETRIMENT[planetName]?.includes(si)) ||
    Boolean(FALL[planetName]?.includes(si))
  );
}

function hasPtolemaicAspect(lonA, lonB, orb = HYLEG_ORB) {
  const sep = shortestArc(lonA, lonB);
  for (const angle of PTOLEMAIC_ANGLES) {
    const o = Math.abs(sep - angle);
    if (o <= orb) {
      return { angle, orb: o };
    }
  }
  return null;
}

function aspectOrbForPlanet(name) {
  return PLANET_ORBS[name] ?? HYLEG_ORB;
}

function classicalBodies(bodies) {
  return bodies.filter((b) => CLASSICAL.includes(b.name));
}

function bodyByName(bodies, name) {
  return bodies.find((b) => b.name === name);
}

function anyRulerAspectsPoint(rulers, pointLon, bodies) {
  for (const name of rulers) {
    const p = bodyByName(bodies, name);
    if (!p) continue;
    const asp = hasPtolemaicAspect(
      p.longitude,
      pointLon,
      aspectOrbForPlanet(name)
    );
    if (asp) return { planet: name, ...asp };
  }
  return null;
}

/**
 * Lunación previa al nacimiento (Nueva = conjuncional, Llena = prevencional).
 */
export async function findPreviousLunation(swe, jdBirth) {
  const samples = [];
  for (let i = 0; i <= 40 * 24; i++) {
    const jd = jdBirth - i / 24;
    const sun = swe.calculatePosition(jd, Planet.Sun).longitude;
    const moon = swe.calculatePosition(jd, Planet.Moon).longitude;
    const elong = normalizeLongitude(moon - sun);
    const distNew = Math.min(elong, 360 - elong);
    const distFull = Math.abs(elong - 180);
    samples.push({ jd, elong, distNew, distFull });
  }

  let best = null;
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    const next = samples[i + 1];
    const isNewMin = cur.distNew < prev.distNew && cur.distNew <= next.distNew && cur.distNew < 8;
    const isFullMin = cur.distFull < prev.distFull && cur.distFull <= next.distFull && cur.distFull < 8;
    if (!isNewMin && !isFullMin) continue;
    const type = isNewMin && (!isFullMin || cur.distNew <= cur.distFull) ? "new" : "full";
    const dist = type === "new" ? cur.distNew : cur.distFull;
    if (!best || cur.jd > best.jd) {
      best = { jd: cur.jd, type, dist, elong: cur.elong };
    }
  }

  if (!best) {
    // Fallback: tipo por fase a nacimiento
    const sun = swe.calculatePosition(jdBirth, Planet.Sun).longitude;
    const moon = swe.calculatePosition(jdBirth, Planet.Moon).longitude;
    const elong = normalizeLongitude(moon - sun);
    const waxing = elong < 180;
    return {
      type: waxing ? "new" : "full",
      label: waxing ? "conjuncional" : "prevencional",
      longitude: waxing ? sun : normalizeLongitude(sun + 180),
      jd: jdBirth - 7,
      approximate: true,
    };
  }

  const sun = swe.calculatePosition(best.jd, Planet.Sun).longitude;
  const moon = swe.calculatePosition(best.jd, Planet.Moon).longitude;

  return {
    type: best.type,
    label: best.type === "new" ? "conjuncional" : "prevencional",
    longitude: best.type === "new" ? normalizeLongitude(sun) : normalizeLongitude(sun + 180),
    moonLongitude: moon,
    jd: best.jd,
    approximate: false,
  };
}

function trySunHyleg(sun) {
  if (!sun) return null;
  const h = sun.house;
  const masc = isMasculineSign(signIndex(sun.longitude));
  if ([1, 11, 10].includes(h)) {
    return { kind: "planet", name: "Sol", body: sun, reason: `Sol en casa ${h}` };
  }
  if ([7, 8, 9].includes(h) && masc) {
    return {
      kind: "planet",
      name: "Sol",
      body: sun,
      reason: `Sol en casa ${h} (signo masculino)`,
    };
  }
  return null;
}

function tryMoonHyleg(moon, bodies, isDay) {
  if (!moon) return null;
  const cls = houseClass(moon.house);
  if (cls === "cadent") return null;
  if (!isFeminineSign(signIndex(moon.longitude))) return null;
  const rulers = fourRulersOfDegree(moon.longitude, isDay);
  const asp = anyRulerAspectsPoint(rulers, moon.longitude, bodies);
  if (!asp) return null;
  return {
    kind: "planet",
    name: "Luna",
    body: moon,
    reason: `Luna en casa ${moon.house} (signo femenino); ${asp.planet} aspecta su grado`,
  };
}

function tryPointHyleg(label, lon, house, bodies, isDay) {
  const rulers = fourRulersOfDegree(lon, isDay);
  const asp = anyRulerAspectsPoint(rulers, lon, bodies);
  if (!asp) return null;
  return {
    kind: "point",
    name: label,
    longitude: lon,
    house,
    reason: `${label}; ${asp.planet} aspecta el grado`,
  };
}

/**
 * Hyleg según Bonatti.
 */
export function findBonattiHyleg(houses, bodies, lunation, isDay) {
  const sun = bodyByName(bodies, "Sol");
  const moon = bodyByName(bodies, "Luna");
  const fortune = bodyByName(bodies, "Fortuna");
  const attempts = [];

  const sunH = trySunHyleg(sun);
  attempts.push({ candidate: "Sol", ok: Boolean(sunH), detail: sunH?.reason || "no cumple casas Bonatti" });
  if (sunH) {
    const alcoc = findAlcoccoden(sunH, bodies, isDay);
    if (alcoc) return { hyleg: sunH, attempts, rejectedForNoAlcoccoden: false };
    attempts[attempts.length - 1].detail += " (sin Alcoccoden → se descarta)";
  }

  const moonH = tryMoonHyleg(moon, bodies, isDay);
  attempts.push({
    candidate: "Luna",
    ok: Boolean(moonH),
    detail: moonH?.reason || "no cumple casa/signo/aspecto de regentes",
  });
  if (moonH) {
    const alcoc = findAlcoccoden(moonH, bodies, isDay);
    if (alcoc) return { hyleg: moonH, attempts, rejectedForNoAlcoccoden: false };
    attempts[attempts.length - 1].detail += " (sin Alcoccoden → se descarta)";
  }

  const conjunctional = lunation.label === "conjuncional";

  if (conjunctional) {
    const ascTry = tryPointHyleg(
      "Ascendente",
      houses.ascendant,
      1,
      bodies,
      isDay
    );
    attempts.push({
      candidate: "Ascendente",
      ok: Boolean(ascTry),
      detail: ascTry?.reason || "ningún regente del grado aspecta el Asc",
    });
    if (ascTry) {
      const alcoc = findAlcoccoden(ascTry, bodies, isDay);
      if (alcoc) return { hyleg: ascTry, attempts, rejectedForNoAlcoccoden: false };
    }
    if (fortune) {
      const fTry = tryPointHyleg("Fortuna", fortune.longitude, fortune.house, bodies, isDay);
      attempts.push({
        candidate: "Fortuna",
        ok: Boolean(fTry),
        detail: fTry?.reason || "ningún regente aspecta la Fortuna",
      });
      if (fTry) {
        const alcoc = findAlcoccoden(fTry, bodies, isDay);
        if (alcoc) return { hyleg: fTry, attempts, rejectedForNoAlcoccoden: false };
      }
    }
    const conjTry = tryPointHyleg(
      "Lunación (Nueva)",
      lunation.longitude,
      null,
      bodies,
      isDay
    );
    attempts.push({
      candidate: "Lunación Nueva",
      ok: Boolean(conjTry),
      detail: conjTry?.reason || "ningún regente aspecta la lunación",
    });
    if (conjTry) {
      const alcoc = findAlcoccoden(conjTry, bodies, isDay);
      if (alcoc) return { hyleg: conjTry, attempts, rejectedForNoAlcoccoden: false };
    }
  } else {
    if (fortune) {
      const fTry = tryPointHyleg("Fortuna", fortune.longitude, fortune.house, bodies, isDay);
      attempts.push({
        candidate: "Fortuna",
        ok: Boolean(fTry),
        detail: fTry?.reason || "ningún regente aspecta la Fortuna",
      });
      if (fTry) {
        const alcoc = findAlcoccoden(fTry, bodies, isDay);
        if (alcoc) return { hyleg: fTry, attempts, rejectedForNoAlcoccoden: false };
      }
    }
    const ascTry = tryPointHyleg(
      "Ascendente",
      houses.ascendant,
      1,
      bodies,
      isDay
    );
    attempts.push({
      candidate: "Ascendente",
      ok: Boolean(ascTry),
      detail: ascTry?.reason || "ningún regente del grado aspecta el Asc",
    });
    if (ascTry) {
      const alcoc = findAlcoccoden(ascTry, bodies, isDay);
      if (alcoc) return { hyleg: ascTry, attempts, rejectedForNoAlcoccoden: false };
    }
  }

  return { hyleg: null, attempts, rejectedForNoAlcoccoden: true };
}

export function findAlcoccoden(hyleg, bodies, isDay) {
  const hylegLon = hyleg.kind === "planet" ? hyleg.body.longitude : hyleg.longitude;
  const classical = classicalBodies(bodies);
  const candidates = [];

  for (const p of classical) {
    if (hyleg.kind === "planet" && p.name === hyleg.name) continue;
    const asp = hasPtolemaicAspect(
      p.longitude,
      hylegLon,
      aspectOrbForPlanet(p.name)
    );
    if (!asp) continue;
    const dig = dignityScoreAt(p.name, hylegLon, isDay);
    if (dig.score <= 0) continue;
    candidates.push({
      planet: p,
      aspect: asp,
      dignity: dig,
      score: dig.score,
      orb: asp.orb,
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.orb - b.orb);
  const top = candidates[0];
  return {
    name: top.planet.name,
    glyph: top.planet.glyph,
    body: top.planet,
    aspectAngle: top.aspect.angle,
    aspectOrb: top.aspect.orb,
    dignityParts: top.dignity.parts,
    dignityScore: top.score,
    allCandidates: candidates.slice(0, 5).map((c) => ({
      name: c.planet.name,
      score: c.score,
      orb: c.orb,
      parts: c.dignity.parts,
    })),
  };
}

function baseYearsForAlcoccoden(body) {
  const years = PLANET_YEARS[body.name];
  const poor = inDetrimentOrFall(body.name, body.longitude);
  const cls = houseClass(body.house);
  let tier;
  let value;
  if ((cls === "angular" || cls === "succedent") && !poor) {
    tier = "mayores";
    value = years.greater;
  } else if ((cls === "angular" || cls === "succedent") && poor) {
    tier = "medios";
    value = years.middle;
  } else if (cls === "cadent" && !poor) {
    tier = "medios";
    value = years.middle;
  } else {
    tier = "menores";
    value = years.lesser;
  }
  return {
    tier,
    years: value,
    note: `${body.name} casa ${body.house} (${cls})${poor ? ", en exilio/caída" : ""} → años ${tier}`,
  };
}

function aspectLabel(angle) {
  if (angle === 0) return "conjunción";
  if (angle === 60) return "sextil";
  if (angle === 90) return "cuadratura";
  if (angle === 120) return "trígono";
  if (angle === 180) return "oposición";
  return `${angle}°`;
}

function conditionTier(body) {
  const poor = inDetrimentOrFall(body.name, body.longitude);
  const cls = houseClass(body.house);
  if (poor && cls === "cadent") return "bad";
  if (poor || cls === "cadent") return "medium";
  return "good";
}

/**
 * Ajusta años por aspectos de benéficos / maléficos al Alcoccoden (Brady).
 */
export function computeVitalityYears(alcoccoden, bodies) {
  const base = baseYearsForAlcoccoden(alcoccoden.body);
  let totalYears = base.years;
  const adjustments = [];

  const benefics = ["Venus", "Júpiter", "Luna"];
  const malefics = ["Marte", "Saturno"];

  for (const p of classicalBodies(bodies)) {
    if (p.name === alcoccoden.name) continue;
    const asp = hasPtolemaicAspect(
      p.longitude,
      alcoccoden.body.longitude,
      aspectOrbForPlanet(p.name)
    );
    if (!asp) continue;
    const py = PLANET_YEARS[p.name];
    if (!py) continue;
    const tier = conditionTier(p);

    if (benefics.includes(p.name) && [0, 60, 120].includes(asp.angle)) {
      let addYears = 0;
      let label;
      if (tier === "good") {
        addYears = py.lesser + py.middle / 12;
        label = `+${py.lesser} a (menores) + ${py.middle} m (medios)`;
      } else if (tier === "medium") {
        addYears = py.lesser / 12 + py.middle / 365.25;
        label = `+${py.lesser} m + ${py.middle} d (condición media)`;
      } else {
        addYears = py.lesser / 12;
        label = `+${py.lesser} m (condición débil)`;
      }
      totalYears += addYears;
      adjustments.push({
        kind: "add",
        planet: p.name,
        aspect: aspectLabel(asp.angle),
        years: addYears,
        label,
      });
    }

    if (malefics.includes(p.name) && [0, 90, 180].includes(asp.angle)) {
      let subYears = 0;
      let label;
      if (tier === "good") {
        subYears = py.lesser + py.middle / 12;
        label = `−${py.lesser} a − ${py.middle} m`;
      } else if (tier === "medium") {
        subYears = py.lesser + py.middle / 365.25;
        label = `−${py.lesser} a − ${py.middle} d`;
      } else {
        subYears = py.lesser / 12;
        label = `−${py.lesser} m (maléfico debilitado)`;
      }
      totalYears -= subYears;
      adjustments.push({
        kind: "sub",
        planet: p.name,
        aspect: aspectLabel(asp.angle),
        years: -subYears,
        label,
      });
    }
  }

  if (totalYears < 0) totalYears = 0;

  return {
    base,
    adjustments,
    totalYears,
    display: formatYearsMonths(totalYears),
  };
}

function formatYearsMonths(years) {
  const y = Math.floor(years);
  const months = Math.round((years - y) * 12);
  if (months === 12) return `${y + 1} años`;
  if (months === 0) return `${y} años`;
  return `${y} años y ${months} meses`;
}

/**
 * Differentia simplificada (Ptolomeo/Bonatti lite, sin Almudebit).
 */
export function assessDifferentiaSimplified(houses, bodies, hasHyleg) {
  if (!hasHyleg) {
    return {
      grade: 3,
      label: "3ª Differentia (sin Hyleg)",
      note: "No se halló Hyleg/Alcoccoden. Tradicionalmente: vitalidad incierta o crisis antes de la madurez. Hoy: mapa con dador de vida poco claro. Esto es un resultado válido del método, no un fallo del cálculo.",
    };
  }

  const sun = bodyByName(bodies, "Sol");
  const moon = bodyByName(bodies, "Luna");
  if (!sun || !moon) {
    return {
      grade: 3,
      label: "3ª Differentia (datos incompletos)",
      note: "Faltan luminarias para evaluar Differentia.",
    };
  }
  const isDay = sun.house >= 7;
  const main = isDay ? sun : moon;
  const mars = bodyByName(bodies, "Marte");
  const saturn = bodyByName(bodies, "Saturno");
  const malefics = [mars, saturn].filter(Boolean);

  let partileHit = false;
  let orbedHit = false;

  for (const mal of malefics) {
    const poorMal = inDetrimentOrFall(mal.name, mal.longitude);
    if (!poorMal && dignityScoreAt(mal.name, mal.longitude, isDay).score >= 5) {
      // maléfico dignificado: menos peso en 1ª
      continue;
    }
    for (const targetLon of [main.longitude, houses.ascendant]) {
      for (const angle of [0, 90, 180]) {
        const sep = shortestArc(mal.longitude, targetLon);
        const orb = Math.abs(sep - angle);
        if (orb <= PARTILE_ORB) partileHit = true;
        else if (orb <= HYLEG_ORB) orbedHit = true;
      }
    }
  }

  const sunRuler = domicileRuler(signIndex(sun.longitude));
  const moonRuler = domicileRuler(signIndex(moon.longitude));
  const sunR = bodyByName(bodies, sunRuler);
  const moonR = bodyByName(bodies, moonRuler);
  const bothCadent =
    sunR && moonR && houseClass(sunR.house) === "cadent" && houseClass(moonR.house) === "cadent";

  if (partileHit && bothCadent) {
    return {
      grade: 1,
      label: "1ª Differentia (simplificada)",
      note: "Señales fuertes de tensión a luminaria/Asc con regentes cadentes. Interpretar como alerta de vitalidad, no como predicción de muerte.",
    };
  }
  if (orbedHit && bothCadent) {
    return {
      grade: 2,
      label: "2ª Differentia (simplificada)",
      note: "Tensión con orbe a luminaria/Asc y regentes cadentes. Vitalidad sensible; no equivale a un veredicto fatal.",
    };
  }

  return {
    grade: 4,
    label: "4ª Differentia (con Hyleg)",
    note: "Hay Hyleg y Alcoccoden: el mapa puede sostener vitalidad hacia la madurez/vejez según los años otorgados.",
  };
}

function formatLon(lon) {
  const si = signIndex(lon);
  const d = degInSign(lon);
  const deg = Math.floor(d);
  const min = Math.floor((d - deg) * 60);
  return `${SIGN_NAMES[si]} ${deg}°${String(min).padStart(2, "0")}'`;
}

/**
 * Análisis completo de vitalidad (Bonatti práctico).
 */
export async function analyzeVitality(swe, jd, houses, bodies) {
  const sun = bodyByName(bodies, "Sol");
  const isDay = sun.house >= 7;
  const lunation = await findPreviousLunation(swe, jd);
  const { hyleg, attempts } = findBonattiHyleg(houses, bodies, lunation, isDay);

  let alcoccoden = null;
  let years = null;
  if (hyleg) {
    alcoccoden = findAlcoccoden(hyleg, bodies, isDay);
    if (alcoccoden) {
      years = computeVitalityYears(alcoccoden, bodies);
    }
  }

  const hasPair = Boolean(hyleg && alcoccoden);
  const differentia = assessDifferentiaSimplified(houses, bodies, hasPair);

  return {
    method: "Bonatti (práctico)",
    isDay,
    sectLabel: isDay ? "diurna" : "nocturna",
    lunation,
    hyleg,
    alcoccoden,
    years,
    differentia,
    attempts,
  };
}

export function buildVitalityResult(
  placeLabel,
  dateUtc,
  houses,
  bodies,
  localLabel,
  tzOffset,
  houseSystem,
  analysis
) {
  const dateUtcStr = dateUtc.toISOString().replace(".000Z", "Z");
  const tzLabel = tzOffset === 0 ? "UTC±0" : `UTC${tzOffset > 0 ? "+" : ""}${tzOffset}`;
  const { hyleg, alcoccoden, years, differentia, lunation, sectLabel, attempts } = analysis;

  const hylegLon =
    hyleg?.kind === "planet" ? hyleg.body.longitude : hyleg?.longitude;
  const hylegHtml = hyleg
    ? `<p class="vitality-hero__name">${hyleg.name}</p>
       <p class="vitality-hero__meta">${formatLon(hylegLon)}${
         hyleg.house != null || hyleg.body?.house
           ? ` · casa ${hyleg.house ?? hyleg.body.house}`
           : ""
       }</p>
       <p class="cusps-note">${hyleg.reason}</p>`
    : `<p class="vitality-hero__name">Sin Hyleg</p>
       <p class="cusps-note">Cálculo correcto: Bonatti no asigna dador de vida (p. ej. Sol/Luna cadentes sin otro punto válido). No es un error de la app.</p>`;

  const alcocHtml = alcoccoden
    ? `<p class="vitality-hero__name">${alcoccoden.glyph} ${alcoccoden.name}</p>
       <p class="vitality-hero__meta">${alcoccoden.body.sign} ${alcoccoden.body.degreesInSign} · casa ${alcoccoden.body.house}</p>
       <p class="cusps-note">Aspecto ${aspectLabel(alcoccoden.aspectAngle)} (orbe ${alcoccoden.aspectOrb.toFixed(1)}°) · dignidades: ${alcoccoden.dignityParts.join(", ")} (${alcoccoden.dignityScore} pts)</p>`
    : `<p class="cusps-note">Sin Alcoccoden (no hay planeta clásico con dignidad y aspecto al Hyleg).</p>`;

  const yearsHtml = years
    ? `<p class="vitality-years">${years.display}</p>
       <p class="cusps-note">${years.base.note} (${years.base.years} a base)</p>
       <ul class="vitality-adj">${years.adjustments
         .map(
           (a) =>
             `<li><span class="num">${a.kind === "add" ? "+" : "−"}</span> ${a.planet} ${a.aspect}: ${a.label}</li>`
         )
         .join("") || "<li>Sin ajustes por aspectos</li>"}</ul>`
    : `<p class="cusps-note">No se calculan años sin par Hyleg–Alcoccoden.</p>`;

  const attemptRows = attempts
    .map(
      (a) =>
        `<tr><td>${a.candidate}</td><td>${a.ok ? "candidato" : "descartado"}</td><td>${a.detail}</td></tr>`
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
        <dt>Secta</dt><dd>${sectLabel}</dd>
        <dt>Lunación previa</dt><dd>${lunation.label}${lunation.approximate ? " (aprox.)" : ""} · ${formatLon(lunation.longitude)}</dd>
        <dt>Método</dt><dd>${analysis.method}</dd>
      </dl>
    </div>
    <div class="result-block">
      <h2 class="result-heading">Differentia</h2>
      <p class="vitality-diff">${differentia.label}</p>
      <p class="cusps-note">${differentia.note}</p>
    </div>
    <div class="result-block">
      <h2 class="result-heading">Hyleg (dador de vida)</h2>
      <div class="vitality-hero">${hylegHtml}</div>
    </div>
    <div class="result-block">
      <h2 class="result-heading">Alcoccoden (dador de años)</h2>
      <div class="vitality-hero">${alcocHtml}</div>
    </div>
    <div class="result-block">
      <h2 class="result-heading">Años de vitalidad estimados</h2>
      ${yearsHtml}
      <p class="cusps-note">Estimación de fuerza vital / resiliencia del mapa (Brady), no predicción de deceso. La medicina moderna altera estos márgenes.</p>
    </div>
    <div class="result-block">
      <h2 class="result-heading">Búsqueda del Hyleg</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Candidato</th><th>Estado</th><th>Detalle</th></tr></thead>
          <tbody>${attemptRows}</tbody>
        </table>
      </div>
    </div>
  `;
}
