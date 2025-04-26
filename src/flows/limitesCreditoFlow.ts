import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { empresaFlow } from "./empresaFlow";

export const limitesCreditoFlow = addKeyword<Provider, Database>([
  "6",
  "6️⃣",
  "6️⃣ Limites de credito disponibles",
  "Limites de credito disponibles",
])
  .addAction(async (ctx, { flowDynamic, provider, state, gotoFlow }) => {
    await typing(ctx, provider);

    // Primero validamos al vendedor
    const phone = ctx.from;
    console.log("Número de teléfono en limitesCreditoFlow:", phone);

    try {
      const sellerData = await ApiService.validateSeller(phone);
      if (!sellerData) {
        await flowDynamic(
          "❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde."
        );
        await typing(ctx, provider);
        await flowDynamic(
          "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
        );
        return;
      }

      const sellerCode =
        sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      console.log("Código del vendedor obtenido:", sellerCode);

      // Guardar el código del vendedor en el estado
      await state.update({ sellerCode });

      // Ir al flujo de selección de empresa
      return gotoFlow(empresaFlow);
    } catch (error) {
      console.error("Error en limitesCreditoFlow:", error);
      await flowDynamic(
        "❌ Hubo un error al procesar tu solicitud. Intenta más tarde."
      );
      await typing(ctx, provider);
      await flowDynamic(
        "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
      );
    }
  })
  .addAction(async (ctx, { flowDynamic, provider, state }) => {
    await typing(ctx, provider);
    
    try {
      const empresa = await state.get("empresaSeleccionada");
      const sellerCode = await state.get("sellerCode");

      if (!empresa || !sellerCode) {
        await flowDynamic(
          "❌ No se pudo obtener la información necesaria. Por favor, intenta nuevamente."
        );
        return;
      }

      // Consultar límites de crédito para la empresa seleccionada
      const responseData = await ApiService.getCreditLimit(sellerCode, empresa);
      
      if (responseData && responseData.response && responseData.response.result) {
        const creditData = responseData.response.result;
        
        const messages = [
          `💳 *LÍMITES DE CRÉDITO - ${empresa.toUpperCase()}*`,
          "",
          `Límite total: $${creditData.limiteTotal.toFixed(2)}`,
          `Límite disponible: $${creditData.limiteDisponible.toFixed(2)}`,
          `Utilizado: $${creditData.utilizado.toFixed(2)}`,
          `Porcentaje utilizado: ${creditData.porcentajeUtilizado.toFixed(2)}%`
        ];

        await flowDynamic(messages.join("\n"));
      } else {
        await flowDynamic(
          "❌ No se encontraron datos de límites de crédito. Intenta más tarde."
        );
      }
    } catch (error) {
      console.error("Error obteniendo límites de crédito:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener los límites de crédito. Intenta más tarde."
      );
    }

    await typing(ctx, provider);
    await flowDynamic(
      "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
    );
  });
