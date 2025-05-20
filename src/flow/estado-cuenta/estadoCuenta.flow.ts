import { addKeyword, EVENTS } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { typing } from "../../utils/presence";
import { ApiService } from "../../services/apiService";
import fs from 'fs';
import path from 'path';
import { menuFlow } from "../menu.flow";

export const estadoCuentaFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "7",
  "estado de cuenta",
  "edo cuenta",
  "estado_cuenta",
  "edc"
])
  .addAction(async (ctx, { flowDynamic, provider, state }) => {
    // Inicializar/resetear el estado al comenzar
    await state.update({
      clienteSeleccionado: null,
      clientesEncontrados: null,
      etapa: null,
      clienteUnico: null,
      ultimoMensaje: null,
      intentos: 0 // Control de intentos
    });

    await typing(ctx, provider);

    // Mostrar mensaje que indica que puede salir en cualquier momento
    await flowDynamic([
      "👤 *Consulta de Estado de Cuenta*",
      "",
      "💡 En cualquier momento puedes escribir *cancelar* para volver al menú principal."
    ]);

    const phone = ctx.from;
    try {
      console.log(`Validando vendedor para: ${phone}`);
      
      // Implementar timeout para la llamada a API
      const sellerData = await Promise.race([
        ApiService.validateSeller(phone),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout: La operación tardó demasiado.")), 15000)
        )
      ]);
      
      if (!sellerData) {
        await flowDynamic("❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde.");
        return;
      }

      const sellerCode = sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      await state.update({ sellerCode });

      return;
    } catch (error) {
      console.error("Error validando vendedor:", error);
      const errorMsg = error.message?.includes("Timeout") 
        ? "❌ La operación tardó demasiado tiempo. Por favor, intenta más tarde." 
        : "❌ Hubo un error al validar tu información. Por favor, intenta más tarde.";
      await flowDynamic(errorMsg);
      return;
    }
  })
  // Función auxiliar para verificar si el usuario quiere cancelar
  .addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
    // Esta función se ejecutará antes de cada paso para verificar si el usuario escribe cancelar
    const mensaje = ctx.body?.trim().toLowerCase();
    
    // Lista de comandos para cancelar o volver al menú
    const comandosSalida = ['cancelar', 'salir', 'menu', 'menú', 'volver', 'regresar'];
    
    if (mensaje && comandosSalida.includes(mensaje)) {
      console.log("Usuario solicitó cancelar el flujo");
      await flowDynamic([
        "✅ Operación cancelada.",
        "",
        "Escribe *menu* para ver más opciones."
      ]);
      
      // Limpiar el estado
      await state.update({
        clienteSeleccionado: null,
        clientesEncontrados: null,
        etapa: null,
        clienteUnico: null,
        ultimoMensaje: null,
        intentos: 0
      });
      
      return gotoFlow(menuFlow); // Redireccionar al menú principal
    }
    
    // Si no quiere cancelar, continuamos con el flujo normal
  })
  // PASO 1: Capturar el nombre o código del cliente
  .addAnswer(
    [
      "Escribe el nombre o código del cliente que deseas consultar",
      "",
      "*Cancelar* para volver al menú"
    ].join("\n"),
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      const searchTerm = ctx.body.trim();
      console.log(`Búsqueda de cliente: ${searchTerm}`);

      // Verificar si el término de búsqueda es válido (no vacío y longitud razonable)
      if (!searchTerm || searchTerm.length < 2) {
        await flowDynamic([
          "❌ Por favor ingresa un término de búsqueda válido (mínimo 2 caracteres).",
          "",
          "Escribe el nombre o código del cliente:"
        ]);
        return;
      }

      // Limitar la longitud del término de búsqueda
      const searchTermLimited = searchTerm.substring(0, 50);
      
      const comandosSalida = ['cancelar', 'salir', 'menu', 'menú', 'volver', 'regresar'];
      if (comandosSalida.includes(searchTermLimited.toLowerCase())) {
        await flowDynamic([
          "✅ Operación cancelada.",
          "",
          "Escribe *menu* para ver más opciones."
        ]);
        return;
      }

      try {
        console.log(`Buscando clientes con término: ${searchTermLimited}`);
        // Implementar timeout para la búsqueda
        const response = await Promise.race([
          ApiService.searchClients(searchTermLimited),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout: La búsqueda tardó demasiado.")), 15000)
          )
        ]);

        if (!response?.response?.result?.length) {
          // Incrementar contador de intentos
          const intentos = (await state.get("intentos") || 0) + 1;
          await state.update({ intentos });
          
          // Manejar múltiples intentos fallidos
          if (intentos >= 3) {
            await flowDynamic([
              "❌ Has realizado varios intentos sin éxito.",
              "",
              "Recomendaciones:",
              "- Verifica el nombre o código del cliente",
              "- Intenta con términos más generales",
              "- Contacta con soporte si el problema persiste",
              "",
              "Escribe *menu* para ver más opciones o intenta una nueva búsqueda:"
            ]);
          } else {
            await flowDynamic([
              "❌ No se encontraron clientes con ese nombre o código.",
              "",
              "Intenta con otro término o escribe *cancelar* para salir:"
            ]);
          }
          return;
        }

        const clientes = response.response.result;
        console.log(`Se encontraron ${clientes.length} clientes`);

        // Resetear intentos al encontrar resultados
        await state.update({ intentos: 0 });

        if (clientes.length === 1) {
          // Un solo cliente - lo seleccionamos directamente
          const cliente = clientes[0];
          console.log(`Cliente único seleccionado: ${cliente.CardName}`);
          
          // Guardar el cliente seleccionado en el estado
          await state.update({ 
            clienteSeleccionado: cliente,
            etapa: 'seleccion_empresa', // Marcamos para selección directa de empresa
            clienteUnico: true, // Bandera para indicar que se encontró un solo cliente
            ultimoMensaje: 'cliente_seleccionado',
            saltarSeleccionCliente: true // Flag para indicar que el usuario no seleccionará cliente
          });
          
          await flowDynamic([
            `✅ Cliente seleccionado: *${cliente.CardName}*`,
            "",
            "Ahora, escribe el nombre de la empresa para consultar el estado de cuenta:",
            "",
            "• *Fertica*",
            "• *Cadelga*",
            "",
            "O escribe *cancelar* para volver"
          ]);
          return;
        } else {
          // Múltiples clientes - mostramos la lista
          await state.update({ 
            clientesEncontrados: clientes,
            etapa: 'seleccion_cliente', // Marcamos la etapa
            clienteUnico: false, // No es cliente único
            ultimoMensaje: 'lista_clientes',
            saltarSeleccionCliente: false // El usuario debe seleccionar un cliente
          });

          const mensajeClientes = [
            "📋 *Clientes encontrados:*",
            ""
          ];

          clientes.forEach((cliente, index) => {
            mensajeClientes.push(`${index + 1}. *${cliente.CardCode}* - ${cliente.CardName}`);
          });

          mensajeClientes.push("");
          mensajeClientes.push("Escribe el *número* del cliente que deseas consultar");
          mensajeClientes.push("O escribe *cancelar* para volver");

          await flowDynamic(mensajeClientes.join("\n"));
          return;
        }
      } catch (error) {
        console.error("Error buscando clientes:", error);
        
        // Mensaje específico según el tipo de error
        const errorMsg = error.message?.includes("Timeout") 
          ? "❌ La búsqueda está tardando demasiado. Por favor, intenta con un término más específico o más tarde." 
          : "❌ Hubo un error al buscar clientes. Por favor, intenta nuevamente más tarde.";
        
        await flowDynamic([
          errorMsg,
          "",
          "Escribe *menu* para ver más opciones."
        ]);
        return;
      }
    }
  )
  // PASO 2A: Para clientes únicos - Capturar directamente la empresa
  .addAction(async (ctx, { flowDynamic, state }) => {
    const clienteUnico = await state.get("clienteUnico");
    const etapa = await state.get("etapa");
    const saltarSeleccionCliente = await state.get("saltarSeleccionCliente");
    
    console.log(`[PASO 2A] clienteUnico=${clienteUnico}, etapa=${etapa}, saltarSeleccionCliente=${saltarSeleccionCliente}`);
    
    if (clienteUnico === true && etapa === 'seleccion_empresa' && saltarSeleccionCliente === true) {
      // El siguiente paso de selección de cliente será capturado, pero lo trataremos como selección de empresa
      await state.update({ procesarComoEmpresa: true });
    } else {
      await state.update({ procesarComoEmpresa: false });
    }
  })
  // PASO 2B: Manejar la selección de cliente de la lista O la selección de empresa si es cliente único
  .addAnswer(
    [
      "Selecciona una opción de la lista anterior",
      "",
      "O escribe *cancelar* para volver"
    ].join("\n"),
    { capture: true },
    async (ctx, { flowDynamic, state, provider }) => {
      console.log(`[PASO 2B] Recibida entrada: "${ctx.body}"`);
      
      // Verificar en qué etapa estamos
      const etapa = await state.get("etapa");
      const clienteUnico = await state.get("clienteUnico");
      const ultimoMensaje = await state.get("ultimoMensaje");
      const procesarComoEmpresa = await state.get("procesarComoEmpresa");
      
      console.log(`[PASO 2B] Estado actual: etapa=${etapa}, clienteUnico=${clienteUnico}, ultimoMensaje=${ultimoMensaje}, procesarComoEmpresa=${procesarComoEmpresa}`);

      // Verificar comandos de salida
      const mensaje = ctx.body?.trim().toLowerCase();
      const comandosSalida = ['cancelar', 'salir', 'menu', 'menú', 'volver', 'regresar'];
      if (comandosSalida.includes(mensaje)) {
        await flowDynamic([
          "✅ Operación cancelada.",
          "",
          "Escribe *menu* para ver más opciones."
        ]);
        
        // Limpiar el estado
        await state.update({
          clienteSeleccionado: null,
          clientesEncontrados: null,
          etapa: null,
          clienteUnico: null,
          ultimoMensaje: null,
          intentos: 0
        });
        
        return;
      }

      // Si tenemos que procesar como empresa (cliente único)
      if (procesarComoEmpresa === true) {
        const cliente = await state.get("clienteSeleccionado");
        if (!cliente) {
          console.log("[PASO 2B] Error: No hay cliente seleccionado a pesar de tener procesarComoEmpresa=true");
          await flowDynamic([
            "❌ Ha ocurrido un error en el flujo.",
            "",
            "Por favor, escribe *estado de cuenta* para comenzar de nuevo."
          ]);
          return;
        }
        
        // Usar esta entrada como la empresa seleccionada
        const empresa = ctx.body.trim();
        console.log(`[PASO 2B] Tratando entrada como empresa: ${empresa}`);
        
        // Verificamos si la empresa es válida (más flexible con mayúsculas/minúsculas y espacios)
        const empresaNormalizada = empresa.toLowerCase().trim();
        if (!['fertica', 'cadelga'].includes(empresaNormalizada)) {
          // Incrementar contador de intentos
          const intentos = (await state.get("intentos") || 0) + 1;
          await state.update({ intentos });
          
          const mensajeError = intentos >= 3 
            ? "❌ Empresa no válida. Opciones disponibles:\n\n• *Fertica*\n• *Cadelga*\n\nEscribe *cancelar* para volver o selecciona una de las opciones."
            : "❌ Empresa no válida. Por favor, escribe *Fertica* o *Cadelga*\n\nO escribe *cancelar* para volver";
          
          await flowDynamic(mensajeError);
          return;
        }
        
        // Resetear intentos al recibir entrada válida
        await state.update({ 
          saltarSeleccionEmpresa: true,
          ultimoMensaje: 'empresa_seleccionada',
          intentos: 0
        });
        
        await typing(ctx, provider);
        // Procesar directamente
        return await obtenerEstadoCuenta(cliente, empresaNormalizada, { flowDynamic, state, provider });
      }
      
      // Procesamos selección de cliente de la lista
      if (etapa === 'seleccion_cliente') {
        const clientesEncontrados = await state.get("clientesEncontrados");
        console.log(`[PASO 2B] Procesando selección de cliente de lista. Opciones: ${clientesEncontrados?.length}`);
        
        const seleccion = ctx.body.trim();
        
        // Validación mejorada para la selección
        if (/^\d+$/.test(seleccion)) {
          const indice = parseInt(seleccion) - 1;
          if (indice >= 0 && indice < clientesEncontrados.length) {
            const cliente = clientesEncontrados[indice];
            console.log(`[PASO 2B] Cliente seleccionado de lista: ${cliente.CardName}`);
            
            // Resetear intentos al recibir entrada válida
            await state.update({
              clienteSeleccionado: cliente,
              clientesEncontrados: null,
              etapa: 'seleccion_empresa',
              ultimoMensaje: 'cliente_seleccionado',
              saltarSeleccionEmpresa: false, // No saltar el próximo paso de selección de empresa
              intentos: 0
            });
            
            await flowDynamic([
              `✅ Cliente seleccionado: *${cliente.CardName}*`,
              "",
              "Ahora, escribe el nombre de la empresa para consultar el estado de cuenta:",
              "",
              "O escribe *cancelar* para volver"
            ]);
            return;
          }
        }
        
        // Incrementar contador de intentos para selecciones inválidas
        const intentos = (await state.get("intentos") || 0) + 1;
        await state.update({ intentos });
        
        // Mensaje más detallado si hay múltiples intentos fallidos
        const mensajeError = intentos >= 3
          ? "❌ Selección inválida. Por favor, ingresa SOLO el número que corresponde al cliente en la lista.\n\nEjemplo: Si quieres seleccionar el primer cliente, escribe '1'.\n\nO escribe *cancelar* para volver."
          : "❌ Selección inválida. Por favor, elige un número de la lista o escribe *cancelar*.";
        
        await flowDynamic(mensajeError);
        return;
      }
      
      console.log(`[PASO 2B] Estado no esperado. Etapa=${etapa}, ultimoMensaje=${ultimoMensaje}`);
      await flowDynamic([
        "❌ Ha ocurrido un error en el flujo.",
        "",
        "Por favor, escribe *estado de cuenta* para comenzar de nuevo."
      ]);
    }
  )
  // PASO 3A: Decidir si procesar la selección de empresa
  .addAction(async (ctx, { flowDynamic, state }) => {
    const saltarSeleccionEmpresa = await state.get("saltarSeleccionEmpresa");
    const etapa = await state.get("etapa");
    
    console.log(`[PASO 3A] saltarSeleccionEmpresa=${saltarSeleccionEmpresa}, etapa=${etapa}`);
    
    // Si el cliente único ya envió su selección de empresa, podemos terminar aquí
    if (saltarSeleccionEmpresa === true) {
      console.log("[PASO 3A] Omitiendo el paso de selección de empresa");
      await state.update({ finalizarFlujo: true });
    } else {
      await state.update({ finalizarFlujo: false });
    }
  })
  // PASO 3B: Capturar la selección de empresa (solo si no se ha seleccionado ya)
  .addAnswer(
    [
      "Escribe el nombre de la empresa",
      "",
      "• *Fertica*",
      "• *Cadelga*",
      "",
      "O escribe *cancelar* para volver"
    ].join("\n"),
    { capture: true },
    async (ctx, { flowDynamic, state, provider }) => {
      // Si ya finalizamos el flujo (cliente único ya procesado), salimos
      const finalizarFlujo = await state.get("finalizarFlujo");
      if (finalizarFlujo === true) {
        console.log("[PASO 3B] Flujo ya finalizado, ignorando este paso");
        return;
      }
      
      console.log(`[PASO 3B] Recibida entrada para empresa: "${ctx.body}"`);
      
      // Verificar comandos de salida
      const mensaje = ctx.body?.trim().toLowerCase();
      const comandosSalida = ['cancelar', 'salir', 'menu', 'menú', 'volver', 'regresar'];
      if (comandosSalida.includes(mensaje)) {
        await flowDynamic([
          "✅ Operación cancelada.",
          "",
          "Escribe *menu* para ver más opciones."
        ]);
        
        // Limpiar el estado
        await state.update({
          clienteSeleccionado: null,
          clientesEncontrados: null,
          etapa: null,
          clienteUnico: null,
          ultimoMensaje: null,
          intentos: 0
        });
        
        return;
      }
      
      // Verificar en qué etapa estamos
      const etapa = await state.get("etapa");
      const ultimoMensaje = await state.get("ultimoMensaje");
      
      console.log(`[PASO 3B] Estado actual: etapa=${etapa}, ultimoMensaje=${ultimoMensaje}`);
      
      // PROCESAMIENTO DE EMPRESA (cliente ya seleccionado)
      if (etapa === 'seleccion_empresa' && ultimoMensaje === 'cliente_seleccionado') {
        const cliente = await state.get("clienteSeleccionado");
        if (!cliente) {
          console.log("[PASO 3B] Error: No hay cliente seleccionado en etapa seleccion_empresa");
          await flowDynamic([
            "❌ Ha ocurrido un error en el flujo.",
            "",
            "Por favor, escribe *estado de cuenta* para comenzar de nuevo."
          ]);
          return;
        }
        
        const empresa = ctx.body.trim();
        console.log(`[PASO 3B] Empresa ingresada: ${empresa} para cliente: ${cliente.CardName}`);
        
        // Verificación más flexible para la empresa
        const empresaNormalizada = empresa.toLowerCase().trim();
        if (!['fertica', 'cadelga'].includes(empresaNormalizada)) {
          // Incrementar contador de intentos
          const intentos = (await state.get("intentos") || 0) + 1;
          await state.update({ intentos });
          
          const mensajeError = intentos >= 3 
            ? "❌ Empresa no válida. Opciones disponibles:\n\n• *Fertica*\n• *Cadelga*\n\nEscribe *cancelar* para volver o selecciona una de las opciones."
            : "❌ Empresa no válida. Por favor, escribe *Fertica* o *Cadelga*\n\nO escribe *cancelar* para volver";
          
          await flowDynamic(mensajeError);
          return;
        }
        
        // Resetear intentos al recibir entrada válida
        await state.update({ 
          ultimoMensaje: 'empresa_seleccionada', 
          intentos: 0 
        });
        
        await typing(ctx, provider);
        // Procesar la solicitud
        return await obtenerEstadoCuenta(cliente, empresaNormalizada, { flowDynamic, state, provider });
      }
      
      // Si llegamos aquí, algo está mal con el estado
      console.log(`[PASO 3B] Estado no esperado. Etapa=${etapa}, ultimoMensaje=${ultimoMensaje}`);
      await flowDynamic([
        "❌ Ha ocurrido un error en el flujo.",
        "",
        "Por favor, escribe *estado de cuenta* para comenzar de nuevo."
      ]);
    }
  ); 

