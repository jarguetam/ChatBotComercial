#!/bin/bash

# Script para desplegar el chatbot comercial en un servidor Ubuntu
# Uso: ./deploy-ubuntu.sh

# Colores para la salida
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Chatbot Comercial - Script de Despliegue ===${NC}"
echo -e "${YELLOW}Este script configurará Docker y desplegará la aplicación${NC}"
echo ""

# Verificar si se ejecuta como root o con sudo
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Por favor ejecuta este script como root o con sudo${NC}"
  exit 1
fi

# Actualizar repositorios
echo -e "${GREEN}Actualizando repositorios...${NC}"
apt-get update

# Instalar dependencias
echo -e "${GREEN}Instalando dependencias necesarias...${NC}"
apt-get install -y apt-transport-https ca-certificates curl software-properties-common

# Verificar e instalar Docker si no está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${GREEN}Instalando Docker...${NC}"
    
    # Agregar la clave GPG oficial de Docker
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Agregar el repositorio de Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Actualizar y instalar Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Instalar Docker Compose
    echo -e "${GREEN}Instalando Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Habilitar y arrancar Docker
    systemctl enable docker
    systemctl start docker
    
    echo -e "${GREEN}Docker instalado correctamente${NC}"
else
    echo -e "${YELLOW}Docker ya está instalado${NC}"
fi

# Verificar si existe el archivo .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creando archivo .env de ejemplo...${NC}"
    cat > .env << EOL
# Configuración del puerto de la aplicación
PORT=3008

# Configuración de la base de datos MySQL
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=botuser
MYSQL_PASSWORD=botpassword
MYSQL_DATABASE=botdb
MYSQL_ROOT_PASSWORD=rootpassword

# API Key para Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
EOL
    echo -e "${YELLOW}Archivo .env creado. Por favor, edita este archivo con tus credenciales reales antes de continuar.${NC}"
    echo -e "${YELLOW}Ejecuta 'nano .env' para editarlo${NC}"
    exit 0
else
    echo -e "${YELLOW}El archivo .env ya existe. Se utilizará la configuración existente.${NC}"
fi

# Desplegar con Docker Compose
echo -e "${GREEN}Desplegando con Docker Compose...${NC}"
docker-compose up -d

# Configurar el firewall si está activo
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    echo -e "${GREEN}Configurando firewall (ufw)...${NC}"
    PORT=$(grep "PORT=" .env | cut -d '=' -f2)
    PORT=${PORT:-3008}  # Valor por defecto si no está definido
    ufw allow $PORT/tcp
    echo -e "${GREEN}Puerto $PORT abierto en el firewall${NC}"
fi

echo -e "${GREEN}=== Despliegue completado ===${NC}"
echo -e "${YELLOW}Puedes verificar el estado de los contenedores con:${NC}"
echo -e "  docker-compose ps"
echo -e "${YELLOW}Ver los logs de la aplicación con:${NC}"
echo -e "  docker-compose logs -f app"
echo -e "${YELLOW}Accede a la API en http://tu-servidor:$PORT${NC}"
echo ""
echo -e "${GREEN}¡Gracias por usar el ChatBot Comercial!${NC}" 