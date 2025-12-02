# ================================
# Dockerfile para Sinapsis Data
# Next.js 14 + Prisma + PostgreSQL
# ================================

# ----- Base -----
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ----- Dependencies -----
FROM base AS deps

# Copiar package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci

# Generar Prisma Client
RUN npx prisma generate

# ----- Builder -----
FROM base AS builder
WORKDIR /app

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de build (se sobrescriben en runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build de la aplicación
RUN npm run build

# ----- Runner -----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos necesarios
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copiar build de Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar node_modules para Prisma
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# Crear directorio para uploads
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Script de inicio que ejecuta migraciones y arranca el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
