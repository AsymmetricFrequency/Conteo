/**
 * @conteo/domain — Núcleo de dominio.
 *
 * Modelo del E-14, cadena de evidencia (hash/URL/timestamp), preconteo,
 * hallazgos/severidad, y el motor de validación determinístico con sus
 * reglas. Es agnóstico de framework: lo consumen la API, los workers y,
 * de ser necesario, el frontend.
 */
export * from "./geography";
export * from "./election";
export * from "./evidence";
export * from "./preconteo";
export * from "./findings";
export * from "./e14";
export * from "./hash";
export * from "./rules";
export * from "./engine";
