import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { menuFlow } from "./menuFlow";

export const inventarioFlow = addKeyword<Provider, Database>([
  "5",
  "5️⃣",
  "5️⃣ Consultar inventario en transito",
  "Consultar inventario en transito",
])
  .addAnswer(
    [
      "Selecciona la empresa para consultar el inventario en tránsito:",
      "A. Fertica",
      "B. Cadelga",
    ].join("\n"),
    { capture: true },
    async (ctx, { flowDynamic, provider }) => {
      await typing(ctx, provider);
      const respuesta = ctx.body.toLowerCase();
      let empresa = "";

      // Determinar la empresa seleccionada usando letras en lugar de números
      if (respuesta.includes("a") || respuesta.includes("fertica")) {
        empresa = "Fertica";
      } else if (respuesta.includes("b") || respuesta.includes("cadelga")) {
        empresa = "Cadelga";
      } else {
        await flowDynamic(
          "❌ Opción no válida. Por favor selecciona A para Fertica o B para Cadelga."
        );
        // Agregar mensaje final aquí en caso de opción no válida
        await typing(ctx, provider);
        await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
        return;
      }

      try {
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
          for (const key of primerGrupo) {
            const items = productosAgrupados[key];
            let cantidadTotal = 0;
            const fechasArr = [];

            items.forEach((item) => {
              cantidadTotal += item.Cantidad;
              // Formato de fecha: DD/MM/YYYY
              const fecha = new Date(item.FechaEstimada);
              const fechaFormateada = `${fecha
                .getDate()
                .toString()
                .padStart(2, "0")}/${(fecha.getMonth() + 1)
                .toString()
                .padStart(2, "0")}/${fecha.getFullYear()}`;
              fechasArr.push(
                `${fechaFormateada} - ${(item.Cantidad / 1000).toFixed(2)} TM`
              );
            });

            // Unidad de medida
            const unidad = items[0].UnidadVenta;
            // Formatear cantidad según unidad
            let cantidadFormateada;
            if (unidad === "Tonelada Metrica") {
              cantidadFormateada = `${(cantidadTotal / 1000).toFixed(2)} TM`;
            } else {
              cantidadFormateada = `${cantidadTotal} ${unidad}`;
            }

            await flowDynamic(
              [
                `*${key}*`,
                `Cantidad total: ${cantidadFormateada}`,
                `Fechas estimadas de llegada:`,
                fechasArr.join("\n"),
              ].join("\n")
            );
          }

          // Si hay más de 10 productos, indicarlo
          if (totalProductos > 10) {
            await flowDynamic(
              `Y ${
                totalProductos - 10
              } productos más. Para consultas más detalladas, contacta a tu asesor.`
            );
          }
        } else {
          await flowDynamic(
            `❌ No se encontraron datos de inventario en tránsito para ${empresa}.`
          );
        }
        
        // Agregar mensaje final aquí
        await typing(ctx, provider);
        await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
      } catch (error) {
        console.error("Error consultando inventario:", error);
        await flowDynamic(
          "❌ Hubo un error al consultar el inventario. Intenta más tarde."
        );
        
        // Agregar mensaje final aquí también
        await typing(ctx, provider);
        await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
      }
    }
  ); 