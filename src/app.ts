import "dotenv/config";
import { createBot } from "@builderbot/bot";
import { provider } from "./provider";
import { database } from "./database";
import { flow } from "./flow";
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT ?? 3008;

// Verificar configuración de Gemini
if (!process.env.GEMINI_API_KEY) {
  console.warn("ADVERTENCIA: GEMINI_API_KEY no está definida en el archivo .env");
  console.warn("Los mensajes personalizados con IA no estarán disponibles.");
}



// Crear directorio temp si no existe
const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log("Directorio temp creado correctamente");
  } catch (error) {
    console.error("Error al crear directorio temp:", error);
  }
}

// Función para iniciar el socket/provider
let adapterProvider: any = null;
let bot: any = null;

const startSock = async () => {
  try {
    // Si ya existe un proveedor, lo limpiamos
    if (adapterProvider) {
      console.log("Limpiando proveedor anterior...");
      // @ts-ignore
      adapterProvider = null;
    }

    // Configuramos el proveedor
    adapterProvider = provider;

    // Crear el bot con los flujos, el proveedor y la base de datos
    const { handleCtx, httpServer } = await createBot({
      flow,
      provider: adapterProvider,
      database,
    });

    bot = { handleCtx };

    // Monitorear errores de conexión
    adapterProvider.on('connection.error', async (error: any) => {
      console.error('Error de conexión detectado:', error?.message || error);
      
      // Verificar si es un error "Queue cleared"
      if (error?.message === 'Queue cleared') {
        console.log('Detectado error "Queue cleared". Programando reconexión en 10 segundos...');
        setTimeout(startSock, 10000);
      }
    });

    // Iniciar el servidor HTTP
    httpServer(+PORT);

    // Endpoint para enviar mensajes
    adapterProvider.server.post(
      "/v1/messages",
      handleCtx(async (bot, req, res) => {
        const { number, message, urlMedia } = req.body;
        await bot.sendMessage(number, message, { media: urlMedia ?? null });
        return res.end("Mensaje enviado");
      })
    );

    // Endpoint para registrar un usuario
    adapterProvider.server.post(
      "/v1/register",
      handleCtx(async (bot, req, res) => {
        const { number, name } = req.body;
        await bot.dispatch("WELCOME_FLOW", { from: number, name });
        return res.end("Usuario registrado");
      })
    );

    // Endpoint para agregar o quitar de la lista negra
    adapterProvider.server.post(
      "/v1/blacklist",
      handleCtx(async (bot, req, res) => {
        const { number, intent } = req.body;
        if (intent === "remove") bot.blacklist.remove(number);
        if (intent === "add") bot.blacklist.add(number);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "ok", number, intent }));
      })
    );

    console.log(`Chatbot comercial iniciado en puerto ${PORT}`);
  } catch (error) {
    console.error("Error al iniciar el socket:", error);
    console.log("Intentando reconectar en 10 segundos...");
    setTimeout(startSock, 10000);
  }
};

const main = async () => {
  console.log("Iniciando chatbot comercial...");
  await startSock();
};

main();
