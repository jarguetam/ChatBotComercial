import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { geminiAgent } from "./geminiAgent";
import { flowOrchestrator } from "./flowOrchestrator";

// Nombre del agente de datos
const AGENT_NAME = "DataBot";

export const welcomeFlow = addKeyword<Provider, Database>([
  "hi",
  "hello",
  "hola",
  "buen día",
  "buenas",
  "buenos días",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
])
  .addAction(async (ctx, { flowDynamic, state, provider, gotoFlow }) => {
    await typing(ctx, provider);
    // Extraer el número de teléfono del contexto
    const phone = ctx.from;
    console.log("Número de teléfono en welcomeFlow:", phone);

    try {
      // Validar si el número está registrado
      const sellerData = await ApiService.validateSeller(phone);
      console.log("Datos del vendedor:", JSON.stringify(sellerData));

      if (sellerData) {
        // Verificar la estructura de datos del vendedor
        console.log("Estructura de sellerData:", Object.keys(sellerData));

        // Guardar la información del vendedor en el estado
        // Garantizamos que el código se guarde correctamente
        const sellerCode =
          sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
        const sellerName =
          sellerData.name || sellerData.SlpName || sellerData.nombre;

        console.log(
          "Guardando en estado: código:",
          sellerCode,
          "nombre:",
          sellerName
        );

        await state.update({
          isRegistered: true,
          sellerName: sellerName,
          sellerCode: sellerCode,
          welcomeShown: true, // Indicador de que ya se mostró un mensaje de bienvenida
          currentFlow: "menu"  // Establecer el flujo actual como menú
        });

        // Verificar que se haya guardado correctamente
        const storedCode = await state.get("sellerCode");
        console.log("Código almacenado en estado:", storedCode);

        // Utilizar el geminiAgent para generar un saludo personalizado
        try {
          const customGreeting = await geminiAgent.generateGreeting(sellerName);
          await flowDynamic(customGreeting);
        } catch (error) {
          // Si falla Gemini, usamos el saludo predeterminado
          await flowDynamic(`¡Hola ${sellerName}! 👋 Soy ${AGENT_NAME}, tu Asistente Comercial. ¿En qué puedo ayudarte hoy?`);
        }
      } else {
        // Actualizar estado como no registrado
        await state.update({ 
          isRegistered: false,
          welcomeShown: true // Indicador de que ya se mostró un mensaje de bienvenida
        });

        // Mensaje para número no registrado
        await flowDynamic(
          "¡Hola! Parece que tu número no está registrado en nuestro sistema. Si eres un vendedor de Grupo Cadelga, por favor comunícate al departamento de Data BI para activar tu acceso. 👋"
        );
        return;
      }

      // Mensaje informativo sobre las capacidades del asistente
      await flowDynamic([
        "Puedo ayudarte con información sobre:",
        "",
        "• Meta del mes",
        "• Datos de ventas recientes",
        "• Análisis de clientes importantes",
        "• Productos destacados",
        "• Inventario en tránsito",
        "• Límites de crédito disponibles",
        "• Estado de cuenta de clientes",
        "",
        "¿Qué información necesitas hoy? Puedes preguntarme directamente."
      ].join("\n"));

      // Dirigimos al flujo de menú usando el orquestrador
      const intention = { flujo: "menu" };
      return await flowOrchestrator.routeToFlow(
        intention,
        ctx,
        { flowDynamic, provider, state, gotoFlow }
      );

    } catch (error) {
      console.error("Error en welcomeFlow:", error);
      await flowDynamic(
        "¡Hola! Estamos experimentando problemas técnicos. Por favor, intenta más tarde."
      );
    }
  }); 