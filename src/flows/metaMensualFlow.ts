import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { menuFlow } from "./menuFlow";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// Configuración de Gemini
const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

export const metaMensualFlow = addKeyword<Provider, Database>([
  "1",
  "1️⃣",
  "1️⃣ Meta mensual",
  "Meta mensual",
])
  .addAction(async (ctx, { flowDynamic, provider }) => {
    const phone = ctx.from;
    console.log("Número de teléfono en metaMensualFlow:", phone);
    await typing(ctx, provider);
    try {
      const sellerData = await ApiService.validateSeller(phone);
      if (!sellerData) {
        await flowDynamic(
          "❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde."
        );
        await typing(ctx, provider);
        await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
        return;
      }

      const sellerCode =
        sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      console.log("Código del vendedor obtenido:", sellerCode);

      const responseData = await ApiService.getSalesDayBySeller(sellerCode);
      console.log(
        "Respuesta de getMonthlyGoals:",
        JSON.stringify(responseData)
      );

      if (
        responseData &&
        responseData.response &&
        responseData.response.result &&
        responseData.response.result.length > 0
      ) {
        const monthlyGoalData = responseData.response.result;
        const vendedor = monthlyGoalData[0];
        let mostradoAlgunDato = false;
        
        // Función para formatear números
        const formatNumber = (num: any) => {
          try {
            // Convertir a número si es string
            const numberValue = typeof num === 'string' ? parseFloat(num) : Number(num);
            
            // Verificar si es un número válido
            if (isNaN(numberValue)) {
              console.error('Valor no numérico recibido:', num);
              return '0.00';
            }
            
            // Formatear el número
            const parts = numberValue.toFixed(2).split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return parts.join('.');
          } catch (error) {
            console.error('Error formateando número:', error);
            return '0.00';
          }
        };
        
        // Función para generar mensaje amigable con Gemini
        const generateFriendlyMessage = async (tipo: string, datos: any) => {
          if (!genAI) return null;
          
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 256,
            }
          });

          const prompt = `Genera un mensaje amigable y motivacional sobre el progreso de metas para ${tipo}. 
          Usa los siguientes datos:
          - Meta: ${formatNumber(datos.meta)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Ventas actuales: ${formatNumber(datos.ventas)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Progreso: ${formatNumber(datos.progreso)}%
          
          El mensaje debe ser en español, motivacional pero profesional, y debe incluir emojis relevantes. 
          No debe exceder 3 líneas.`;
          
          try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
          } catch (error) {
            console.error("Error generando mensaje con Gemini:", error);
            return null;
          }
        };
        
        // Mostrar datos de Fertica solo si hay datos relevantes
        if (vendedor.MetaTM > 0 || vendedor.TmFertica > 0 || vendedor.CumplimientoFER > 0) {
          let ferticaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Fertica", {
              meta: vendedor.MetaTM.toFixed(2),
              ventas: vendedor.TmFertica.toFixed(2),
              progreso: vendedor.CumplimientoFER.toFixed(2)
            });
            if (friendlyMessage) {
              ferticaMessage = friendlyMessage;
            } else {
              ferticaMessage = [
                "🎯 *META MENSUAL - FERTICA*",
                `Meta: ${vendedor.MetaTM.toFixed(2)} TM`,
                `Ventas: ${vendedor.TmFertica.toFixed(2)} TM`,
                `Progreso: ${vendedor.CumplimientoFER.toFixed(2)}%`
              ].join("\n");
            }
          } else {
            ferticaMessage = [
              "🎯 *META MENSUAL - FERTICA*",
              `Meta: ${vendedor.MetaTM.toFixed(2)} TM`,
              `Ventas: ${vendedor.TmFertica.toFixed(2)} TM`,
              `Progreso: ${vendedor.CumplimientoFER.toFixed(2)}%`
            ].join("\n");
          }
          await flowDynamic(ferticaMessage, { delay: 1500 });
          mostradoAlgunDato = true;
        }
        
        // Mostrar datos de Cadelga solo si hay datos relevantes
        if (vendedor.MetaUSD > 0 || vendedor.UsdCadelga > 0 || vendedor.CumplimientoCad > 0) {
          let cadelgaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Cadelga", {
              meta: vendedor.MetaUSD.toFixed(2),
              ventas: vendedor.UsdCadelga.toFixed(2),
              progreso: vendedor.CumplimientoCad.toFixed(2)
            });
            if (friendlyMessage) {
              cadelgaMessage = friendlyMessage;
            } else {
              cadelgaMessage = [
                "🎯 *META MENSUAL - CADELGA*",
                `Meta: $ ${vendedor.MetaUSD.toFixed(2)}`    ,
                `Ventas: $ ${vendedor.UsdCadelga.toFixed(2)}`,
                `Progreso: ${vendedor.CumplimientoCad.toFixed(2)}%`
              ].join("\n");
            }
          } else {
            cadelgaMessage = [
              "🎯 *META MENSUAL - CADELGA*",
              `Meta: $ ${vendedor.MetaUSD.toFixed(2)}`,
              `Ventas: $ ${vendedor.UsdCadelga.toFixed(2)}`,
              `Progreso: ${vendedor.CumplimientoCad.toFixed(2)}%`
            ].join("\n");
          }
          await flowDynamic(cadelgaMessage, { delay: 1500 });
          mostradoAlgunDato = true;
        }
        
        if (!mostradoAlgunDato) {
          await flowDynamic("No se encontraron datos relevantes para mostrar.");
        }
      } else {
        await flowDynamic("No se encontraron datos relevantes para mostrar.");
      }
    } catch (error) {
      console.error("Error en metaMensualFlow:", error);
      await flowDynamic("Hubo un error al procesar la solicitud. Por favor, intenta más tarde.");
    }
  });
