import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { empresaFlow } from "./empresaFlow";
import fs from 'fs';
import path from 'path';


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

      // Establecemos que venimos del flujo de límites de crédito
      await state.update({ flujoAnterior: "limitesCredito" });

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
      const creditLimitData = await ApiService.getCreditLimit(sellerCode, empresa);

      if (creditLimitData &&
        creditLimitData.success &&
        creditLimitData.base64Content) {
        // Crear una carpeta para guardar el PDF temporalmente
        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Crear un nombre de archivo único
        const fileName = `LimitesCredito_${empresa}_${Date.now()}.pdf`;
        const filePath = path.join(tempDir, fileName);

        // Guardar el PDF en el sistema de archivos
        fs.writeFileSync(
          filePath,
          Buffer.from(creditLimitData.base64Content, "base64")
        );

        // Mensaje informativo
        await flowDynamic(
          `📄 *Límites de crédito disponibles - ${empresa}*\n\nAquí tienes el reporte con los límites de crédito actualizados para tus clientes.`
        );

        // Enviar el PDF usando flowDynamic con la ruta local
        await flowDynamic([
          {
            body: `Límites de crédito para ${empresa}`,
            media: filePath,
          },
        ]);

        // Eliminar el archivo después de enviarlo (opcional)
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
            console.log(`Archivo temporal eliminado: ${filePath}`);
          } catch (err) {
            console.error(`Error al eliminar archivo temporal: ${err}`);
          }
        }, 5000); // 5 segundos de retraso para asegurarse que se haya enviado
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

    // Limpiamos las variables de estado para futuros usos
    await state.update({ flujoAnterior: null });

    await typing(ctx, provider);
    await flowDynamic(
      "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
    );
  });
