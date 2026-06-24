# CONTEO — Auditoría Ciudadana E-14 · Colombia 2026

**Auditemos juntos los 121,951 formularios E-14 de la segunda vuelta presidencial.**

> Un acta. Un ciudadano. Un grano de arena para la democracia.

Autor: **Iván Mosquera** / [AsymmetricFrequency](https://github.com/AsymmetricFrequency)  
Licencia: MIT · Open Source · Colombia

---

## ¿Qué es Conteo?

Colombia celebra su segunda vuelta presidencial en 2026 entre **Iván Cepeda Castro** y **Abelardo De la Espriella**. Cada mesa de votación genera un formulario **E-14** — el documento legal que prevalece sobre cualquier resultado electrónico del preconteo.

La Registraduría publicó los **121,951 formularios E-14** escaneados en su portal oficial. Cada uno puede tener discrepancias respecto al preconteo: errores de transcripción, tachones, o en casos extremos, alteración deliberada de números.

**Conteo** descarga esos formularios, los analiza con visión artificial (Google Gemini), los compara contra el preconteo oficial y construye una **cadena de evidencia verificable** mesa por mesa.

No afirmamos fraude. Generamos evidencia estructurada para que candidatos, apoderados y testigos puedan formular **reclamaciones fundamentadas** ante el Consejo Nacional Electoral.

---

## Lo que ya encontramos

Con solo 45 actas analizadas en Antioquia, las diferencias entre el E-14 DELEGADOS y el preconteo oficial son notables:

| Municipio | Cepeda en E-14 | Cepeda en preconteo | Diferencia |
|-----------|---------------|---------------------|------------|
| MACEO | 39.5% | 24.6% | **+14.9 pp** |
| LA CEJA | 14.6% | 26.6% | **-12.0 pp** |
| APARTADO | — | — | **+10.4 pp** |
| BELLO | — | — | **+9.3 pp** |
| SAN VICENTE | — | — | **+7.6 pp** |

Faltan 121,906 actas por analizar. Ahí está el trabajo.

---

## Cómo puedes ayudar — sin saber programar

Todo colombiano con acceso a internet puede contribuir. Solo necesitas **5 minutos y una cuenta gratuita de Google**.

### Paso 1 — Obtén tu API key gratuita

Ve a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) y crea una clave de API de Google Gemini. Es completamente gratis. El tier gratuito te permite procesar hasta **~500 actas por día** sin ningún costo.

### Paso 2 — Regístrate en Conteo

Crea una cuenta en la plataforma con tu email. No necesitas tarjeta de crédito ni datos sensibles.

### Paso 3 — Audita actas

1. Entra al panel `/auditar`
2. Ingresa tu API key de Gemini (nunca se guarda en nuestro servidor — se usa solo desde tu navegador)
3. El sistema te asigna una acta pendiente
4. Gemini analiza el PDF y extrae los números automáticamente
5. Tú revisas, corriges si es necesario, y confirmas
6. ¡Listo! El resultado queda registrado con tu nombre como auditor

Tu API key procesa el acta **directamente desde tu navegador** hacia Google. Nosotros solo recibimos el resultado estructurado. Cada acta que auditas suma a la cobertura total.

### Comparte el proyecto

Cada auditor que se suma multiplica la velocidad de cobertura. Comparte el repositorio y pide a tus contactos que contribuyan su grano de arena.

---

## Cómo funciona técnicamente

```
Registraduría (portal oficial)
        |
        v
  Descarga de PDFs E-14       ← scripts/pipeline-e14.ts
        |
        v
  OCR con Google Gemini Flash  ← desde el navegador del auditor
        |
        v
  Validación aritmética        ← apps/api (NestJS)
  Comparación vs Preconteo
        |
        v
  Dashboard público            ← apps/web (Next.js)
  /comparacion · /alertas · /auditar
```

**Métodos de detección de inconsistencias:**

