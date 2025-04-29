import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { empresaFlow } from "./empresaFlow";
import fs from 'fs';
import path from 'path';

export const inventarioFlow = addKeyword<Provider, Database>([
  "5",
  "5️⃣",
  "5️⃣ Consultar inventario en transito",
  "Consultar inventario en transito",
])
  .addAction(async (ctx, { flowDynamic, provider, state, gotoFlow }) => {
    await typing(ctx, provider);
    // Primero validamos al vendedor
    const phone = ctx.from;
    console.log("Número de teléfono en inventarioFlow:", phone);

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

      const sellerCode = sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      console.log("Código del vendedor obtenido:", sellerCode);

      // Guardar el código del vendedor en el estado
      await state.update({ sellerCode });

      // Establecemos que venimos del flujo de inventario
      await state.update({ flujoAnterior: "inventario" });

      // Ir al flujo de selección de empresa
      return gotoFlow(empresaFlow);
    } catch (error) {
      console.error("Error en inventarioFlow:", error);
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

      // Consultar inventario en tránsito para la empresa seleccionada
      const responseData = await ApiService.getTransitProduct(empresa);
      console.log("Respuesta de getTransitProduct:", JSON.stringify(responseData));

      if (responseData && responseData.success && responseData.base64Content) {
        // Crear una carpeta para guardar el PDF temporalmente
        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Crear un nombre de archivo único
        const fileName = `InventarioTransito_${empresa}_${Date.now()}.pdf`;
        const filePath = path.join(tempDir, fileName);

        // Guardar el PDF en el sistema de archivos
        fs.writeFileSync(
          filePath,
          Buffer.from(responseData.base64Content, "base64")
        );

        // Mensaje informativo
        await flowDynamic(
          `📦 *INVENTARIO EN TRÁNSITO - ${empresa.toUpperCase()}*\n\nAquí tienes el reporte con el inventario en tránsito actualizado.`
        );

        // Enviar el PDF usando flowDynamic con la ruta local
        await flowDynamic([
          {
            body: `Inventario en tránsito para ${empresa}`,
            media: filePath,
          },
        ]);

        // Eliminar el archivo después de enviarlo
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
            console.log(`Archivo temporal eliminado: ${filePath}`);
          } catch (err) {
            console.error(`Error al eliminar archivo temporal: ${err}`);
          }
        }, 5000);
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

    // Limpiamos las variables de estado para futuros usos
    await state.update({ flujoAnterior: null });

    await typing(ctx, provider);
    await flowDynamic(
      "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
    );
  });
