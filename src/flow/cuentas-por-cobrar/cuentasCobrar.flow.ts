import { addKeyword, EVENTS } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { typing } from "../../utils/presence";
import { ApiService } from "../../services/apiService";
import fs from 'fs';
import path from 'path';

export const cuentasPorCobrarNuevoFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "8",
  "cuentas por cobrar",
  "cuentas_por_cobrar", 
  "cuentas_cobrar",
  "cxc",
  "CXC",
  "cuentas cobrar"
])
  .addAction(async (ctx, { flowDynamic, provider, state }) => {
    // Inicializar/resetear el estado al comenzar
    await state.update({
      empresaSeleccionada: null,
      sellerCode: null
    });

    await typing(ctx, provider);

    const phone = ctx.from;
    try {
      console.log(`Validando vendedor para: ${phone}`);
      const sellerData = await ApiService.validateSeller(phone);
      if (!sellerData) {
        await flowDynamic("❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde.");
        return;
      }

      const sellerCode = sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      await state.update({ sellerCode });

      await flowDynamic([
        "👤 *Consulta de Cuentas por Cobrar*",
      ]);

      return;
    } catch (error) {
      console.error("Error validando vendedor:", error);
      await flowDynamic("❌ Hubo un error al validar tu información. Por favor, intenta más tarde.");
      return;
    }
  })
  // PASO ÚNICO: Solicitar la empresa
  .addAnswer(
    "Por favor, selecciona la empresa para consultar las cuentas por cobrar\n\nOpciones disponibles: *Fertica* o *Cadelga*",
    { capture: true },
    async (ctx, { flowDynamic, state, provider }) => {
      const empresa = ctx.body.trim();
      console.log(`Selección de empresa: ${empresa}`);

      if (empresa.toLowerCase() === 'cancelar') {
        await flowDynamic("Operación cancelada. Escribe *menu* para ver más opciones.");
        return;
      }

      // Verificamos si la empresa es válida
      const empresaValida = empresa.toLowerCase();
      if (empresaValida !== "fertica" && empresaValida !== "cadelga") {
        await flowDynamic([
          "❌ Empresa no válida.",
          "Por favor, escribe *Fertica* o *Cadelga*"
        ]);
        return;
      }

      // Guardar la empresa seleccionada en el estado
      await state.update({ empresaSeleccionada: empresaValida });
      
      // Obtener código del vendedor del estado
      const sellerCode = await state.get("sellerCode");
      if (!sellerCode) {
        await flowDynamic("❌ Error al recuperar información del vendedor. Por favor, intenta de nuevo.");
        return;
      }
      await typing(ctx, provider);
      // Procesar directamente con la empresa seleccionada
      return await obtenerCuentasPorCobrar(sellerCode, empresaValida, { flowDynamic, state });
    }
  );

// Función auxiliar para obtener y procesar las cuentas por cobrar
async function obtenerCuentasPorCobrar(sellerCode, empresaValida, { flowDynamic, state }) {
  console.log(`Obteniendo cuentas por cobrar para vendedor ${sellerCode} en ${empresaValida}`);
  
  await flowDynamic([
    "Descargando cuentas por cobrar..."
  ]);
  
  try {
    console.log("Llamando a ApiService.getCuentasPorCobrar");
    
    const response = await ApiService.getCuentasPorCobrar(sellerCode.trim(), empresaValida);
    console.log("Respuesta de API recibida:", response ? "OK" : "Error");
    
    if (!response && !response.success && !response.base64Content) {
      console.log("No se pudieron obtener las cuentas por cobrar");
      await flowDynamic([
        "❌ No se pudieron obtener las cuentas por cobrar.",
        "No hay información disponible para esta empresa."
      ]);
      return;
    }
   
    console.log("Enviando documento al usuario");
    // Crear una carpeta para guardar el PDF temporalmente
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Crear un nombre de archivo único
    const fileName = `Cuentas_Cobrar_${empresaValida}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    // Guardar el PDF en el sistema de archivos
    fs.writeFileSync(
      filePath,
      Buffer.from(response.base64Content, "base64")
    );

    // Mensaje informativo
    await flowDynamic([
      `📄 *Cuentas por Cobrar - ${empresaValida}*`,
      "",
      "Aquí tienes el reporte consolidado de cuentas por cobrar:"
    ].join("\n"));

    // Enviar el PDF
    await flowDynamic([
      {
        body: `Cuentas por Cobrar - ${empresaValida}`,
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

    await flowDynamic([
      "¿Necesitas algo más?",
      "Escribe *menu* para ver más opciones o *cuentas por cobrar nuevo* para consultar otra empresa"
    ]);
    
    // Limpiar el estado para futuras consultas
    await state.update({
      empresaSeleccionada: null
    });
    
    return;
  } catch (error) {
    console.error("Error obteniendo cuentas por cobrar:", error);
    await flowDynamic([
      "❌ Hubo un error al generar el reporte de cuentas por cobrar.",
      "Por favor, verifica los datos e intenta nuevamente."
    ]);
    return;
  }
} 