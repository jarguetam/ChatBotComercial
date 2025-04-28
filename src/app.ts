import "dotenv/config";
import {
  createBot,
  createProvider,
  createFlow,
} from "@builderbot/bot";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import {
  welcomeFlow,
  metaMensualFlow,
  ventasFlow,
  topClientesFlow,
  topProductosFlow,
  inventarioFlow,
  limitesCreditoFlow,
  menuFlow,
  empresaFlow,
  geminiAgent,
  flowOrchestrator,
} from "./flows";
import { config } from "./config";
import { handleConnectionUpdate } from "./utils/reconnect";

const PORT = process.env.PORT ?? 3008;

// Verificar configuración de Gemini
if (!process.env.GEMINI_API_KEY) {
  console.warn("ADVERTENCIA: GEMINI_API_KEY no está definida en el archivo .env");
  console.warn("El orquestador de flujos no funcionará correctamente sin esta clave.");
}

// Inicializar el mapa de flujos del orquestador
flowOrchestrator.initFlowMap({
  menu: menuFlow,
  meta: metaMensualFlow,
  ventas: ventasFlow, 
  clientes: topClientesFlow,
  productos: topProductosFlow,
  inventario: inventarioFlow,
  credito: limitesCreditoFlow,
  empresa: empresaFlow,
});

// Función para iniciar el socket/provider
let adapterProvider: any;
let adapterDB: any;
let adapterFlow: any;
let bot: any;

const startSock = async () => {
  try {
    // Si ya existe un proveedor, lo limpiamos
    if (adapterProvider) {
      console.log("Limpiando proveedor anterior...");
      // @ts-ignore
      adapterProvider = null;
    }

    // Creamos el proveedor con opciones reducidas para evitar errores
    adapterProvider = createProvider(Provider);

    // Registramos los eventos de conexión de manera segura
    try {
      // @ts-ignore - Accedemos al evento de conexión si está disponible
      if (adapterProvider.ev && typeof adapterProvider.ev.on === 'function') {
        adapterProvider.ev.on('connection.update', (update: any) => 
          handleConnectionUpdate(update, startSock)
        );
        console.log("Manejador de conexión registrado correctamente");
      }
    } catch (err) {
      console.warn("No se pudo registrar el manejador de conexión:", err);
    }

    if (!adapterDB) {
      adapterDB = new Database(config);
    }

    if (!adapterFlow) {
      adapterFlow = createFlow([
        welcomeFlow,
        menuFlow,
        metaMensualFlow,
        ventasFlow,
        topClientesFlow,
        topProductosFlow,
        inventarioFlow,
        limitesCreditoFlow,
        empresaFlow,
      ]);
    }

    const { handleCtx, httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    bot = { handleCtx };

    adapterProvider.server.post(
      "/v1/messages",
      handleCtx(async (bot, req, res) => {
        const { number, message, urlMedia } = req.body;
        await bot.sendMessage(number, message, { media: urlMedia ?? null });
        return res.end("sended");
      })
    );

    adapterProvider.server.post(
      "/v1/register",
      handleCtx(async (bot, req, res) => {
        const { number, name } = req.body;
        await bot.dispatch("MENU_FLOW", { from: number, name });
        return res.end("trigger");
      })
    );

    adapterProvider.server.post(
      "/v1/samples",
      handleCtx(async (bot, req, res) => {
        const { number, name } = req.body;
        await bot.dispatch("SAMPLES", { from: number, name });
        return res.end("trigger");
      })
    );

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

    // Nuevo endpoint para procesar mensajes directamente con Gemini
    adapterProvider.server.post(
      "/v1/gemini-analyze",
      handleCtx(async (bot, req, res) => {
        const { number, message, currentFlow } = req.body;
        
        try {
          // Determinar qué método usar según si ya está en un flujo o no
          const intention = currentFlow
            ? await geminiAgent.analyzeFlowInput(message, currentFlow)
            : await geminiAgent.analyzeMainInput(message);
          
          // Responder con la intención detectada
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ 
            status: "ok", 
            intention,
            number
          }));
        } catch (error) {
          console.error("Error procesando con Gemini:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ 
            status: "error", 
            message: "Error procesando mensaje con Gemini",
            number
          }));
        }
      })
    );

    // Iniciar el servidor
    httpServer(+PORT);
    console.log(`Servidor iniciado en puerto ${PORT}`);
  } catch (error) {
    console.error("Error al iniciar el socket:", error);
    console.log("Intentando reconectar en 10 segundos...");
    setTimeout(startSock, 10000);
  }
};

const main = async () => {
  await startSock();
};

main();
