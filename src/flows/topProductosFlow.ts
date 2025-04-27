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

export const topProductosFlow = addKeyword<Provider, Database>([
  "4",
  "4️⃣",
  "4️⃣ Top Productos",
  "Top Productos",
])
  .addAction(async (ctx, { flowDynamic, provider }) => {
    const phone = ctx.from;
    console.log("Número de teléfono en topProductosFlow:", phone);

    try {
      const sellerData = await ApiService.validateSeller(phone);
      if (!sellerData) {
        await flowDynamic(
          "❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde."
        );
        // Agregar mensaje final aquí
        await typing(ctx, provider);
        await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
        return;
      }
      await typing(ctx, provider);
      const sellerCode =
        sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      console.log("Código del vendedor obtenido:", sellerCode);

      const responseData = await ApiService.getTopProductBySeller(sellerCode);
      console.log(
        "Respuesta de getTopProductBySeller:",
        JSON.stringify(responseData)
      );

      if (
        responseData &&
        responseData.response &&
        responseData.response.result &&
        responseData.response.result.length > 0
      ) {
        const topProductsData = responseData.response.result;

        // Separar datos por empresa para mostrarlos agrupados
        const ferticaProducts = topProductsData.filter(
          (product) => product.Empresa === "Fertica"
        );
        const cadelgaProducts = topProductsData.filter(
          (product) => product.Empresa === "Cadelga"
        );

        // Función para formatear números
        const formatNumber = (num: any) => {
          try {
            const numberValue = typeof num === 'string' ? parseFloat(num) : Number(num);
            if (isNaN(numberValue)) {
              console.error('Valor no numérico recibido:', num);
              return '0.00';
            }
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

          const totalVentas = datos.reduce((sum, item) => sum + item.TotalVentas, 0);
          const promedioVentas = totalVentas / datos.length;
          const productoTop = datos[0];

          const prompt = `Genera un mensaje amigable y analítico sobre los productos más vendidos de ${tipo}. 
          Usa los siguientes datos:
          - Total de ventas: ${formatNumber(totalVentas)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Promedio por producto: ${formatNumber(promedioVentas)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Producto top: ${productoTop.NombreProducto} con ${formatNumber(productoTop.TotalVentas)} ${tipo === "Fertica" ? "TM" : "USD"}
          
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

        // Mostrar productos de Fertica
        if (ferticaProducts.length > 0) {
          let ferticaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Fertica", ferticaProducts);
            if (friendlyMessage) {
              ferticaMessage = friendlyMessage + "\n\n📊 *DETALLE DE PRODUCTOS FERTICA*";
            } else {
              ferticaMessage = "🏆 *TOP PRODUCTOS - FERTICA*";
            }
          } else {
            ferticaMessage = "🏆 *TOP PRODUCTOS - FERTICA*";
          }

          const ferticaMessages = [
            ferticaMessage,
            ...ferticaProducts.map(
              (producto, index) =>
                `${index + 1}. *${producto.NombreProducto}*\n` +
                `   Código: ${producto.CodigoProducto}\n` +
                `   Ventas: ${formatNumber(producto.TotalVentas)} TM`
            )
          ];
          await flowDynamic(ferticaMessages.join("\n\n"), { delay: 1500 });
          await typing(ctx, provider);
        }

        // Mostrar productos de Cadelga
        if (cadelgaProducts.length > 0) {
          let cadelgaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Cadelga", cadelgaProducts);
            if (friendlyMessage) {
              cadelgaMessage = friendlyMessage + "\n\n💰 *DETALLE DE PRODUCTOS CADELGA*";
            } else {
              cadelgaMessage = "🏆 *TOP PRODUCTOS - CADELGA*";
            }
          } else {
            cadelgaMessage = "🏆 *TOP PRODUCTOS - CADELGA*";
          }

          const cadelgaMessages = [
            cadelgaMessage,
            ...cadelgaProducts.map(
              (producto, index) =>
                `${index + 1}. *${producto.NombreProducto}*\n` +
                `   Código: ${producto.CodigoProducto}\n` +
                `   Ventas: $ ${formatNumber(producto.TotalVentas)}`
            )
          ];
          await flowDynamic(cadelgaMessages.join("\n\n"), { delay: 1500 });
          await typing(ctx, provider);
        }

        if (ferticaProducts.length === 0 && cadelgaProducts.length === 0) {
          await flowDynamic(
            "❌ No se encontraron datos de productos. Intenta más tarde."
          );
        }
      } else {
        await flowDynamic(
          "❌ No se encontraron datos de productos. Intenta más tarde."
        );
      }
      
      // Agregar mensaje final aquí
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    } catch (error) {
      console.error("Error obteniendo top productos:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener tus productos más vendidos. Intenta más tarde."
      );
      
      // Agregar mensaje final aquí también
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    }
  }); 