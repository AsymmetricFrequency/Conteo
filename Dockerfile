FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Manifests first — Docker layer cache
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json         packages/db/
COPY apps/api/package.json            apps/api/

RUN pnpm install --frozen-lockfile

# Source
COPY packages/ packages/
COPY apps/api/ apps/api/

# Build (domain → db → api)
RUN pnpm --filter @conteo/domain build
RUN pnpm --filter @conteo/db build
RUN pnpm --filter @conteo/api build

ENV NODE_ENV=production
EXPOSE 3008

CMD ["sh", "-c", "pnpm --filter @conteo/db migrate:deploy && node apps/api/dist/main.js"]
