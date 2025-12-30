# Multi-stage build para optimizar tamaño de imagen

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias (incluye dev dependencies para el build)
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar código compilado desde builder
COPY --from=builder /app/dist ./dist

# Exponer puerto (Railway usa PORT variable de entorno)
EXPOSE 3001

# Usuario no root para seguridad
USER node

# Comando de inicio
CMD ["node", "dist/index.js"]
