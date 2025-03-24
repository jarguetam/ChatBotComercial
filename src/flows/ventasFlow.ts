import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { menuFlow } from "./menuFlow";

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
        await typing(ctx, provider);
        // Mostrar ventas de Fertica
        if (ferticaData.length > 0) {
          const ferticaMensajes = [
            "📈 *VENTAS ÚLTIMOS 6 MESES - FERTICA*",
            ...ferticaData.map(
              (item) => `• ${item.Mes} ${item.Año}: ${item.TM.toFixed(2)} TM`
            ),
            `*Total Fertica: ${ferticaData.reduce((sum, item) => sum + item.TM, 0).toFixed(2)} TM*`
          ];
          await flowDynamic(ferticaMensajes.join("\n"), { delay: 1500 });
          await typing(ctx, provider);
        }

        // Mostrar ventas de Cadelga
        if (cadelgaData.length > 0) {
          const cadelgaMensajes = [
            "💰 *VENTAS ÚLTIMOS 6 MESES - CADELGA*",
            ...cadelgaData.map(
              (item) => `• ${item.Mes} ${item.Año}: $ ${item.TM.toFixed(2)}`
            ),
            `*Total Cadelga: $ ${cadelgaData.reduce((sum, item) => sum + item.TM, 0).toFixed(2)}*`
          ];
          await flowDynamic(cadelgaMensajes.join("\n"), { delay: 1500 });
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