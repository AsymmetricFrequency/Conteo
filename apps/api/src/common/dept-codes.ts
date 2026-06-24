/** Registraduría department code → DANE department code */
export const REG_TO_DANE: Record<string, string> = {
  "01": "05", // Antioquia
  "03": "08", // Atlántico
  "05": "13", // Bolívar
  "07": "15", // Boyacá
  "09": "17", // Caldas
  "11": "19", // Cauca
  "12": "20", // Cesar
  "13": "23", // Córdoba
  "15": "25", // Cundinamarca
  "16": "11", // Bogotá D.C.
  "17": "27", // Chocó
  "19": "41", // Huila
  "21": "47", // Magdalena
  "23": "52", // Nariño
  "24": "66", // Risaralda
  "25": "54", // Norte de Santander
  "26": "63", // Quindío
  "27": "68", // Santander
  "28": "70", // Sucre
  "29": "73", // Tolima
  "31": "76", // Valle del Cauca
  "40": "81", // Arauca
  "44": "18", // Caquetá
  "46": "85", // Casanare
  "48": "44", // La Guajira
  "50": "94", // Guainía
  "52": "50", // Meta
  "54": "95", // Guaviare
  "56": "88", // San Andrés y Providencia
  "60": "91", // Amazonas
  "64": "86", // Putumayo
  "68": "97", // Vaupés
  "72": "99", // Vichada
  // "88" = Consulados: no DANE equivalent, omitted intentionally
};

/** DANE department code → Registraduría department code */
export const DANE_TO_REG: Record<string, string> = Object.fromEntries(
  Object.entries(REG_TO_DANE).map(([reg, dane]) => [dane, reg]),
);
