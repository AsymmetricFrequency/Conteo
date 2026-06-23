# CONTEO — Auditoría Ciudadana E-14 · Colombia 2026

**Sistema colaborativo de auditoría electoral open source**

> Auditamos cada acta E-14 de la segunda vuelta presidencial 2026, mesa por mesa,
> con inteligencia artificial y verificación humana distribuida.

Autor: **Iván Mosquera** / [AsymmetricFrequency](https://github.com/AsymmetricFrequency)
Licencia: MIT

---

## Misión

Colombia celebra su segunda vuelta presidencial en 2026. Existen **121 mil mesas de
votación**, cada una con un formulario E-14 firmado por testigos y depositado en la
Registraduría. Este formulario es el documento jurídico que prevalece sobre cualquier
resultado del preconteo electrónico.

**Conteo** es un sistema open source de auditoría ciudadana que descarga los E-14
oficiales publicados por la Registraduría, los procesa con visión artificial, los compara
contra el preconteo oficial y construye una **cadena de evidencia verificable** mesa por
mesa. Cualquier ciudadano puede contribuir su clave de API de Gemini para acelerar el
procesamiento sin costo masivo para el proyecto.

No declaramos fraude automáticamente. Generamos evidencia estructurada para que
**candidatos, apoderados y testigos acreditados** puedan formular reclamaciones
fundamentadas ante las autoridades electorales.

---

## Metodos de deteccion de inconsistencias

El motor de validaciones (`packages/domain`) aplica las siguientes reglas sobre cada
acta procesada:

| Codigo | Descripcion |
|--------|-------------|
| `INCONSISTENCIA_ARITMETICA` | La suma de votos por candidato no coincide con el total declarado en el acta |
| `POSIBLE_ERROR_DILIGENCIAMIENTO` | Campos requeridos en blanco, ilegibles o con valores fuera de rango |
| `DOCUMENTO_CON_ENMENDADURAS` | El modelo de vision detecta tachones, correcciones o superposiciones |
| `DIFERENCIA_PRECONTEO_E14` | Los votos del preconteo difieren de los del E-14 en mas de la tolerancia permitida |
| `CASO_PARA_REVISION_JURIDICA` | Combinacion de alertas que supera el umbral de prioridad para revisión humana |

Adicionalmente se aplican analíticas estadísticas (z-scores por municipio y departamento)
para detectar mesas con distribuciones de votos atípicas frente a su entorno geográfico.

Toda alerta incluye: imagen original, texto extraído, regla aplicada, version del motor
de reglas, timestamp y hash SHA-256 del documento fuente.

---

## Modelo comunitario — Contribuye tu API key

El procesamiento de 121 mil actas con Google Gemini Flash cuesta aproximadamente
**$9–18 USD** en el tier de pago, o es **gratuito** si se distribuye entre suficientes
voluntarios usando el tier gratuito de Google AI Studio (15 req/min, 1 millón de tokens
por día por clave).

**Como funciona:**

1. Un auditor ciudadano se registra en `/login` con su email.
2. Obtiene una clave de API gratuita en [aistudio.google.com](https://aistudio.google.com/app/apikey).
3. Ingresa su clave en el panel `/auditar`.
4. El sistema le asigna un lote de actas sin procesar.
5. Las actas son procesadas desde el navegador o el servidor usando su cuota gratuita.
6. Los resultados se publican de forma transparente en el dashboard público.

Tu clave nunca se comparte con terceros y solo se usa para consultas al API de Gemini
para OCR de actas públicas de la Registraduría.

---

## Arquitectura

```
Portales oficiales Registraduría
        |
        +-- Crawler E-14 / E-24 / E-26      (apps/workers)
        +-- Captura de resultados preconteo (apps/workers)
        +-- Ingesta de fotos de testigos    (backend / apps/api)
                  |
                  v
         Object Storage inmutable           (infra: MinIO/S3/R2)
     PDF / JPG original + SHA-256 + URL
                  |
                  v
      OCR + vision documental               (apps/workers + Gemini Flash)
                  |
                  v
      Motor de validaciones electorales      (packages/domain)  <- nucleo
   aritmetica + consistencia + geografía
                  |
                  v
       Motor de alertas y priorizacion        (packages/domain)
                  |
                  v
 Dashboard publico / mesa / municipio    (frontend / apps/web)
                  |
   Analitica de anomalias (z-scores, etc.)    (services/analytics)
```

---

## Stack tecnologico

| Capa | Tecnologia |
|------|------------|
| API interna + conectores | NestJS (TypeScript) |
| Procesamiento asincrono | BullMQ + Redis |
| Base transaccional | PostgreSQL (+ PostGIS opcional) |
| Archivos originales | S3 / Cloudflare R2 / MinIO |
| OCR / vision | Google Gemini Flash (`gemini-2.0-flash`) |
| Validacion deterministica | TypeScript (`packages/domain`) |
| Analitica de anomalias | Python + Pandas + scikit-learn |
| Frontend | Next.js + Tailwind CSS |
| Autenticacion | JWT |
| Auditoria | SHA-256 + timestamp + URL + version OCR + version de reglas |

---

## Estructura del monorepo

```
backend/         NestJS — API interna + conectores oficiales + ingesta (alias de apps/api)
frontend/        Next.js — dashboard, visor comparativo, mapa (alias de apps/web)
apps/
  api/           NestJS (fuente)
  workers/       BullMQ — crawler, OCR, validacion, comparacion preconteo<->E-14
  web/           Next.js (fuente)
services/
  analytics/     Python — deteccion de anomalias estadisticas
packages/
  domain/        Tipos, esquemas (Zod) y MOTOR DE VALIDACION (nucleo, con tests)
infra/           docker-compose (Postgres+PostGIS, Redis, MinIO) y semillas
docs/            arquitectura, modelo de datos y marco juridico
```

---

## Requisitos

- Node >= 20 (probado en 23)
- pnpm >= 9 (`corepack enable`)
- Python >= 3.11 (para `services/analytics`)
- Docker (opcional, para `infra/`)

---

## Instalacion y arranque rapido

```bash
# 1. Clonar el repositorio
git clone https://github.com/AsymmetricFrequency/conteo.git
cd conteo

# 2. Instalar dependencias del monorepo
pnpm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env y agregar tu GOOGLE_API_KEY (gratis en aistudio.google.com)

# 4. Infra local (Postgres, Redis, MinIO) — requiere Docker
docker compose -f infra/docker-compose.yml up -d

# 5. Probar el nucleo (motor de validacion) — no requiere infra
pnpm --filter @conteo/domain test

# 6. Levantar todos los servicios
pnpm dev
```

El dashboard estara disponible en `http://localhost:3000`.
La API interna en `http://localhost:3001`.

---

## Como contribuir como desarrollador

1. Haz fork del repositorio y crea una rama descriptiva (`feature/ocr-gemini-batch`).
2. Lee [`docs/arquitectura.md`](docs/arquitectura.md) para entender el flujo de datos.
3. El nucleo de validaciones esta en `packages/domain` — tiene tests, agrega los tuyos.
4. Mantén las alertas **verificables**: toda alerta debe incluir su evidencia original.
5. Abre un Pull Request con descripcion clara del cambio y su impacto en la auditoria.

Areas prioritarias donde se necesita ayuda:

- Mejora del prompt de extraccion OCR para Gemini Flash
- Conectores para nuevos proveedores de OCR (AWS Textract, Azure Document Intelligence)
- Analítica estadistica avanzada (`services/analytics`)
- Interfaz de revision humana en el dashboard
- Crawler robusto para descarga de E-14 desde la Registraduria

---

## Como contribuir como auditor ciudadano

No necesitas saber programar para contribuir a la auditoria:

1. **Registrate** en [conteo.vercel.app](https://conteo.vercel.app) con tu email.
2. **Obtén tu API key gratuita** de Google Gemini en [aistudio.google.com](https://aistudio.google.com/app/apikey). Es gratis.
3. **Entra al panel de auditoria** en `/auditar` e ingresa tu clave.
4. El sistema te asignara un lote de actas. Tu cuota diaria procesa ~500 actas sin costo.
5. **Revisa las alertas** generadas y marca las que consideras relevantes para reclamacion.
6. Comparte el proyecto con otros ciudadanos para ampliar la cobertura.

---

## Etica y limites legales

- **Crawler controlado**: respetamos los limites de la Registraduria, conservamos URL,
  fecha, hash y archivo original. Solo descargamos documentos **publicos**.
- **No afirmamos fraude**: generamos evidencia estructurada para revision juridica humana.
- **Transparencia total**: los algoritmos, reglas y versiones son open source y auditables.
- **Datos personales**: no almacenamos datos de votantes. Solo procesamos totales por mesa.

Ver [`docs/legal.md`](docs/legal.md) para el marco juridico colombiano aplicable.

---

## Licencia

MIT © 2026 Iván Mosquera / AsymmetricFrequency

Este software se provee tal cual, sin garantias. El uso de esta herramienta para
actividades ilegales o para difamar candidatos sin fundamento va en contra del espiritu
del proyecto. La evidencia generada es un insumo para los mecanismos legales establecidos
por el Codigo Electoral colombiano y el Consejo Nacional Electoral.
