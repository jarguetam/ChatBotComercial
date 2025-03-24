import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import fs from 'fs';
import path from 'path';
import os from 'os';

export const limitesCreditoFlow = addKeyword<Provider, Database>([
  "6",
  "6️⃣",
  "6️⃣ Limites de credito disponibles",
  "Limites de credito disponibles",
])
  .addAction(async (ctx, { flowDynamic, provider }) => {
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
        // Mensaje final
        await typing(ctx, provider);
        await flowDynamic(
          "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
        );
        return;
      }

      const sellerCode =
        sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      console.log("Código del vendedor obtenido:", sellerCode);

      // Mostrar opciones para seleccionar empresa
      await flowDynamic(
        [
          "📊 *CONSULTA DE LÍMITES DE CRÉDITO*",
          "",
          "Selecciona la empresa para consultar los límites de crédito disponibles:",
          "",
          "F Fertica",
          "C Cadelga",
          "",
          "Envía la letra correspondiente.",
        ].join("\n")
      );

      // Guardar el código del vendedor para usarlo después
      ctx.vendorCode = sellerCode;
    } catch (error) {
      console.error("Error en limitesCreditoFlow:", error);
      await flowDynamic(
        "❌ Hubo un error al procesar tu solicitud. Intenta más tarde."
      );
      // Mensaje final
      await typing(ctx, provider);
      await flowDynamic(
        "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
      );
    }
  })
  .addAnswer(
    "Selecciona la empresa",
    { capture: true },
    async (ctx, { flowDynamic, provider }) => {
      await typing(ctx, provider);
      const respuesta = ctx.body.toLowerCase().trim();
      let empresa = "";

      // Utilizar números en lugar de letras para diferenciar del otro flujo
      if (respuesta === "F" || respuesta === "f" || respuesta === "fertica") {
        empresa = "Fertica";
      } else if (
        respuesta === "C" ||
        respuesta === "c" ||
        respuesta === "cadelga"
      ) {
        empresa = "Cadelga";
      } else {
        await flowDynamic(
          "❌ Opción no válida. Por favor escribe F para Fertica o C para Cadelga."
        );
        // Mensaje final
        await typing(ctx, provider);
        await flowDynamic(
          "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
        );
        return;
      }

      try {
        const phone = ctx.from;
        // Recuperar el código del vendedor guardado anteriormente
        const sellerData = await ApiService.validateSeller(phone);
        const sellerCode =
          sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
        console.log("Código del vendedor obtenido:", sellerCode);
        // Consultar los límites de crédito
        await flowDynamic(
          `⏳ Consultando límites de crédito para ${empresa}...`
        );
        const creditLimitData = await ApiService.getCreditLimit(
          sellerCode,
          empresa
        );

        if (
          creditLimitData &&
          creditLimitData.success &&
          creditLimitData.base64Content
        ) {
          try {
            // Crear una carpeta para guardar el PDF temporalmente
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Crear un nombre de archivo único
            const fileName = `LimitesCredito_${empresa}_${Date.now()}.pdf`;
            const filePath = path.join(tempDir, fileName);
            
            // Guardar el PDF en el sistema de archivos
            fs.writeFileSync(filePath, Buffer.from(creditLimitData.base64Content, 'base64'));
            
            // Mensaje informativo
            await flowDynamic(
              `📄 *Límites de crédito disponibles - ${empresa}*\n\nAquí tienes el reporte con los límites de crédito actualizados para tus clientes.`
            );
            
            // Enviar el PDF usando flowDynamic con la ruta local
            await flowDynamic([
              {
                body: `Límites de crédito para ${empresa}`,
                media: filePath
              }
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
            
          } catch (error) {
            console.error("Error enviando PDF:", error);
            await flowDynamic("❌ Error al enviar el documento PDF. Intenta más tarde.");
          }
        } else {
          await flowDynamic(
            `❌ No se encontraron datos de límites de crédito para ${empresa}. Intenta más tarde.`
          );
        }
      } catch (error) {
        console.error(
          `Error consultando límites de crédito para ${empresa}:`,
          error
        );
        await flowDynamic(
          "❌ Hubo un error al obtener los límites de crédito. Intenta más tarde."
        );
      }

      // Mensaje final
      await typing(ctx, provider);
      await flowDynamic(
        "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
      );
    }
  );
