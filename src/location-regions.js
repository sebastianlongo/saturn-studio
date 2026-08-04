/**
 * Coordenadas aproximadas de capitales de departamento (PY) / provincia (AR).
 * Suficiente para carta natal a nivel regional cuando no hay ciudad exacta.
 */

export const LOCATION_COUNTRIES = {
  Paraguay: {
    regionLabel: "Departamento",
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
