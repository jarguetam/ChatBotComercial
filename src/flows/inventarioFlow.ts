import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { empresaFlow } from "./empresaFlow";

export const inventarioFlow = addKeyword<Provider, Database>([
  "5",
  "5️⃣",
  "5️⃣ Consultar inventario en transito",
  "Consultar inventario en transito",
])
  .addAction(async (ctx, { flowDynamic, provider, state, gotoFlow }) => {
    await typing(ctx, provider);
    return gotoFlow(empresaFlow);
  })
  .addAction(async (ctx, { flowDynamic, provider, state }) => {
    await typing(ctx, provider);
    
    try {
      const empresa = await state.get("empresaSeleccionada");

      if (!empresa) {
        await flowDynamic(
          "❌ No se pudo obtener la información de la empresa. Por favor, intenta nuevamente."
        );
        return;
      }

      // Consultar inventario en tránsito para la empresa seleccionada
      const responseData = await ApiService.getTransitProduct(empresa);
      console.log(
        "Respuesta de getTransitProduct:",
        JSON.stringify(responseData)
      );

      if (
        responseData &&
        responseData.response &&
        responseData.response.result &&
        responseData.response.result.length > 0
      ) {
        const inventarioData = responseData.response.result;

        await flowDynamic(
          `📦 *INVENTARIO EN TRÁNSITO - ${empresa.toUpperCase()}*`
        );

        // Agrupar productos por código y descripción
        const productosAgrupados = {};
        inventarioData.forEach((item) => {
          const key = `${item.Codigo} - ${item.Descripcion}`;
          if (!productosAgrupados[key]) {
            productosAgrupados[key] = [];
          }
          productosAgrupados[key].push(item);
        });

        // Mostrar información por grupos de productos (máximo 10 productos a la vez)
        const productoKeys = Object.keys(productosAgrupados);
        const totalProductos = productoKeys.length;

        await flowDynamic(
          `Se encontraron ${totalProductos} productos en tránsito.`
        );

        // Mostrar los primeros 10 productos
        const primerGrupo = productoKeys.slice(0, 10);
        const mensajes = primerGrupo.map((key, index) => {
          const items = productosAgrupados[key];
          const totalCantidad = items.reduce((sum, item) => sum + item.Cantidad, 0);
          return `${index + 1}. *${key}*\n   Cantidad: ${totalCantidad}`;
        });

        await flowDynamic(mensajes.join("\n\n"));

        if (totalProductos > 10) {
          await flowDynamic(
            `Hay ${totalProductos - 10} productos más. ¿Deseas ver más información?`
          );
        }
      } else {
        await flowDynamic(
          "❌ No se encontraron datos de inventario en tránsito. Intenta más tarde."
        );
      }
    } catch (error) {
      console.error("Error obteniendo inventario:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener el inventario. Intenta más tarde."
      );
    }

    await typing(ctx, provider);
    await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
  }); 