| Código | Descripción |
|--------|-------------|
| `INCONSISTENCIA_ARITMETICA` | La suma de votos no coincide con el total declarado en el acta |
| `DIFERENCIA_PRECONTEO_E14` | El acta difiere del preconteo oficial en más de 3 puntos porcentuales |
| `DOCUMENTO_CON_ENMENDADURAS` | Gemini detecta tachones, correcciones o superposiciones |
| `SOBRECAPACIDAD` | Los votos en urna superan los votantes habilitados en el E-11 |
| `INCINERADOS_IMPLAUSIBLES` | Los votos incinerados son iguales o mayores a los votos en urna |

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Backend / API | NestJS (TypeScript) |
| Base de datos | PostgreSQL + Prisma |
| OCR / visión artificial | Google Gemini Flash 1.5 (desde el navegador) |
| Frontend | Next.js 15 + Tailwind CSS |
| Autenticación | Supabase Auth (Google OAuth + Magic Link) |
| Descarga de PDFs | Playwright (Firefox) + sesión Akamai |
| Monorepo | pnpm workspaces + Turborepo |

---

## Estructura del proyecto

```
apps/
  api/       NestJS — API REST, auth JWT, claim/submit de actas
  web/       Next.js — dashboard, /auditar, /comparacion, /alertas
  workers/   BullMQ — jobs de descarga y procesamiento
packages/
  db/        Prisma schema (PostgreSQL)
  domain/    Motor de validaciones electorales (con tests)
scripts/
  pipeline-e14.ts   Descarga masiva de PDFs desde Registraduría
  ocr_gemini.py     OCR por lotes con Gemini Flash (para contribuidores con servidor)
  ingest-preconteo.ts  Importación de datos del preconteo oficial
services/
  analytics/ Python — detección de anomalías estadísticas (z-scores)
infra/
  docker-compose.yml  Postgres + Redis para desarrollo local
```

---

## Instalación para desarrolladores

**Requisitos:** Node >= 20, pnpm >= 9, Docker (para la infra local)

```bash
# 1. Clonar
git clone https://github.com/AsymmetricFrequency/Conteo.git
cd Conteo

# 2. Instalar dependencias
pnpm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env: agregar GOOGLE_API_KEY y DATABASE_URL

# 4. Base de datos local
docker compose -f infra/docker-compose.yml up -d
cd packages/db && npx prisma migrate dev

# 5. Levantar todos los servicios
pnpm dev
# API en http://localhost:3008
# Web en http://localhost:3007
```

### Descargar actas para procesar (sin OCR)

```bash
# Descarga 500 actas de Antioquia (departamento 01)
npx tsx scripts/pipeline-e14.ts download 500 01

# OCR por lotes con tu Gemini key (modo servidor)
export GOOGLE_API_KEY="tu_key_de_aistudio"
python3 scripts/ocr_gemini.py run 500
```

---

## Cómo contribuir como desarrollador

1. Haz fork y crea una rama descriptiva (`fix/claim-timeout`, `feat/mapa-alertas`)
2. Lee [`docs/arquitectura.md`](docs/arquitectura.md) para entender el flujo
3. El motor de validaciones está en `packages/domain` — tiene tests, agrega los tuyos
4. Toda alerta debe incluir evidencia verificable (imagen, hash, URL original)
5. Abre un Pull Request con descripción clara del impacto en la auditoría

**Áreas donde se necesita ayuda:**

- Mejora del prompt OCR para casos difíciles (actas con mala iluminación)
- Mapa visual de alertas por municipio/departamento
- Conectores alternativos de OCR (AWS Textract, Azure Document Intelligence)
- Análisis estadístico avanzado de anomalías (`services/analytics`)
- Internacionalización para que la diáspora colombiana pueda auditar desde el exterior

---

## Principios del proyecto

- **Evidencia, no acusación.** Generamos alertas para revisión humana, no veredictos.
- **Transparencia total.** El código, las reglas y los resultados son públicos y auditables.
- **API key del usuario, no del proyecto.** Tú controlas tu cuota y tu privacidad.
- **Datos públicos.** Solo procesamos documentos publicados oficialmente por la Registraduría.
- **Sin datos de votantes.** Solo procesamos totales agregados por mesa, nunca datos individuales.

---

## Licencia

MIT © 2026 **Iván Mosquera** / AsymmetricFrequency

Este software se provee tal cual, sin garantías. Su uso para difamar candidatos sin fundamento o para actividades ilegales va en contra del espíritu del proyecto. La evidencia generada es un insumo para los mecanismos legales establecidos por el Código Electoral colombiano y el Consejo Nacional Electoral.
