/**
 * Coordenadas aproximadas de capitales de departamento (PY/UY) / provincia (AR).
 * Suficiente para carta natal a nivel regional cuando no hay ciudad exacta.
 */

export const LOCATION_COUNTRIES = {
  Paraguay: {
    regionLabel: "Departamento",
    timeZone: "America/Asuncion",
    regions: [
      { id: "asuncion", name: "Asunción (capital)", lat: -25.2865, lon: -57.647 },
      { id: "concepcion", name: "Concepción", lat: -23.4064, lon: -57.4344 },
      { id: "san-pedro", name: "San Pedro", lat: -24.0889, lon: -57.0764 },
      { id: "cordillera", name: "Cordillera", lat: -25.3864, lon: -57.1403 },
      { id: "guaira", name: "Guairá", lat: -25.7817, lon: -56.4514 },
      { id: "caaguazu", name: "Caaguazú", lat: -25.45, lon: -56.0167 },
      { id: "caazapa", name: "Caazapá", lat: -26.2, lon: -56.3667 },
      { id: "itapua", name: "Itapúa", lat: -27.3306, lon: -55.8667 },
      { id: "misiones", name: "Misiones", lat: -27.1167, lon: -57.0333 },
      { id: "paraguari", name: "Paraguarí", lat: -25.6333, lon: -57.15 },
      { id: "alto-parana", name: "Alto Paraná", lat: -25.5097, lon: -54.6111 },
      { id: "central", name: "Central", lat: -25.3411, lon: -57.5203 },
      { id: "neembucu", name: "Ñeembucú", lat: -26.8667, lon: -58.3 },
      { id: "amambay", name: "Amambay", lat: -22.5472, lon: -55.7333 },
      { id: "canindeyu", name: "Canindeyú", lat: -24.1333, lon: -54.3333 },
      { id: "presidente-hayes", name: "Presidente Hayes", lat: -23.45, lon: -58.8333 },
      { id: "alto-paraguay", name: "Alto Paraguay", lat: -21.05, lon: -57.8667 },
      { id: "boqueron", name: "Boquerón", lat: -22.55, lon: -60.0333 },
    ],
  },
  Argentina: {
    regionLabel: "Provincia",
    timeZone: "America/Argentina/Buenos_Aires",
    regions: [
      { id: "caba", name: "CABA", lat: -34.6037, lon: -58.3816 },
      { id: "buenos-aires", name: "Buenos Aires", lat: -34.9215, lon: -57.9545 },
      { id: "catamarca", name: "Catamarca", lat: -28.4696, lon: -65.7852 },
      { id: "chaco", name: "Chaco", lat: -27.4514, lon: -58.9867 },
      { id: "chubut", name: "Chubut", lat: -43.3002, lon: -65.1023 },
      { id: "cordoba", name: "Córdoba", lat: -31.4201, lon: -64.1888 },
      { id: "corrientes", name: "Corrientes", lat: -27.4692, lon: -58.8306 },
      { id: "entre-rios", name: "Entre Ríos", lat: -31.7413, lon: -60.5115 },
      { id: "formosa", name: "Formosa", lat: -26.1852, lon: -58.1758 },
      { id: "jujuy", name: "Jujuy", lat: -24.1858, lon: -65.2995 },
      { id: "la-pampa", name: "La Pampa", lat: -36.6167, lon: -64.2833 },
      { id: "la-rioja", name: "La Rioja", lat: -29.4131, lon: -66.8558 },
      { id: "mendoza", name: "Mendoza", lat: -32.8895, lon: -68.8458 },
      { id: "misiones", name: "Misiones", lat: -27.3671, lon: -55.8961 },
      { id: "neuquen", name: "Neuquén", lat: -38.9516, lon: -68.0591 },
      { id: "rio-negro", name: "Río Negro", lat: -40.8135, lon: -62.9967 },
      { id: "salta", name: "Salta", lat: -24.7859, lon: -65.4117 },
      { id: "san-juan", name: "San Juan", lat: -31.5375, lon: -68.5364 },
      { id: "san-luis", name: "San Luis", lat: -33.3017, lon: -66.3378 },
      { id: "santa-cruz", name: "Santa Cruz", lat: -51.623, lon: -69.2168 },
      { id: "santa-fe", name: "Santa Fe", lat: -31.6333, lon: -60.7 },
      { id: "santiago-del-estero", name: "Santiago del Estero", lat: -27.7951, lon: -64.2615 },
      { id: "tierra-del-fuego", name: "Tierra del Fuego", lat: -54.8019, lon: -68.303 },
      { id: "tucuman", name: "Tucumán", lat: -26.8083, lon: -65.2176 },
    ],
  },
  Uruguay: {
    regionLabel: "Departamento",
    timeZone: "America/Montevideo",
    regions: [
      { id: "montevideo", name: "Montevideo (capital)", lat: -34.9011, lon: -56.1645 },
      { id: "artigas", name: "Artigas", lat: -30.4, lon: -56.4667 },
      { id: "canelones", name: "Canelones", lat: -34.5228, lon: -56.2778 },
      { id: "cerro-largo", name: "Cerro Largo", lat: -32.37, lon: -54.2 },
      { id: "colonia", name: "Colonia", lat: -34.4714, lon: -57.8442 },
      { id: "durazno", name: "Durazno", lat: -33.3806, lon: -56.5236 },
      { id: "flores", name: "Flores", lat: -33.5167, lon: -56.9 },
      { id: "florida", name: "Florida", lat: -34.0956, lon: -56.2142 },
      { id: "lavalleja", name: "Lavalleja", lat: -34.3759, lon: -55.2377 },
      { id: "maldonado", name: "Maldonado", lat: -34.9, lon: -54.95 },
      { id: "paysandu", name: "Paysandú", lat: -32.3214, lon: -58.0756 },
      { id: "rio-negro", name: "Río Negro", lat: -33.1325, lon: -58.2958 },
      { id: "rivera", name: "Rivera", lat: -30.9053, lon: -55.5508 },
      { id: "rocha", name: "Rocha", lat: -34.4833, lon: -54.3333 },
      { id: "salto", name: "Salto", lat: -31.3833, lon: -57.9667 },
      { id: "san-jose", name: "San José", lat: -34.3375, lon: -56.7136 },
      { id: "soriano", name: "Soriano", lat: -33.2524, lon: -58.0305 },
      { id: "tacuarembo", name: "Tacuarembó", lat: -31.7333, lon: -55.9833 },
      { id: "treinta-y-tres", name: "Treinta y Tres", lat: -33.2333, lon: -54.3833 },
    ],
  },
};

