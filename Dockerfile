# Etapa 1: Build
FROM node:21-slim AS builder
WORKDIR /app

# Instalar dependencias necesarias para sharp
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de configuración del proyecto
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas las dependencias, incluyendo las de desarrollo
RUN npm install

# Copiar el código fuente
COPY . .

# Compilar el proyecto
RUN npm run build

# Etapa 2: Producción
FROM node:21-slim
WORKDIR /app

# Instalar dependencias necesarias para sharp en producción
RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno para sharp
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_sharp_libvips_binary_host="https://npmmirror.com/mirrors/sharp-libvips"

# Copiar los archivos compilados y package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Instalar solo dependencias de producción con retry para mayor estabilidad
RUN npm install --omit=dev || npm install --omit=dev || npm install --omit=dev

# Comando para iniciar la aplicación
CMD ["node", "dist/app.js"]