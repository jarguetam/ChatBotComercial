import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { ApiService } from "../../services/apiService";
import { typing } from "../../utils/presence";
import fs from 'fs';
import path from 'path';

export const limitesCreditoFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "6️⃣ Limites de credito disponibles",
  "Limites de credito disponibles",
  "credito",
  "creditos",
  "limite credito",
  "limites credito",
  "limites",
])
.addAction(async (ctx, { flowDynamic, provider, state }) => {
  await typing(ctx, provider);
  console.log("Iniciando flujo de Límites de Crédito");
  
  // Establecer el flujo actual
  await state.update({ currentFlow: "credito" });
  
  // Primero validamos al vendedor
  const phone = ctx.from;
  console.log("Número de teléfono en limitesCreditoFlow:", phone);

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
      "Fertica",
      "Cadelga",
      "",
      "Escribe el nombre de la empresa."
    ].join("\n"));
  } catch (error) {
    console.error("Error en limitesCreditoFlow:", error);
    await flowDynamic("❌ Hubo un error al procesar tu solicitud. Intenta más tarde.");
    await typing(ctx, provider);
    await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
  }
})
.addAnswer(
  "Indica la empresa para la que deseas consultar los límites de crédito",
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
    await flowDynamic(`Consultando límites de crédito para *${empresaSeleccionada}*. Esto puede tomar unos segundos...`);
    
    try {
      const sellerCode = await state.get("sellerCode");

      if (!sellerCode) {
        await flowDynamic("❌ No se pudo obtener la información necesaria. Por favor, intenta nuevamente.");
        return;
      }

      // Consultar límites de crédito para la empresa seleccionada
      const creditLimitData = await ApiService.getCreditLimit(sellerCode, empresaSeleccionada);

      if (creditLimitData && creditLimitData.success && creditLimitData.base64Content) {
        // Crear una carpeta para guardar el PDF temporalmente
        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Crear un nombre de archivo único
        const fileName = `LimitesCredito_${empresaSeleccionada}_${Date.now()}.pdf`;
        const filePath = path.join(tempDir, fileName);

        // Guardar el PDF en el sistema de archivos
        fs.writeFileSync(
          filePath,
          Buffer.from(creditLimitData.base64Content, "base64")
        );

        // Mensaje informativo
        await flowDynamic(`📄 *Límites de crédito disponibles - ${empresaSeleccionada}*\n\nAquí tienes el reporte con los límites de crédito actualizados para tus clientes.`);

        // Enviar el PDF
        await flowDynamic([
          {
            body: `Límites de crédito para ${empresaSeleccionada}`,
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
        await flowDynamic("❌ No se encontraron datos de límites de crédito. Intenta más tarde.");
      }
    } catch (error) {
      console.error("Error obteniendo límites de crédito:", error);
      await flowDynamic("❌ Hubo un error al obtener los límites de crédito. Intenta más tarde.");
    }

    // Mensaje final
    await typing(ctx, provider);
    await flowDynamic("¿Deseas consultar algo más? Escribe *menu* para volver al menú principal.");
  }
); 