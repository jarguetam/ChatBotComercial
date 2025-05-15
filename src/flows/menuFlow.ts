import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import { geminiAgent } from "./geminiAgent";
import { flowOrchestrator } from "./flowOrchestrator";
import fs from "fs";
import path from "path";

// Helper para logs
const logDebug = (message: string) => {
  console.log(`[MENU] ${message}`);
  try {
    const logPath = path.join(process.cwd(), "logs", "flow_debug.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [MENU] ${message}\n`);
  } catch (error) {
    console.error("Error escribiendo log:", error);
  }
};

export const menuFlow = addKeyword<Provider, Database>([
  "menu",
  "menú",
  "MENU",
  "MENÚ",
  "volver",
  "VOLVER",
  "hola",
  "ayuda",
  "help",
])
  .addAction(async (ctx, { flowDynamic, state, provider }) => {
    // Verificar si ya se mostró un mensaje de bienvenida (viene de welcomeFlow)
    const welcomeShown = await state.get("welcomeShown");
    
    // Establecer el flujo actual como menu
    await state.update({ 
      currentFlow: "menu",
      esperandoInput: false,
      esperandoSeleccionCliente: false,
      esperandoEmpresaSeleccion: false,
      blockedForOtherFlows: false
    });
    
    logDebug(`Iniciando flujo de menú, welcomeShown: ${welcomeShown}`);

    // Solo mostrar el mensaje de bienvenida si no viene de welcomeFlow
    if (!welcomeShown) {
      await typing(ctx, provider);
      await flowDynamic(
        [
          "👋 *¡Bienvenido al Asistente Comercial Inteligente!*",
          "",
          "Soy tu asistente virtual y puedo ayudarte con información sobre:",
          "",
          "• Metas mensuales",
          "• Datos de ventas recientes",
          "• Análisis de clientes importantes",
          "• Productos destacados",
          "• Inventario en tránsito",
          "• Límites de crédito disponibles",
          "• Estado de cuenta de clientes",
          "",
          "¿En qué puedo ayudarte hoy? Puedes preguntarme directamente lo que necesites.",
        ].join("\n")
      );
    } else {
      // Reiniciar la bandera para futuras conversaciones si el usuario escribe explícitamente "menu"
      if (
        ctx.body.toLowerCase() === "menu" ||
        ctx.body.toLowerCase() === "menú"
      ) {
        await state.update({ welcomeShown: false });
        await typing(ctx, provider);
        await flowDynamic("¿En qué puedo ayudarte ahora?");
      }
    }
  })
  .addAnswer(
    "", // Mensaje vacío ya que se manejará en el addAction
    {
      capture: true,
    },
    async (ctx, { flowDynamic, provider, gotoFlow, state }) => {
      // Evitar que el menú intercepte mensajes cuando el usuario ya está en otro flujo esperando input
      const currentFlow = await state.get("currentFlow") || "menu";
      const esperandoInput = await state.get("esperandoInput");
      const esperandoSeleccionCliente = await state.get("esperandoSeleccionCliente");
      const esperandoEmpresaSeleccion = await state.get("esperandoEmpresaSeleccion");
      const blockedForOtherFlows = await state.get("blockedForOtherFlows");
      
      logDebug(`Procesando mensaje: "${ctx.body}", flujo actual: ${currentFlow}`);
      logDebug(`Estados: esperandoInput: ${esperandoInput}, esperandoSeleccionCliente: ${esperandoSeleccionCliente}, esperandoEmpresaSeleccion: ${esperandoEmpresaSeleccion}, bloqueado: ${blockedForOtherFlows}`);
      
      // Si cualquier flag indica que el mensaje debe ser procesado por otro flujo, lo ignoramos
      if (currentFlow !== "menu" || 
          esperandoInput === true || 
          esperandoSeleccionCliente === true || 
          esperandoEmpresaSeleccion === true || 
          blockedForOtherFlows === true) {
        logDebug(`IGNORANDO MENSAJE - Flujo ${currentFlow} bloqueado: ${!!blockedForOtherFlows}`);
        return; // Dejar que el flujo actual maneje el mensaje
      }

      await typing(ctx, provider);
      const userMessage = ctx.body.toLowerCase();

      // Casos específicos para comandos directos
      if (
        userMessage === "salir" ||
        userMessage === "exit"
      ) {
        logDebug("Usuario solicitó salir");
        await flowDynamic(
          "Gracias por usar el Asistente Comercial. ¡Hasta pronto!"
        );
        return;
      }

      try {
        // Usar el geminiAgent para analizar la intención del usuario
        logDebug(`Analizando intención del mensaje: "${userMessage}"`);
        const intention = await geminiAgent.analyzeMainInput(userMessage);
        logDebug(`Intención detectada: ${intention.flujo}`);
        
        // Si se detecta la necesidad de cambiar a un flujo específico, establecer valores predeterminados
        if (intention.flujo !== "default") {
          await flowOrchestrator.setDefaultStateValues(intention.flujo, state);
        }
        
        // Usar el orquestador para manejar la navegación entre flujos
        return await flowOrchestrator.routeToFlow(
          intention,
          ctx,
          { flowDynamic, provider, state, gotoFlow }
        );
      } catch (error) {
        logDebug(`Error al procesar solicitud: ${error}`);
        console.error("Error al procesar la solicitud con Gemini:", error);
        await flowDynamic(
          "Lo siento, estoy teniendo problemas para procesar tu solicitud en este momento. ¿Podrías intentarlo nuevamente o formular tu pregunta de otra manera?"
        );
      }
    }
  );
