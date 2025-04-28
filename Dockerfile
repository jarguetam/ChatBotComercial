# Image size ~ 400MB
FROM node:21-alpine3.18 as builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

COPY package*.json *-lock.yaml ./

# Instalar dependencias de compilación
RUN apk add --no-cache --virtual .gyp \
    python3 \
    make \
    g++ \
    && apk add --no-cache git \
    && pnpm install

# Copiar el código y construir la aplicación
COPY . .
RUN pnpm run build \
    && apk del .gyp

FROM node:21-alpine3.18 as deploy

WORKDIR /app

# Configuración del puerto
ARG PORT=3008
ENV PORT=$PORT
EXPOSE $PORT

# Configuración de la zona horaria
ENV TZ=America/Guatemala
RUN apk add --no-cache tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# Copiar archivos necesarios desde la etapa de construcción
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.json /app/*-lock.yaml ./

# Configurar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate 
ENV PNPM_HOME=/usr/local/bin

# Instalar solo dependencias de producción
RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs

# Crear directorios para las sesiones y asignar permisos
RUN mkdir -p /app/bot_sessions /app/assets \
    && chown -R nodejs:nodejs /app/bot_sessions /app/assets

# Usar un usuario no root para mayor seguridad
USER nodejs

# Comando para iniciar la aplicación
CMD ["npm", "start"]