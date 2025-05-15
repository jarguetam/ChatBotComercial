import { addKeyword, EVENTS } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { typing } from "../../utils/presence";
import { ApiService } from "../../services/apiService";
import fs from 'fs';
import path from 'path';

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
      ultimoMensaje: null
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
        "👤 *Consulta de Estado de Cuenta*",
      ]);

      return;
    } catch (error) {
      console.error("Error validando vendedor:", error);
      await flowDynamic("❌ Hubo un error al validar tu información. Por favor, intenta más tarde.");
      return;
    }
  })
  // PASO 1: Capturar el nombre o código del cliente
  .addAnswer(
    "Escribe el nombre o código del cliente",
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      const searchTerm = ctx.body.trim();
      console.log(`Búsqueda de cliente: ${searchTerm}`);

      if (searchTerm.toLowerCase() === 'cancelar') {
        await flowDynamic("Operación cancelada. Escribe *menu* para ver más opciones.");
        return;
      }

      try {
        console.log(`Buscando clientes con término: ${searchTerm}`);
        const response = await ApiService.searchClients(searchTerm);

        if (!response?.response?.result?.length) {
          await flowDynamic("❌ No se encontraron clientes con ese nombre o código. Por favor, intenta con otro término.");
          return;
        }

        const clientes = response.response.result;
        console.log(`Se encontraron ${clientes.length} clientes`);

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
            "Ahora, escribe el nombre de la empresa para consultar el estado de cuenta",
            "Opciones disponibles: *Fertica* o *Cadelga*",
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
          mensajeClientes.push("Escribe el *número* del cliente que deseas consultar o *cancelar* para salir");

          await flowDynamic(mensajeClientes.join("\n"));
          return;
        }
      } catch (error) {
        console.error("Error buscando clientes:", error);
        await flowDynamic("❌ Hubo un error al buscar clientes. Por favor, intenta más tarde.");
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
    "Selecciona un cliente de la lista",
    { capture: true },
    async (ctx, { flowDynamic, state, provider }) => {
      console.log(`[PASO 2B] Recibida entrada: "${ctx.body}"`);
      
      // Verificar en qué etapa estamos
      const etapa = await state.get("etapa");
      const clienteUnico = await state.get("clienteUnico");
      const ultimoMensaje = await state.get("ultimoMensaje");
      const procesarComoEmpresa = await state.get("procesarComoEmpresa");
      
      console.log(`[PASO 2B] Estado actual: etapa=${etapa}, clienteUnico=${clienteUnico}, ultimoMensaje=${ultimoMensaje}, procesarComoEmpresa=${procesarComoEmpresa}`);

      // Si tenemos que procesar como empresa (cliente único)
      if (procesarComoEmpresa === true) {
        const cliente = await state.get("clienteSeleccionado");
        if (!cliente) {
          console.log("[PASO 2B] Error: No hay cliente seleccionado a pesar de tener procesarComoEmpresa=true");
          await flowDynamic("❌ Ha ocurrido un error en el flujo. Por favor, escribe *estado de cuenta* para comenzar de nuevo.");
          return;
        }
        
        // Usar esta entrada como la empresa seleccionada
        const empresa = ctx.body.trim();
        console.log(`[PASO 2B] Tratando entrada como empresa: ${empresa}`);
        
        // Verificamos si la empresa es válida
        const empresaValida = empresa.toLowerCase();
        if (empresaValida !== "fertica" && empresaValida !== "cadelga") {
          console.log("[PASO 2B] Empresa no válida para cliente único");
          await flowDynamic([
            "❌ Empresa no válida.",
            "Por favor, escribe *Fertica* o *Cadelga*"
          ]);
          return;
        }
        
        // Actualizar el estado para omitir el siguiente paso de selección de empresa
        await state.update({ 
          saltarSeleccionEmpresa: true,
          ultimoMensaje: 'empresa_seleccionada'
        });
        await typing(ctx, provider);
        // Procesar directamente
        return await obtenerEstadoCuenta(cliente, empresaValida, { flowDynamic, state });
      }
      
      // Procesamos selección de cliente de la lista
      if (etapa === 'seleccion_cliente') {
        const clientesEncontrados = await state.get("clientesEncontrados");
        console.log(`[PASO 2B] Procesando selección de cliente de lista. Opciones: ${clientesEncontrados?.length}`);
        
        const seleccion = ctx.body.trim();
        
        if (seleccion.toLowerCase() === 'cancelar') {
          await flowDynamic("Operación cancelada. Escribe *menu* para ver más opciones.");
          return;
        }
        
        if (/^\d+$/.test(seleccion)) {
          const indice = parseInt(seleccion) - 1;
          if (indice >= 0 && indice < clientesEncontrados.length) {
            const cliente = clientesEncontrados[indice];
            console.log(`[PASO 2B] Cliente seleccionado de lista: ${cliente.CardName}`);
            
            await state.update({
              clienteSeleccionado: cliente,
              clientesEncontrados: null,
              etapa: 'seleccion_empresa',
              ultimoMensaje: 'cliente_seleccionado',
              saltarSeleccionEmpresa: false // No saltar el próximo paso de selección de empresa
            });
            
            await flowDynamic([
              `✅ Cliente seleccionado: *${cliente.CardName}*`,
              "",
              "Ahora, escribe el nombre de la empresa para consultar el estado de cuenta",
              "Opciones disponibles: *Fertica* o *Cadelga*"
            ]);
            return;
          }
        }
        
        await flowDynamic("❌ Selección inválida. Por favor, elige un número de la lista o escribe *cancelar*.");
        return;
      }
      
      console.log(`[PASO 2B] Estado no esperado. Etapa=${etapa}, ultimoMensaje=${ultimoMensaje}`);
      await flowDynamic("❌ Ha ocurrido un error en el flujo. Por favor, escribe *estado de cuenta* para comenzar de nuevo.");
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
    "Escribe el nombre de la empresa",
    { capture: true },
    async (ctx, { flowDynamic, state, provider }) => {
      // Si ya finalizamos el flujo (cliente único ya procesado), salimos
      const finalizarFlujo = await state.get("finalizarFlujo");
      if (finalizarFlujo === true) {
        console.log("[PASO 3B] Flujo ya finalizado, ignorando este paso");
        return;
      }
      
      console.log(`[PASO 3B] Recibida entrada para empresa: "${ctx.body}"`);
      
      // Verificar en qué etapa estamos
      const etapa = await state.get("etapa");
      const ultimoMensaje = await state.get("ultimoMensaje");
      
      console.log(`[PASO 3B] Estado actual: etapa=${etapa}, ultimoMensaje=${ultimoMensaje}`);
      
      // PROCESAMIENTO DE EMPRESA (cliente ya seleccionado)
      if (etapa === 'seleccion_empresa' && ultimoMensaje === 'cliente_seleccionado') {
        const cliente = await state.get("clienteSeleccionado");
        if (!cliente) {
          console.log("[PASO 3B] Error: No hay cliente seleccionado en etapa seleccion_empresa");
          await flowDynamic("❌ Ha ocurrido un error en el flujo. Por favor, escribe *estado de cuenta* para comenzar de nuevo.");
          return;
        }
        
        const empresa = ctx.body.trim();
        console.log(`[PASO 3B] Empresa ingresada: ${empresa} para cliente: ${cliente.CardName}`);
        
        const empresaValida = empresa.toLowerCase();
        if (empresaValida !== "fertica" && empresaValida !== "cadelga") {
          console.log("[PASO 3B] Empresa no válida");
          await flowDynamic([
            "❌ Empresa no válida.",
            "Por favor, escribe *Fertica* o *Cadelga*"
          ]);
          return;
        }
        
        // Actualizar el último mensaje
        await state.update({ ultimoMensaje: 'empresa_seleccionada' });
        await typing(ctx, provider);
        // Procesar la solicitud
        return await obtenerEstadoCuenta(cliente, empresaValida, { flowDynamic, state });
      }
      
      // Si llegamos aquí, algo está mal con el estado
      console.log(`[PASO 3B] Estado no esperado. Etapa=${etapa}, ultimoMensaje=${ultimoMensaje}`);
      await flowDynamic("❌ Ha ocurrido un error en el flujo. Por favor, escribe *estado de cuenta* para comenzar de nuevo.");
    }
  ); 

// Función auxiliar para obtener y procesar el estado de cuenta
async function obtenerEstadoCuenta(cliente, empresaValida, { flowDynamic, state }) {
  console.log(`Obteniendo estado de cuenta para ${cliente.CardCode} en ${empresaValida}`);
  
  
  await flowDynamic([
    "Descargando estado de cuenta..."
  ]);
  
  try {
    console.log("Llamando a ApiService.getEstadoCuenta");
    const response = await ApiService.getEstadoCuenta(cliente.CardCode, empresaValida);
    console.log("Respuesta de API recibida:", response ? "OK" : "Error");
    
    if (!response || !response.pdfBase64) {
      console.log("No se pudo obtener el estado de cuenta");
      await flowDynamic([
        "❌ No se pudo obtener el estado de cuenta.",
        "El cliente no tiene saldo pendiente."
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
    const fileName = `Estado_Cuenta${cliente.CardCode}_${empresaValida}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    // Guardar el PDF en el sistema de archivos
    fs.writeFileSync(
      filePath,
      Buffer.from(response.pdfBase64, "base64")
    );

    // Mensaje informativo
    await flowDynamic([
      `📄 *Estado de Cuenta ${cliente.CardName} - ${empresaValida}*`,
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
      "Escribe *menu* para ver más opciones o *estado de cuenta* para consultar otro cliente"
    ]);
    
    // Limpiar el estado para futuras consultas
    await state.update({
      clienteSeleccionado: null,
      etapa: null,
      clienteUnico: null,
      ultimoMensaje: null,
      saltarSeleccionCliente: null,
      saltarSeleccionEmpresa: null,
      procesarComoEmpresa: null,
      finalizarFlujo: null
    });
    
    return;
  } catch (error) {
    console.error("Error obteniendo estado de cuenta:", error);
    await flowDynamic([
      "❌ Hubo un error al generar el estado de cuenta.",
      "Por favor, verifica los datos e intenta nuevamente."
    ]);
    return;
  }
}