export function getCountryRegions(country) {
  return LOCATION_COUNTRIES[country]?.regions ?? [];
}

export function getRegionLabel(country) {
  return LOCATION_COUNTRIES[country]?.regionLabel ?? "Región";
}

export function findRegion(country, regionId) {
  return getCountryRegions(country).find((r) => r.id === regionId) ?? null;
}

export function getCountryTimeZone(country) {
  return LOCATION_COUNTRIES[country]?.timeZone ?? null;
}

/**
 * Offset UTC en horas (p. ej. -3) para una fecha/hora civil en la zona IANA.
 * Usa las reglas históricas del navegador (DST incluido).
 */
export function offsetHoursForTimeZone(timeZone, dateStr, timeStr) {
  if (!timeZone || !dateStr || !timeStr) return NaN;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":");
  const hh = Number(timeParts[0] ?? 0);
  const mm = Number(timeParts[1] ?? 0);
  const ss = Number(timeParts[2] ?? 0);
  if ([y, mo, d, hh, mm, ss].some((n) => Number.isNaN(n))) return NaN;

  const localAsUtcMs = Date.UTC(y, mo - 1, d, hh, mm, ss);
  let guessMs = localAsUtcMs;

  for (let i = 0; i < 3; i += 1) {
    const offsetMs = zoneOffsetMsAt(timeZone, guessMs);
    if (Number.isNaN(offsetMs)) return NaN;
    guessMs = localAsUtcMs - offsetMs;
  }

  const offsetMs = zoneOffsetMsAt(timeZone, guessMs);
  if (Number.isNaN(offsetMs)) return NaN;
  return offsetMs / 3_600_000;
}

function zoneOffsetMsAt(timeZone, utcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const hour = Number(map.hour) % 24;
  const asUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUtcMs - utcMs;
}

/** Fallback aproximado por longitud cuando no hay país (±15° ≈ 1 h). */
export function estimateOffsetFromLongitude(lon) {
  if (Number.isNaN(lon) || lon < -180 || lon > 180) return NaN;
  return Math.round(lon / 15);
}

/**
 * Resuelve el huso cuando el usuario no lo eligió: país (+ fecha) o longitud.
 */
export function resolveImplicitUtcOffset({ country, dateStr, timeStr, lon }) {
  const zone = getCountryTimeZone(country);
  if (zone) {
    const fromZone = offsetHoursForTimeZone(zone, dateStr, timeStr);
    if (!Number.isNaN(fromZone)) return fromZone;
  }
  return estimateOffsetFromLongitude(lon);
}
