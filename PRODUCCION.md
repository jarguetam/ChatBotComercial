# Guía de Despliegue en Producción

Este documento proporciona las instrucciones paso a paso para implementar el ChatBot Comercial en un servidor Ubuntu de producción utilizando Docker.

## Requisitos del Servidor

- Ubuntu 20.04 LTS o superior
- Mínimo 2 GB de RAM
- 10 GB de espacio en disco
- Conexión a Internet estable
- Puertos 80, 443 (opcional para HTTPS) y 3008 (o el puerto configurado) abiertos

## Preparación del Servidor

1. Actualiza el sistema:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Configura una contraseña fuerte para el usuario root y crea un usuario con privilegios sudo.

## Instalación

### Opción 1: Usando el Script Automatizado

1. Clona el repositorio:
   ```bash
   git clone <url-repositorio>
   cd base-ts-baileys-mysql
   ```

2. Ejecuta el script de instalación:
   ```bash
   sudo bash ./deploy-ubuntu.sh
   ```

3. Edita el archivo `.env` con tus configuraciones:
   ```bash
   nano .env
   ```

4. Vuelve a ejecutar el script para completar la instalación:
   ```bash
   sudo bash ./deploy-ubuntu.sh
   ```

### Opción 2: Instalación Manual

1. Instala Docker y Docker Compose:
   ```bash
   # Instalar dependencias
   sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

   # Agregar repositorio Docker
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

   # Instalar Docker
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io

   # Instalar Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. Clona el repositorio:
   ```bash
   git clone <url-repositorio>
   cd base-ts-baileys-mysql
   ```

3. Crea y configura el archivo `.env`:
   ```bash
   cp .env.example .env  # Si existe un archivo de ejemplo
   nano .env             # Editar configuraciones
   ```

4. Inicia los contenedores:
   ```bash
   sudo docker-compose up -d
   ```

## Configuración del Firewall

Si estás utilizando UFW (Uncomplicated Firewall):

```bash
sudo ufw allow ssh
sudo ufw allow 3008/tcp  # O el puerto que hayas configurado
sudo ufw enable
sudo ufw status
```

## Verificación del Despliegue

1. Verifica que los contenedores estén funcionando:
   ```bash
   sudo docker-compose ps
   ```

2. Verifica los logs de la aplicación:
   ```bash
   sudo docker-compose logs -f app
   ```

3. Comprueba que la aplicación responde:
   ```bash
   curl http://localhost:3008/health  # Si existe un endpoint de salud
   ```

## Configuración de WhatsApp

1. Observa los logs para ver el código QR:
   ```bash
   sudo docker-compose logs -f app
   ```

2. Escanea el código QR con WhatsApp en tu móvil siguiendo las instrucciones mostradas.

## Mantenimiento

### Actualizaciones

Para actualizar la aplicación:

```bash
# Detener contenedores
sudo docker-compose down

# Actualizar el código
git pull

# Reconstruir e iniciar
sudo docker-compose up -d --build
```

### Respaldo

Para hacer una copia de seguridad de los datos:

```bash
# Base de datos
sudo docker exec bot-mysql mysqldump -u root -p[MYSQL_ROOT_PASSWORD] botdb > backup_$(date +%Y%m%d).sql

# Sesiones de WhatsApp
sudo tar -czvf bot_sessions_$(date +%Y%m%d).tar.gz ./bot_sessions
```

## Solución de Problemas

### El bot no se conecta a WhatsApp

1. Verifica los logs: `sudo docker-compose logs -f app`
2. Asegúrate de que el código QR sea escaneado correctamente
3. Reinicia el contenedor: `sudo docker-compose restart app`

### Error de conexión a la base de datos

1. Verifica que el contenedor de MySQL esté funcionando: `sudo docker-compose ps`
2. Comprueba las variables de entorno en el archivo `.env`
3. Verifica los logs de MySQL: `sudo docker-compose logs mysql`

### El bot responde lentamente

1. Verifica los recursos del servidor (CPU, memoria, disco)
2. Considera aumentar los recursos asignados al contenedor

## Contacto y Soporte

Para asistencia técnica, contacta al equipo de desarrollo:
- 📧 Email: soporte@empresa.com 