import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { ApiService } from "../../services/apiService";
import { typing } from "../../utils/presence";
import fs from 'fs';
import path from 'path';

export const inventarioFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "5️⃣ Inventario en tránsito", 
  "5 Inventario en tránsito",
  "5",
  "Inventario en tránsito",
  "inventario",
  "transito",
  "en transito",
  "productos en transito"
])
.addAction(async (ctx, { flowDynamic, provider, state }) => {
  await typing(ctx, provider);
  console.log("Iniciando flujo de Inventario en Tránsito");
  
  // Establecer el flujo actual
  await state.update({ currentFlow: "inventario" });
  
  // Primero validamos al vendedor
  const phone = ctx.from;
  console.log("Número de teléfono en inventarioFlow:", phone);

  try {
    const sellerData = await ApiService.validateSeller(phone);
    if (!sellerData) {
      await flowDynamic("❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde.");
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
      return;
    }

    const sellerName = sellerData.nombre || sellerData.name || "Vendedor";
    const sellerCode = sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
    console.log("Código del vendedor obtenido:", sellerCode);

    // Guardar el código del vendedor en el estado
    await state.update({ sellerName, sellerCode });

    // Mostrar opciones de empresas
    await flowDynamic([
      "🏢 *Selecciona la empresa:*",
      "",
      "1. Fertica",
      "2. Cadelga",
      "",
      "Escribe el número (1 o 2) o el nombre de la empresa."
    ].join("\n"));
  } catch (error) {
    console.error("Error en inventarioFlow:", error);
    await flowDynamic("❌ Hubo un error al procesar tu solicitud. Intenta más tarde.");
    await typing(ctx, provider);
    await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
  }
})
.addAnswer(
  "Indica la empresa para la que deseas consultar el inventario en tránsito",
  { capture: true },
  async (ctx, { flowDynamic, provider, state }) => {
    await typing(ctx, provider);
    
    // Obtener la selección de empresa
    const seleccion = ctx.body.trim().toLowerCase();
    console.log("Selección de empresa recibida:", seleccion);
    
    // Verificar si canceló
    if (seleccion === 'cancelar') {
      await flowDynamic("Operación cancelada. Escribe *menu* para ver más opciones.");
      return;
    }
    
    // Determinar la empresa seleccionada
    let empresaSeleccionada = '';
    
    if (seleccion === '1' || seleccion.includes('fertica')) {
      empresaSeleccionada = 'Fertica';
    } else if (seleccion === '2' || seleccion.includes('cadelga')) {
      empresaSeleccionada = 'Cadelga';
    } else {
      await flowDynamic([
        "❌ Empresa no reconocida. Por favor, selecciona una opción válida:",
        "",
        "1. Fertica",
        "2. Cadelga",
        "",
        "Escribe el número (1 o 2) o el nombre de la empresa."
      ].join("\n"));
      return;
    }
    
    // Guardar la empresa seleccionada
    await state.update({ empresaSeleccionada });
    
    // Mostrar mensaje de procesamiento
    await flowDynamic(`Consultando inventario en tránsito para *${empresaSeleccionada}*. Esto puede tomar unos segundos...`);
    
    try {
      // Consultar inventario en tránsito para la empresa seleccionada
      const inventarioData = await ApiService.getTransitProduct(empresaSeleccionada);

      if (inventarioData && inventarioData.success && inventarioData.base64Content) {
        // Crear una carpeta para guardar el PDF temporalmente
        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Crear un nombre de archivo único
        const fileName = `Inventario_${empresaSeleccionada}_${Date.now()}.pdf`;
        const filePath = path.join(tempDir, fileName);

        // Guardar el PDF en el sistema de archivos
        fs.writeFileSync(
          filePath,
          Buffer.from(inventarioData.base64Content, "base64")
        );

        // Mensaje informativo
        await flowDynamic([
          `📄 *Inventario en Tránsito - ${empresaSeleccionada}*`,
          "",
          "Aquí tienes el reporte actualizado del inventario en tránsito:"
        ].join("\n"));

        // Enviar el PDF
        await flowDynamic([
          {
            body: `Inventario en tránsito - ${empresaSeleccionada}`,
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
        await flowDynamic("❌ No se encontraron datos de inventario en tránsito. Intenta más tarde.");
      }
    } catch (error) {
      console.error("Error obteniendo inventario en tránsito:", error);
      await flowDynamic("❌ Hubo un error al obtener el inventario en tránsito. Intenta más tarde.");
    }

    // Mensaje final
    await typing(ctx, provider);
    await flowDynamic("¿Deseas consultar algo más? Escribe *menu* para volver al menú principal.");
  }
); 