import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { menuFlow } from "./menuFlow";

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
        // Agregar mensaje final aquí
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

        // Mostrar clientes de Fertica
        if (ferticaClients.length > 0) {
          const ferticaMessages = [
            "👑 *TOP CLIENTES - FERTICA*",
            ...ferticaClients.map(
              (cliente, index) =>
                `${index + 1}. *${cliente.NombreCliente}*\n` +
                `   Código: ${cliente.CodigoCliente}\n` +
                `   Ventas: ${cliente.TotalVentas.toFixed(2)} TM`
            )
          ];
          await flowDynamic(ferticaMessages.join("\n\n"), { delay: 1500 });
        }

        // Mostrar clientes de Cadelga
        if (cadelgaClients.length > 0) {
          const cadelgaMessages = [
            "👑 *TOP CLIENTES - CADELGA*",
            ...cadelgaClients.map(
              (cliente, index) =>
                `${index + 1}. *${cliente.NombreCliente}*\n` +
                `   Código: ${cliente.CodigoCliente}\n` +
                `   Ventas: $ ${cliente.TotalVentas.toFixed(2)}`
            )
          ];
          await flowDynamic(cadelgaMessages.join("\n\n"), { delay: 1500 });
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
      
      // Agregar mensaje final aquí
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    } catch (error) {
      console.error("Error obteniendo top clientes:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener tus mejores clientes. Intenta más tarde."
      );
      
      // Agregar mensaje final aquí también
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    }
  }); 