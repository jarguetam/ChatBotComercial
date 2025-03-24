import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { menuFlow } from "./menuFlow";

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

        // Mostrar productos de Fertica
        if (ferticaProducts.length > 0) {
          const ferticaMessages = [
            "🏆 *TOP PRODUCTOS - FERTICA*",
            ...ferticaProducts.map(
              (producto, index) =>
                `${index + 1}. *${producto.NombreProducto}*\n` +
                `   Código: ${producto.CodigoProducto}\n` +
                `   Ventas: ${producto.TotalVentas.toFixed(2)} TM`
            )
          ];
          await flowDynamic(ferticaMessages.join("\n\n"), { delay: 1500 });
        }

        // Mostrar productos de Cadelga
        if (cadelgaProducts.length > 0) {
          const cadelgaMessages = [
            "🏆 *TOP PRODUCTOS - CADELGA*",
            ...cadelgaProducts.map(
              (producto, index) =>
                `${index + 1}. *${producto.NombreProducto}*\n` +
                `   Código: ${producto.CodigoProducto}\n` +
                `   Ventas: $ ${producto.TotalVentas.toFixed(2)}`
            )
          ];
          await flowDynamic(cadelgaMessages.join("\n\n"), { delay: 1500 });
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