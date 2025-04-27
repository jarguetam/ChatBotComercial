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

export const ventasFlow = addKeyword<Provider, Database>([
  "2",
  "2️⃣",
  "2️⃣ Ventas últimos 6 meses",
  "Ventas últimos 6 meses",
])
  .addAction(async (ctx, { flowDynamic, provider }) => {
    const phone = ctx.from;
    console.log("Número de teléfono en ventasFlow:", phone);
    await typing(ctx, provider);
    try {
      const sellerData = await ApiService.validateSeller(phone);
      if (!sellerData) {
        await flowDynamic(
          "❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde."
        );
        return;
      }

      const sellerCode =
        sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      console.log("Código del vendedor obtenido:", sellerCode);

      const responseData = await ApiService.getSalesSixMonthBySeller(sellerCode);
      console.log(
        "Respuesta de getSalesSixMonthBySeller:",
        JSON.stringify(responseData)
      );

      if (
        responseData &&
        responseData.response &&
        responseData.response.result &&
        responseData.response.result.length > 0
      ) {
        const salesData = responseData.response.result;

        // Separar datos por empresa
        const ferticaData = salesData.filter(
          (item) => item.Empresa === "Fertica"
        );
        const cadelgaData = salesData.filter(
          (item) => item.Empresa === "Cadelga"
        );

        // Ordenar los datos por año y mes
        const sortByDate = (a, b) => {
          if (a.Año !== b.Año) return a.Año - b.Año;

          const meses = [
            "JANUARY",
            "FEBRUARY",
            "MARCH",
            "APRIL",
            "MAY",
            "JUNE",
            "JULY",
            "AUGUST",
            "SEPTEMBER",
            "OCTOBER",
            "NOVEMBER",
            "DECEMBER",
          ];
          return meses.indexOf(a.Mes) - meses.indexOf(b.Mes);
        };

        ferticaData.sort(sortByDate);
        cadelgaData.sort(sortByDate);

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
        const generateFriendlyMessage = async (tipo: string, datos: any[]) => {
          if (!genAI) return null;
          
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 256,
            }
          });

          const total = datos.reduce((sum, item) => sum + item.TM, 0);
          const promedio = total / datos.length;
          const tendencia = datos.length > 1 ? 
            ((datos[datos.length - 1].TM - datos[0].TM) / datos[0].TM * 100).toFixed(2) : 0;

          const prompt = `Genera un mensaje amigable y analítico sobre las ventas de ${tipo} en los últimos 6 meses. 
          Usa los siguientes datos:
          - Total vendido: ${formatNumber(total)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Promedio mensual: ${formatNumber(promedio)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Tendencia: ${formatNumber(tendencia)}%
          
          El mensaje debe ser en español, profesional pero motivacional, y debe incluir emojis relevantes. 
          No debe exceder 3 líneas.`;
          
          try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
          } catch (error) {
            console.error("Error generando mensaje con Gemini:", error);
            return null;
          }
        };

        await typing(ctx, provider);
        // Mostrar ventas de Fertica
        if (ferticaData.length > 0) {
          let ferticaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Fertica", ferticaData);
            if (friendlyMessage) {
              ferticaMessage = friendlyMessage + "\n\n📊 *DETALLE DE VENTAS FERTICA*";
            } else {
              ferticaMessage = "📈 *VENTAS ÚLTIMOS 6 MESES - FERTICA*";
            }
          } else {
            ferticaMessage = "📈 *VENTAS ÚLTIMOS 6 MESES - FERTICA*";
          }

          const ferticaDetails = [
            ferticaMessage,
            ...ferticaData.map(
              (item) => `• ${item.Mes} ${item.Año}: ${formatNumber(item.TM)} TM`
            ),
            `*Total Fertica: ${formatNumber(ferticaData.reduce((sum, item) => sum + item.TM, 0))} TM*`
          ];
          await flowDynamic(ferticaDetails.join("\n"), { delay: 1500 });
          await typing(ctx, provider);
        }

        // Mostrar ventas de Cadelga
        if (cadelgaData.length > 0) {
          let cadelgaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Cadelga", cadelgaData);
            if (friendlyMessage) {
              cadelgaMessage = friendlyMessage + "\n\n💰 *DETALLE DE VENTAS CADELGA*";
            } else {
              cadelgaMessage = "💰 *VENTAS ÚLTIMOS 6 MESES - CADELGA*";
            }
          } else {
            cadelgaMessage = "💰 *VENTAS ÚLTIMOS 6 MESES - CADELGA*";
          }

          const cadelgaDetails = [
            cadelgaMessage,
            ...cadelgaData.map(
              (item) => `• ${item.Mes} ${item.Año}: $ ${formatNumber(item.TM)}`
            ),
            `*Total Cadelga: $ ${formatNumber(cadelgaData.reduce((sum, item) => sum + item.TM, 0))}*`
          ];
          await flowDynamic(cadelgaDetails.join("\n"), { delay: 1500 });
          await typing(ctx, provider);
        }

        if (ferticaData.length === 0 && cadelgaData.length === 0) {
          await flowDynamic(
            "❌ No se encontraron datos de ventas. Intenta más tarde."
          );
        }
      } else {
        await flowDynamic(
          "❌ No se encontraron datos de ventas. Intenta más tarde."
        );
      }
    } catch (error) {
      console.error("Error obteniendo ventas:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener tus ventas. Intenta más tarde."
      );
    }
    await typing(ctx, provider);
    await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
  }); 