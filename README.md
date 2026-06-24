# Conteo — Auditoría Ciudadana E-14 · Colombia 2026

> Plataforma colaborativa para la revisión ciudadana de formularios E-14 de la segunda vuelta presidencial.

**Autor:** Iván Mosquera / [AsymmetricFrequency](https://github.com/AsymmetricFrequency)  
**Licencia:** MIT · Open Source · Colombia 2026

---

## ¿Qué es Conteo?

En Colombia, cada mesa de votación genera un formulario **E-14** — el documento legal que prevalece sobre cualquier resultado electrónico del preconteo. La Registraduría Nacional publica estos formularios escaneados en su portal oficial.

**Conteo** permite que cualquier ciudadano ayude a verificar esos formularios usando inteligencia artificial. El sistema descarga los PDFs oficiales, los analiza con visión artificial, los compara contra el preconteo oficial y construye una **cadena de evidencia verificable mesa por mesa**.

No hacemos afirmaciones sobre el resultado de la elección. Generamos evidencia estructurada para que candidatos, apoderados y testigos puedan formular **reclamaciones fundamentadas** ante el Consejo Nacional Electoral con base en el Código Electoral colombiano.

---

## Cómo puedes ayudar — sin saber programar

Todo ciudadano colombiano con acceso a internet puede contribuir. Solo necesitas **5 minutos y una cuenta gratuita de Google**.

### Paso 1 — Obtén tu API key gratuita

Ve a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) y crea una clave de API de Google Gemini. Es completamente gratuita y te permite procesar un número considerable de actas por día sin ningún costo.

### Paso 2 — Regístrate en Conteo

Crea una cuenta con tu email o con Google. No se requiere tarjeta de crédito.

### Paso 3 — Audita actas

1. Entra al panel `/auditar`
2. Ingresa tu API key de Gemini (se usa solo para el procesamiento del acta, nunca se guarda en nuestros servidores)
3. El sistema te asigna un formulario pendiente
4. Gemini analiza el PDF y extrae los datos automáticamente
5. Tú revisas, corriges si es necesario y confirmas
6. El resultado queda registrado con tu nombre como auditor

Tu API key procesa el acta **directamente desde tu navegador** hacia Google. Solo recibimos el resultado estructurado. Cada acta que auditas suma a la cobertura total.

### Comparte el proyecto

Cada auditor que se suma multiplica la velocidad de cobertura. Comparte el repositorio con tus contactos.

---

## Cómo funciona técnicamente

```
Registraduría (portal oficial)
        │
        ▼
  Indexación de PDFs E-14      ← scripts/pipeline-e14.ts
        │
        ▼
  OCR con Google Gemini        ← desde el navegador del auditor
        │
        ▼
  Validación aritmética        ← apps/api (NestJS)
  Comparación vs Preconteo
        │
        ▼
  Dashboard público            ← apps/web (Next.js)
  /mapa · /alertas · /auditar · /comparacion
```

**Tipos de inconsistencias detectadas:**

| Código | Descripción |
|--------|-------------|
| `INCONSISTENCIA_ARITMETICA` | La suma de votos no coincide con el total declarado en el acta |
| `DIFERENCIA_PRECONTEO_E14` | El acta difiere del preconteo oficial por encima del umbral configurado |
| `DOCUMENTO_CON_ENMENDADURAS` | Gemini detecta tachones, correcciones o superposiciones en el documento |
| `SOBRECAPACIDAD` | Los votos en urna superan los votantes habilitados según el censo |
| `INCINERADOS_IMPLAUSIBLES` | Los votos incinerados tienen una proporción inusual respecto a los votos en urna |

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Backend / API | NestJS (TypeScript) |
| Base de datos | PostgreSQL + Prisma |
| OCR / visión artificial | Google Gemini Flash (desde el navegador del auditor) |
| Frontend | Next.js 15 + Tailwind CSS |
| Autenticación | Supabase Auth (Google OAuth + Magic Link) |
| Mapas | react-simple-maps + GeoJSON oficial Colombia |
| Descarga de PDFs | Playwright (Firefox) con manejo de sesión |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | Vercel (web) + Railway (API) |

---

## Estructura del proyecto

```
apps/
  api/       NestJS — API REST, autenticación, gestión de actas
  web/       Next.js — dashboard, /auditar, /mapa, /alertas
  workers/   BullMQ — jobs de descarga y procesamiento (opcional)
packages/
  db/        Prisma schema (PostgreSQL)
  domain/    Motor de validaciones electorales (con tests)
scripts/
  pipeline-e14.ts       Indexación de formularios desde la Registraduría
  ingest-preconteo.ts   Importación de datos del preconteo oficial
services/
  analytics/  Python — detección de anomalías estadísticas
infra/
  docker-compose.yml    PostgreSQL + Redis para desarrollo local
```

---

## Instalación para desarrolladores

**Requisitos:** Node >= 20, pnpm >= 10, Docker

```bash
# 1. Clonar
git clone https://github.com/AsymmetricFrequency/Conteo.git
cd Conteo

# 2. Instalar dependencias
pnpm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env con tus credenciales (Supabase, base de datos, etc.)

# 4. Base de datos local
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @conteo/db migrate:dev

# 5. Levantar todos los servicios
pnpm dev
# API en http://localhost:3008
# Web en http://localhost:3007
```

---

## Contribuir como desarrollador

1. Haz fork y crea una rama descriptiva (`fix/claim-timeout`, `feat/mapa-alertas`)
2. Lee [`docs/arquitectura.md`](docs/arquitectura.md) para entender el flujo
3. El motor de validaciones está en `packages/domain` — tiene tests, agrega los tuyos
4. Toda alerta debe incluir evidencia verificable (imagen, hash, URL oficial)
5. Abre un Pull Request con descripción clara del impacto en la auditoría

**Áreas donde se necesita ayuda:**

- Mejora del prompt OCR para casos difíciles (actas con mala iluminación o manuscritos)
- Análisis estadístico avanzado de anomalías (`services/analytics`)
- Conectores alternativos de OCR (AWS Textract, Azure Document Intelligence)
- Internacionalización para la diáspora colombiana
- Tests de integración del pipeline completo

---

## Principios del proyecto

- **Evidencia, no acusación.** Generamos alertas para revisión humana, no veredictos automáticos.
- **Transparencia total.** El código, las reglas de detección y los resultados son públicos y auditables.
- **API key del usuario, no del proyecto.** Cada auditor usa su propia cuota y controla su privacidad.
- **Datos públicos.** Solo procesamos documentos publicados oficialmente por la Registraduría Nacional.
- **Sin datos de votantes.** Solo procesamos totales agregados por mesa, nunca información individual.

---

## Licencia

MIT © 2026 **Iván Mosquera** / AsymmetricFrequency

Este software se provee tal cual, sin garantías. Su propósito es facilitar la auditoría ciudadana de documentos públicos dentro del marco legal colombiano. La evidencia generada es un insumo para los mecanismos establecidos por el Código Electoral y el Consejo Nacional Electoral.
