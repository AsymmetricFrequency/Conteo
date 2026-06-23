# Infraestructura local

```bash
# Levantar Postgres + Redis + MinIO
docker compose up -d

# Verificar
docker compose ps
```

## Servicios

| Servicio | Puerto | Credenciales |
|---|---|---|
| PostgreSQL (PostGIS) | 5432 | conteo / conteo |
| Redis | 6379 | — |
| MinIO API | 9000 | minioadmin / minioadmin |
| MinIO Console | 9001 | minioadmin / minioadmin |

## Primera vez

```bash
# 1. Levantar servicios
docker compose up -d

# 2. Crear bucket de evidencia en MinIO
#    (o via consola en http://localhost:9001)
docker exec conteo_minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec conteo_minio mc mb local/conteo-evidence

# 3. Correr migraciones Prisma
pnpm --filter @conteo/db migrate:dev

# 4. Semilla de demostración
pnpm --filter @conteo/db seed
```
