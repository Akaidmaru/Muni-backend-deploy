# Producción: NestJS + Prisma migrate (Node 20)
# Credenciales y URLs en runtime (env del contenedor / Ansible), no en la imagen.

FROM node:20-bookworm-slim AS build
WORKDIR /app

# Instalar OpenSSL para Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Prisma necesita DATABASE_URL para generate, usamos dummy para build
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Instalar OpenSSL para Prisma en runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

LABEL org.opencontainers.image.title="transport-backend"
LABEL org.opencontainers.image.description="NestJS API (Transportes)"

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

RUN npm prune --omit=dev && npm install prisma --no-save \
  && chown -R node:node /app

USER node

EXPOSE 3000

# Swagger en /api-docs (misma ruta que en main.ts)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api-docs',r=>process.exit(r.statusCode===200||r.statusCode===301||r.statusCode===302?0:1)).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
