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

export const topClientesFlow = addKeyword<Provider, Database>([
  "3",
  "3️⃣",
  "3️⃣ Top Clientes",
  "Top Clientes",
])
  .addAction(async (ctx, { flowDynamic, provider }) => {
    const phone = ctx.from;
    console.log("Número de teléfono en topClientesFlow:", phone);

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
      await typing(ctx, provider);
      const sellerCode =
        sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      console.log("Código del vendedor obtenido:", sellerCode);

      const responseData = await ApiService.getTopCustomerBySeller(sellerCode);
      console.log(
        "Respuesta de getTopCustomerBySeller:",
        JSON.stringify(responseData)
      );

      if (
        responseData &&
        responseData.response &&
        responseData.response.result &&
        responseData.response.result.length > 0
      ) {
        const topClientsData = responseData.response.result;

        // Separar datos por empresa para mostrarlos agrupados
        const ferticaClients = topClientsData.filter(
          (client) => client.Empresa === "Fertica"
        );
        const cadelgaClients = topClientsData.filter(
          (client) => client.Empresa === "Cadelga"
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
          const clienteTop = datos[0];

          const prompt = `Genera un mensaje amigable y analítico sobre los mejores clientes de ${tipo}. 
          Usa los siguientes datos:
          - Total de ventas: ${formatNumber(totalVentas)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Promedio por cliente: ${formatNumber(promedioVentas)} ${tipo === "Fertica" ? "TM" : "USD"}
          - Cliente top: ${clienteTop.NombreCliente} con ${formatNumber(clienteTop.TotalVentas)} ${tipo === "Fertica" ? "TM" : "USD"}
          
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

        // Mostrar clientes de Fertica
        if (ferticaClients.length > 0) {
          let ferticaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Fertica", ferticaClients);
            if (friendlyMessage) {
              ferticaMessage = friendlyMessage + "\n\n📊 *DETALLE DE CLIENTES FERTICA*";
            } else {
              ferticaMessage = "👑 *TOP CLIENTES - FERTICA*";
            }
          } else {
            ferticaMessage = "👑 *TOP CLIENTES - FERTICA*";
          }

          const ferticaMessages = [
            ferticaMessage,
            ...ferticaClients.map(
              (cliente, index) =>
                `${index + 1}. *${cliente.NombreCliente}*\n` +
                `   Código: ${cliente.CodigoCliente}\n` +
                `   Ventas: ${formatNumber(cliente.TotalVentas)} TM`
            )
          ];
          await flowDynamic(ferticaMessages.join("\n\n"), { delay: 1500 });
          await typing(ctx, provider);
        }

        // Mostrar clientes de Cadelga
        if (cadelgaClients.length > 0) {
          let cadelgaMessage = "";
          if (genAI) {
            const friendlyMessage = await generateFriendlyMessage("Cadelga", cadelgaClients);
            if (friendlyMessage) {
              cadelgaMessage = friendlyMessage + "\n\n💰 *DETALLE DE CLIENTES CADELGA*";
            } else {
              cadelgaMessage = "👑 *TOP CLIENTES - CADELGA*";
            }
          } else {
            cadelgaMessage = "👑 *TOP CLIENTES - CADELGA*";
          }

          const cadelgaMessages = [
            cadelgaMessage,
            ...cadelgaClients.map(
              (cliente, index) =>
                `${index + 1}. *${cliente.NombreCliente}*\n` +
                `   Código: ${cliente.CodigoCliente}\n` +
                `   Ventas: $ ${formatNumber(cliente.TotalVentas)}`
            )
          ];
          await flowDynamic(cadelgaMessages.join("\n\n"), { delay: 1500 });
          await typing(ctx, provider);
        }

        if (ferticaClients.length === 0 && cadelgaClients.length === 0) {
          await flowDynamic(
            "❌ No se encontraron datos de clientes. Intenta más tarde."
          );
        }
      } else {
        await flowDynamic(
          "❌ No se encontraron datos de clientes. Intenta más tarde."
        );
      }
      
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    } catch (error) {
      console.error("Error obteniendo top clientes:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener tus mejores clientes. Intenta más tarde."
      );
      
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    }
  }); 