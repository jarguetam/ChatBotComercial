<p align="center">
  <h2 align="center">Chatbot Comercial</h2>
</p>

<p align="center">
  Bot de WhatsApp diseñado para brindar soporte al equipo comercial
</p>

## Descripción

Este chatbot está desarrollado para asistir al equipo comercial proporcionando:

- Respuestas automáticas a preguntas frecuentes sobre productos y servicios
- Información actualizada sobre precios y disponibilidad
- Gestión de consultas básicas de clientes
- Derivación a agentes comerciales cuando sea necesario
- Seguimiento de interacciones con clientes potenciales

## Instalación

Para instalar el chatbot, ejecuta:

```bash
npm install
```

## Configuración

1. Configura las variables de entorno en el archivo `.env`
2. Actualiza la base de datos de respuestas en `src/responses`
3. Inicia el bot con:

```bash
npm start
```

## Mantenimiento

Para actualizar la información del bot:
- Modifica las respuestas predefinidas en la base de datos
- Actualiza los flujos de conversación según las necesidades del equipo
- Revisa los logs de interacciones para optimizar respuestas

## Despliegue con Docker

### Requisitos previos
- Docker y Docker Compose instalados en el servidor
- Cuenta de API de Google Gemini activa (para funcionalidades de IA)

### Pasos para despliegue

1. Clona el repositorio en tu servidor Ubuntu:
```bash
git clone <url-del-repositorio>
cd base-ts-baileys-mysql
```

2. Crea un archivo `.env` con las variables de entorno necesarias:
```bash
# Configuración del puerto de la aplicación
PORT=3008

# Configuración de la base de datos MySQL
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=botuser
MYSQL_PASSWORD=tucontraseñasegura
MYSQL_DATABASE=botdb
MYSQL_ROOT_PASSWORD=tucontraseñarootsegura

# API Key para Google Gemini
GEMINI_API_KEY=tu_clave_api_de_gemini
```

3. Construye y despliega los contenedores:
```bash
docker-compose up -d
```

4. Verifica que los contenedores estén funcionando:
```bash
docker-compose ps
```

5. Verifica los logs del bot:
```bash
docker-compose logs -f app
```

### Actualización

Para actualizar la aplicación:

```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Persistencia de datos

Los datos importantes se almacenan en:
- Volumen de MySQL para la base de datos
- Directorio `bot_sessions` para las sesiones del bot
- Directorio `assets` para archivos de recursos

### Solución de problemas

Si el bot no se conecta a WhatsApp:
1. Verifica los logs del contenedor: `docker-compose logs -f app`
2. Asegúrate de que el código QR sea escaneado correctamente
3. Verifica que el puerto esté abierto correctamente en el firewall

## Soporte

Para cualquier consulta sobre el funcionamiento del bot, contacta al equipo de TI:
- 📧 Email: soporte@empresa.com
- 💬 Chat interno: #soporte-chatbot