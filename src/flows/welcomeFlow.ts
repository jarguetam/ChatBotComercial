import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { menuFlow } from "./menuFlow";

// Verificamos si tenemos configurado Gemini (lo usaremos para saludos personalizados)
const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

export const welcomeFlow = addKeyword<Provider, Database>([
  "hi",
  "hello",
  "hola",
  "buen día",
  "buenas",
  "buenos días",
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
          welcomeShown: true // Indicador de que ya se mostró un mensaje de bienvenida
        });

        // Verificar que se haya guardado correctamente
        const storedCode = await state.get("sellerCode");
        console.log("Código almacenado en estado:", storedCode);

        // Si tenemos Gemini, generamos un saludo personalizado
        if (genAI) {
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 256,
            }
          });

          const prompt = `Genera un saludo amigable, breve y profesional para un vendedor llamado ${sellerName}. 
          El saludo debe ser en español, cálido pero profesional, y debe dar la bienvenida al sistema de información comercial. 
          Hazlo personal usando su nombre. No uses más de 2 líneas. No agregues opciones ni menús.`;
          
          try {
            const result = await model.generateContent(prompt);
            const customGreeting = result.response.text().trim();
            await flowDynamic(customGreeting);
          } catch (error) {
            // Si falla Gemini, usamos el saludo predeterminado
            await flowDynamic(`¡Hola ${sellerName}! 👋 Bienvenido a tu Asistente Comercial. ¿En qué puedo ayudarte hoy?`);
          }
        } else {
          // Mensaje de bienvenida predeterminado si no hay Gemini
          await flowDynamic(`¡Hola ${sellerName}! 👋 Bienvenido a tu Asistente Comercial. ¿En qué puedo ayudarte hoy?`);
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
        "• Metas mensuales y KPIs",
        "• Datos de ventas recientes",
        "• Análisis de clientes importantes",
        "• Productos destacados",
        "• Inventario en tránsito",
        "• Límites de crédito disponibles",
        "",
        "¿Qué información necesitas hoy? Puedes preguntarme directamente."
      ].join("\n"));

      // Dirigimos al flujo de menú para continuar la conversación
      return gotoFlow(menuFlow);

    } catch (error) {
      console.error("Error en welcomeFlow:", error);
      await flowDynamic(
        "¡Hola! Estamos experimentando problemas técnicos. Por favor, intenta más tarde."
      );
    }
  }); 