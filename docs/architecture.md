# Arquitectura del sistema

## Flujo de extremo a extremo

```
Portal oficial Registraduría
        │
        │  fetch(sourceUrl) — rate-limited, User-Agent identificado
        ▼
[Worker: crawler]
  → guarda binario en MinIO/S3 (storageKey)
  → calcula SHA-256 (sellado de evidencia)
  → encola job OCR {eleccion, ubicacion, candidatos, evidencia}
        │
        ▼
[Worker: ocr]
  → lee imagen desde object storage
  → llama proveedor OCR (Document AI / Textract / Azure DI / stub)
  → construye E14 normalizado (modelo de dominio)
  → POST /api/forms   ← único escritor de la cadena de custodia
        │
        ▼
[API NestJS: POST /api/forms]
  → valida E14 con Zod (esquema del dominio)
  → abre transacción Postgres
    → upsert Eleccion, Mesa, Candidatos
    → crea FormE14 + CandidatoVotos + Evidencia + Extraccion
    → corre motor de validación (@conteo/domain)
    → persiste ValidationReport + Findings
  → responde { formId, maxSeverity, findings }
        │
        ▼
[Dashboard: Next.js]
  GET /api/stats    → KPIs: total forms / severidad / estado
  GET /api/alerts   → cola de revisión humana (filtros por severidad, municipio, estado)
  PATCH /api/alerts/:id → registra decisión humana (CONFIRMADO / DESCARTADO / RECLAMADO)
        │
        ▼
[Analytics: FastAPI Python]
  POST /anomalies/detect  → z-scores participación, concentración, secuencias
  (los workers llaman al analytics service tras la ingesta de un municipio completo)
```

## Principios de diseño

**Evidencia primero**: el binario original se almacena antes de cualquier procesamiento.
Nunca se sobreescribe; sha256 + storageKey + capturedAt forman el sello.

**Un solo escritor**: la API NestJS es el único servicio que escribe en Postgres.
Workers y analytics solo leen o llaman a la API.

**Motor de reglas versionado**: `rulesVersion` se sella en cada `ValidationReport`.
Cambiar las reglas no altera reportes previos.

**Revisión humana obligatoria**: el sistema no toma decisiones. Cada `Finding` nace
en estado `PENDIENTE` y requiere acción humana para avanzar a `CONFIRMADO` o `RECLAMADO`.

## Paquetes compartidos

```
packages/domain/    Motor de validación + esquemas Zod (agnóstico de framework)
packages/db/        Cliente Prisma + schema (compartido por api y workers)
```

La lógica de negocio vive en `packages/domain`, no en el framework. Si en el
futuro se necesita extraer la API o los workers a otro stack, el núcleo no cambia.
