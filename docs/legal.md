# Marco jurídico del sistema

## Propósito del sistema

Este sistema produce **insumos para revisión humana** y eventual reclamación electoral,
no veredictos automáticos. Toda clasificación es descriptiva:

| Clasificación usada | Lo que NO se dice |
|---|---|
| `INCONSISTENCIA_ARITMETICA` | ~~fraude~~ |
| `DOCUMENTO_CON_ENMENDADURAS` | ~~alteración maliciosa~~ |
| `DIFERENCIA_PRECONTEO_E14` | ~~manipulación~~ |
| `CASO_PARA_REVISION_JURIDICA` | ~~resultado inválido~~ |

## Jerarquía de documentos electorales (Colombia)

1. **E-14** (Acta de escrutinio de mesa): documento primario, prevalece sobre el preconteo.
2. **Preconteo**: informativo, sin valor jurídico vinculante.
3. **E-24 / E-26**: actas de escrutinio zonal y departamental.
4. **Resultado oficial**: surge del **escrutinio** formal, no del preconteo.

## Causales de reclamación reconocidas

La Registraduría Nacional del Estado Civil establece que las siguientes situaciones pueden ser
causales para solicitar recuento ante la comisión escrutadora:

- **Tachaduras o enmendaduras** en el acta que generen duda sobre la exactitud de los cómputos.
- **Diferencias** entre el acta de mesa (E-14) y los registros del escrutinio.
- **Inconsistencias aritméticas** detectables en los totales del formulario.

## Quiénes pueden reclamar

Candidatos, partidos, movimientos y sus apoderados o testigos electorales **acreditados** ante
la Registraduría. El sistema genera evidencia de soporte; la decisión jurídica es siempre humana.

## Sobre el crawling de documentos oficiales

Los formularios E-14 son documentos públicos. El sistema los descarga bajo las siguientes
restricciones éticas y técnicas:

- **User-Agent identificado** (`ConteoAuditBot/0.1 + contacto`).
- **Rate-limit de cortesía**: máximo 1 petición/segundo al portal oficial.
- **Solo documentos públicos**: sin bypass de autenticación ni áreas restringidas.
- **Inmutabilidad**: cada descarga se sella con SHA-256, URL fuente y timestamp.
- **Sin reproducción masiva**: el sistema guarda punteros y metadatos, no colecciones.

## Limitaciones del sistema

- El OCR puede cometer errores. Las celdas con baja confianza se marcan explícitamente.
- Las anomalías estadísticas son indicios, no prueba de irregularidad.
- El sistema no evalúa causas (error humano, problema técnico, irregularidad intencional).
- La validez jurídica de una reclamación depende del proceso ante la comisión escrutadora.
