# ---------- Etapa de build ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Prisma necesita OpenSSL para su motor de consultas. Las imágenes Alpine
# (musl) requieren pasos extra y son propensas a errores de detección de
# versión; usamos Debian slim (glibc) e instalamos openssl explícitamente.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Precompilar el script de seed a JavaScript plano (en vez de ejecutarlo con
# ts-node en producción). Esto evita un problema de versiones recientes de
# Node: al detectar sintaxis "import" en el archivo, intentan cargarlo como
# ESM nativo y fallan con ERR_UNKNOWN_FILE_EXTENSION para archivos .ts,
# pasando por encima de cualquier hook de ts-node.
RUN npx tsc prisma/seed.ts --outDir dist-seed --module commonjs --target ES2021 --esModuleInterop --skipLibCheck --resolveJsonModule

# ---------- Etapa de producción ----------
FROM node:20-bookworm-slim AS production
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-seed ./dist-seed
COPY assets ./assets

# NODE_ENV se fija DESPUÉS de "npm install": si se fija antes, npm omite
# las devDependencies automáticamente (aunque no se use --omit=dev), y
# "ts-node" (necesario para el seed) nunca se instala.
ENV NODE_ENV=production

EXPOSE 3000

# Primer despliegue: se usa "prisma db push" para sincronizar el esquema
# directamente (no requiere migraciones pre-generadas). Para un flujo de
# migraciones versionadas en producción, genera la migración inicial con
# `npx prisma migrate dev --name init` en tu entorno (ver README) y cambia
# este comando a `npx prisma migrate deploy`.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (node dist-seed/seed.js || echo 'ADVERTENCIA: el seed falló, revisa los logs. La API arrancará igual.') && node dist/main"]