// Función auxiliar para obtener y procesar el estado de cuenta
async function obtenerEstadoCuenta(cliente, empresaValida, { flowDynamic, state, provider }) {
  console.log(`Obteniendo estado de cuenta para ${cliente.CardCode} en ${empresaValida}`);

  await flowDynamic([
    "⏳ Descargando estado de cuenta...",
    "Esto puede tardar unos momentos."
  ]);
  
  try {
    console.log("Llamando a ApiService.getEstadoCuenta");
    
    // Implementar timeout para la generación del estado de cuenta
    const response = await Promise.race([
      ApiService.getEstadoCuenta(cliente.CardCode, empresaValida),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout: La generación del estado de cuenta tardó demasiado.")), 30000)
      )
    ]);
    
    console.log("Respuesta de API recibida:", response ? "OK" : "Error");
    
    if (!response || !response.pdfBase64) {
      console.log("No se pudo obtener el estado de cuenta");
      await flowDynamic([
        "ℹ️ *Información del cliente*",
        "",
        "No se encontró saldo pendiente para este cliente.",
        "El cliente no tiene facturas pendientes en este momento.",
        "",
        "¿Necesitas algo más?",
        "Escribe *menu* para ver más opciones o *estado de cuenta* para consultar otro cliente"
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
    const fileName = `Estado_Cuenta_${cliente.CardCode}_${empresaValida}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    try {
      // Verificar tamaño del PDF antes de guardarlo
      const pdfBuffer = Buffer.from(response.pdfBase64, "base64");
      const fileSizeMB = pdfBuffer.length / (1024 * 1024);
      
      if (fileSizeMB > 15) { // Si es mayor a 15MB
        await flowDynamic([
          "⚠️ El archivo del estado de cuenta es demasiado grande para enviarlo por WhatsApp.",
          "",
          "Por favor, contacta con soporte para obtener el estado de cuenta por otro medio.",
          "",
          "Escribe *menu* para ver más opciones."
        ]);
        return;
      }

      // Guardar el PDF en el sistema de archivos
      fs.writeFileSync(filePath, pdfBuffer);

      // Mensaje informativo
      await flowDynamic([
        `📄 *Estado de Cuenta*`,
        `Cliente: *${cliente.CardName}*`,
        `Empresa: *${empresaValida.charAt(0).toUpperCase() + empresaValida.slice(1)}*`,
        "",
        "Aquí tienes el reporte actualizado del estado de cuenta:"
      ].join("\n"));

      // Enviar el PDF
      await flowDynamic([
        {
          body: `Estado de cuenta ${cliente.CardName} - ${empresaValida}`,
          media: filePath,
        },
      ]);

      // Eliminar el archivo después de enviarlo usando una función más robusta
      deleteFileWithRetry(filePath);

      await flowDynamic([
        "✅ Estado de cuenta enviado correctamente.",
        "",
        "¿Necesitas algo más?",
        "Escribe *menu* para ver más opciones o *estado de cuenta* para consultar otro cliente"
      ]);
      
    } catch (fileError) {
      console.error("Error procesando el archivo:", fileError);
      await flowDynamic([
        "❌ Hubo un error al procesar el archivo del estado de cuenta.",
        "",
        "Por favor, intenta nuevamente más tarde o contacta a soporte técnico."
      ]);
    }
    
    // Limpiar el estado para futuras consultas
    await state.update({
      clienteSeleccionado: null,
      etapa: null,
      clienteUnico: null,
      ultimoMensaje: null,
      saltarSeleccionCliente: null,
      saltarSeleccionEmpresa: null,
      procesarComoEmpresa: null,
      finalizarFlujo: null,
      intentos: 0
    });
    
    return;
  } catch (error) {
    console.error("Error obteniendo estado de cuenta:", error);
    
    // Mensaje específico según el tipo de error
    const errorMsg = error.message?.includes("Timeout") 
      ? "⏱️ La generación del estado de cuenta está tardando demasiado tiempo." 
      : "❌ Hubo un error al generar el estado de cuenta.";
    
    await flowDynamic([
      errorMsg,
      "",
      "Por favor, verifica los datos e intenta nuevamente más tarde.",
      "Si el problema persiste, contacta con soporte técnico.",
      "",
      "Escribe *menu* para ver más opciones."
    ]);
    return;
  }
}

// Función para eliminar archivos con reintentos
function deleteFileWithRetry(filePath, maxRetries = 3, delayMs = 2000) {
  let attempts = 0;
  
  const attemptDelete = () => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Archivo temporal eliminado: ${filePath}`);
      }
    } catch (err) {
      console.error(`Error al eliminar archivo temporal (intento ${attempts + 1}): ${err}`);
      
      if (attempts < maxRetries) {
        attempts++;
        setTimeout(attemptDelete, delayMs);
      } else {
        console.error(`No se pudo eliminar el archivo después de ${maxRetries} intentos: ${filePath}`);
        
        // Programar una limpieza periódica para archivos temporales más antiguos
        scheduleTemporaryFileCleanup();
      }
    }
  };
  
  // Iniciar primer intento después de un breve retraso
  setTimeout(attemptDelete, 5000);
}

// Programar limpieza periódica de archivos temporales
function scheduleTemporaryFileCleanup() {
  // Esta función se puede llamar para programar una limpieza de archivos temporales
  // más antiguos que cierto tiempo (por ejemplo, 24 horas)
  const tempDir = path.join(process.cwd(), "temp");
  
  try {
    if (!fs.existsSync(tempDir)) return;
    
    // Obtener todos los archivos en el directorio temporal
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        // Si el archivo tiene más de 24 horas
        if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          console.log(`Archivo temporal antiguo eliminado: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error al procesar archivo temporal: ${err}`);
      }
    });
  } catch (err) {
    console.error(`Error en la limpieza de archivos temporales: ${err}`);
  }
}