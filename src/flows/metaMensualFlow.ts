import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { menuFlow } from "./menuFlow";

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
        
        // Mostrar datos de Fertica solo si hay datos relevantes
        if (vendedor.MetaTM > 0 || vendedor.TmFertica > 0 || vendedor.CumplimientoFER > 0) {
          const ferticaMessages = [
            "🎯 *META MENSUAL - FERTICA*",
            `Meta: ${vendedor.MetaTM.toFixed(2)} TM`,
            `Ventas: ${vendedor.TmFertica.toFixed(2)} TM`,
            `Progreso: ${vendedor.CumplimientoFER.toFixed(2)}%`
          ];
          await flowDynamic(ferticaMessages.join("\n"), { delay: 1500 });
          mostradoAlgunDato = true;
        }
        
        // Mostrar datos de Cadelga solo si hay datos relevantes
        if (vendedor.MetaUSD > 0 || vendedor.UsdCadelga > 0 || vendedor.CumplimientoCad > 0) {
          const cadelgaMessages = [
            "🎯 *META MENSUAL - CADELGA*",
            `Meta: $ ${vendedor.MetaUSD.toFixed(2)}`,
            `Ventas: $ ${vendedor.UsdCadelga.toFixed(2)}`,
            `Progreso: ${vendedor.CumplimientoCad.toFixed(2)}%`
          ];
          await flowDynamic(cadelgaMessages.join("\n"), { delay: 1500 });
          mostradoAlgunDato = true;
        }
        
        // Mostrar mensaje si no se mostró ningún dato
        if (!mostradoAlgunDato) {
          await flowDynamic(
            "❌ No se encontraron datos de metas mensuales activas. Intenta más tarde."
          );
        }
      } else {
        await flowDynamic(
          "❌ No se encontraron datos de metas mensuales. Intenta más tarde."
        );
      }

      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    } catch (error) {
      console.error("Error obteniendo meta mensual:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener tu meta mensual. Intenta más tarde."
      );
      
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
    }
  });

// Flujo para volver al menú principal
export const volverMenuFlow = addKeyword<Provider, Database>([
  "menu",
  "menú",
  "volver",
  "regresar",
]).addAction(async (ctx, { gotoFlow }) => {
  return gotoFlow(menuFlow);
}); 