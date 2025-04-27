import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { typing } from "../utils/presence";
import {
  metaMensualFlow,
  ventasFlow,
  topClientesFlow,
  topProductosFlow,
  inventarioFlow,
} from "./index";
import { limitesCreditoFlow } from "./limitesCreditoFlow";

// Configuración de Gemini (asegúrate de tener GEMINI_API_KEY en .env)
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY no está definida en el archivo .env");
}
const genAI = new GoogleGenerativeAI(API_KEY);

const generationConfig = {
  temperature: 0.7, // Ajustado para más consistencia en las respuestas
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Información sobre los servicios disponibles para el contexto de Gemini
const serviciosDisponibles = {
  metaMensual:
    "Información sobre metas mensuales, objetivos de ventas y seguimiento de KPIs",
  ventas:
    "Datos de ventas de los últimos 6 meses, con análisis de tendencias y comparativas",
  topClientes:
    "Listado de los mejores clientes por volumen de compra o frecuencia",
  topProductos: "Productos más vendidos, con análisis de stock y demanda",
  inventario:
    "Estado del inventario en tránsito, fechas de llegada y cantidades",
  creditoDisponible:
    "Información sobre límites de crédito disponibles para clientes",
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

    // Solo mostrar el mensaje de bienvenida si no viene de welcomeFlow
    if (!welcomeShown) {
      await typing(ctx, provider);
      await flowDynamic(
        [
          "👋 *¡Bienvenido al Asistente Comercial Inteligente!*",
          "",
          "Soy tu asistente virtual y puedo ayudarte con información sobre:",
          "",
          "• Metas mensuales y KPIs",
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
    async (ctx, { flowDynamic, provider, gotoFlow }) => {
      await typing(ctx, provider);
      const userMessage = ctx.body;

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
        // Para cualquier mensaje, consultamos con Gemini
        await typing(ctx, provider);

        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig,
          safetySettings,
        });

        const prompt = `Eres un asistente comercial inteligente para una empresa. Debes ser profesional, amable y eficiente.

CONTEXTO IMPORTANTE:
El usuario está utilizando un chatbot de WhatsApp para consultar información comercial. Puedes ayudar con los siguientes temas:
${JSON.stringify(serviciosDisponibles, null, 2)}

El mensaje del usuario es: "${userMessage}"

INSTRUCCIONES:
1. Analiza la intención del usuario y categorízala según estos posibles flujos:
   - "meta": Si pregunta sobre metas mensuales o KPIs
   - "ventas": Si consulta sobre ventas recientes o tendencias
   - "clientes": Si quiere información sobre clientes importantes o mis mejores clientes
   - "productos": Si busca datos de productos destacados o mejores productos
   - "inventario": Si necesita información de inventario en tránsito
   - "credito": Si pregunta sobre límites de crédito de clientes

2. Si identificas CLARAMENTE que el usuario quiere información sobre alguno de estos temas específicos, responde ÚNICAMENTE con la palabra clave correspondiente (meta, ventas, clientes, productos, inventario, credito).

3. Si la consulta es ambigua o es un saludo/pregunta general, responde de forma conversacional y útil, sugiriendo qué información puedes proporcionarle, pero NO respondas con ninguna palabra clave.

Responde de forma directa, sin preámbulos ni explicaciones adicionales.`;

        const result = await model.generateContent(prompt);
        const geminiResponse = result.response.text().trim();
        const lowerResponse = geminiResponse.toLowerCase();

        // Verificar si la respuesta indica claramente un flujo específico
        if (lowerResponse === "meta") {
          return gotoFlow(metaMensualFlow);
        } else if (lowerResponse === "ventas") {
          return gotoFlow(ventasFlow);
        } else if (lowerResponse === "clientes") {
          return gotoFlow(topClientesFlow);
        } else if (lowerResponse === "productos") {
          return gotoFlow(topProductosFlow);
        } else if (lowerResponse === "inventario") {
          return gotoFlow(inventarioFlow);
        } else if (lowerResponse === "credito") {
          return gotoFlow(limitesCreditoFlow);
        } else {
          // Si Gemini no identificó un flujo específico, enviamos su respuesta conversacional
          await flowDynamic(geminiResponse);
        }
      } catch (error) {
        console.error("Error al procesar la solicitud con Gemini:", error);
        await flowDynamic(
          "Lo siento, estoy teniendo problemas para procesar tu solicitud en este momento. ¿Podrías intentarlo nuevamente o formular tu pregunta de otra manera?"
        );
      }
    }
  );
