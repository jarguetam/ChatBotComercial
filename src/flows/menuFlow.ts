import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import { geminiAgent } from "./geminiAgent";
import { flowOrchestrator } from "./flowOrchestrator";

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
      await typing(ctx, provider);
      const userMessage = ctx.body.toLowerCase();

      // Casos específicos para comandos directos
      if (
        userMessage.toLowerCase() === "salir" ||
        userMessage.toLowerCase() === "exit"
      ) {
        await flowDynamic(
          "Gracias por usar el Asistente Comercial. ¡Hasta pronto!"
        );
        return;
      }

      try {
        // Usar el geminiAgent para analizar la intención del usuario
        const intention = await geminiAgent.analyzeMainInput(userMessage);
        
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
        console.error("Error al procesar la solicitud con Gemini:", error);
        await flowDynamic(
          "Lo siento, estoy teniendo problemas para procesar tu solicitud en este momento. ¿Podrías intentarlo nuevamente o formular tu pregunta de otra manera?"
        );
      }
    }
  );
