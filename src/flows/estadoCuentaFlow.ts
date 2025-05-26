import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";
import { empresaFlow } from "./empresaFlow";


// Crear un flujo de estado de cuenta con cloneFlow para evitar problemas de estado compartido
export const estadoCuentaFlow = addKeyword<Provider, Database>([
  "7️⃣",
  "7️⃣ Estado de cuenta",
  "7",
  "Estado de cuenta",
  "cuenta",
  "estado cuenta",
  "estado de cuenta",
  "estado de cuentas",
  "estado de cuentas de clientes",
  "estado de cuentas de cliente",
])
  .addAction(async (ctx, { flowDynamic, provider, state, endFlow }) => {
    // Validar que el mensaje sea exactamente "7" o contenga "estado" o "cuenta"
    const mensaje = ctx.body.trim().toLowerCase();
    const esComandoValido = mensaje === "7" || 
                           mensaje === "7️⃣" ||
                           mensaje.includes("estado") ||
                           mensaje.includes("cuenta");
    
    if (!esComandoValido) {
      console.log(`Mensaje "${ctx.body}" no es un comando válido para estado de cuenta`);
      return; // No procesar este flujo
    }
    
    console.log(`Comando válido para estado de cuenta: "${ctx.body}"`);
  })
  .addAction(async (ctx, { flowDynamic, provider, state, endFlow }) => {
    console.log("INICIO DE FLUJO ESTADO CUENTA - VALIDACIÓN VENDEDOR");
    await typing(ctx, provider);
    const phone = ctx.from;
    try {
      const sellerData = await ApiService.validateSeller(phone);
      if (!sellerData) {
        return endFlow("❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde.\n¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
      }
      const sellerCode = sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      // Establecer el currentFlow explícitamente y crear una ID única de conversación
      await state.update({ 
        sellerCode, 
        currentFlow: "estadocuenta",
        estadoCuentaSessionId: Date.now().toString() 
      });
      console.log("Vendedor validado:", sellerCode);
    } catch (error) {
      console.error("Error validando vendedor en estadoCuentaFlow:", error);
      return endFlow("❌ Hubo un error al procesar tu solicitud. Intenta más tarde.");
    }
  })
  .addAnswer(
    "👤 Por favor, escribe el nombre o código del cliente para buscar su estado de cuenta.",
    { capture: true },
    async (ctx, { flowDynamic, provider, state, fallBack }) => {
      console.log("PASO 1: CAPTURANDO BÚSQUEDA DE CLIENTE");
      await typing(ctx, provider);
      const searchTerm = ctx.body.trim();
      if (!searchTerm) {
        return fallBack("Por favor, ingresa un término de búsqueda."); 
      }
      console.log("Término de búsqueda recibido:", searchTerm);
      try {
        const response = await ApiService.searchClients(searchTerm);
        console.log("Respuesta de API searchClients:", JSON.stringify(response));
        if (!response || !response.response || !response.response.result || response.response.result.length === 0) {
          return fallBack("❌ No se encontraron clientes. Intenta con otro nombre/código o escribe *cancelar*.");
        }
        const clientes = response.response.result;
        console.log("Clientes encontrados:", clientes.length);
        
        // Guardar clientes encontrados y asegurar que estamos en el flujo correcto
        await state.update({ 
          clientesEncontrados: clientes, 
          currentFlow: "estadocuenta",
          esperandoSeleccionCliente: true
        });
        
        // Crear la lista de clientes
        const clientesList = clientes.map((cliente, index) => `${index + 1}. ${cliente.CardName} (${cliente.CardCode})`).join('\n');
        
        // Crear una lista de botones para facilitar la selección
        const buttons = clientes.length <= 10 ? 
          clientes.map((_, index) => ({ body: `${index + 1}` })) : [];
        
        console.log("CLIENTE ENCONTRADO - PREPARANDO MOSTRAR LISTA:", clientes.length, "clientes");
        
        // Enviar mensaje con lista y esperar selección
        if (buttons.length > 0) {
          await flowDynamic([{
            body: `📋 *Clientes encontrados:*\n\n${clientesList}\n\nSelecciona el número del cliente o escribe *cancelar* para salir.`,
            buttons
          }]);
        } else {
          await flowDynamic(`📋 *Clientes encontrados:*\n\n${clientesList}\n\nEscribe el número del cliente o escribe *cancelar* para salir.`);
        }
      } catch (error) {
        console.error("Error buscando clientes:", error);
        return fallBack("❌ Hubo un error al buscar clientes. Intenta más tarde o escribe *cancelar*.");
      }
    }
  )
  .addAnswer(
    [
      "*Selecciona un cliente de la lista*",
      "",
      "👆 *Escribe el número* que corresponde al cliente que deseas consultar, o escribe *cancelar* para salir."
    ].join("\n"), 
    { 
      capture: true,
      delay: 1500 
    },
    async (ctx, { flowDynamic, provider, state, gotoFlow, fallBack }) => {
      console.log("=================================================");
      console.log("PASO 2: PROCESANDO SELECCIÓN DE CLIENTE");
      console.log("==> MENSAJE RECIBIDO:", ctx.body);
      console.log("==> ESTADO ACTUAL:", await state.get("currentFlow"));
      console.log("==> ESPERANDO SELECCIÓN:", await state.get("esperandoSeleccionCliente"));
      console.log("==> CLIENTES ENCONTRADOS:", await state.get("clientesEncontrados") ? (await state.get("clientesEncontrados")).length : 0);
      
      // Desactivar la espera de selección (previene problemas si el flujo se interrumpe)
      await state.update({ esperandoSeleccionCliente: false });
      
      const seleccion = ctx.body.trim();
      console.log("==> SELECCIÓN PROCESADA:", seleccion);
      
      if (seleccion.toLowerCase() === 'cancelar') {
        await flowDynamic("Operación cancelada.");
        return;
      }
      
      // Obtener clientes del estado
      const clientesEncontrados = await state.get("clientesEncontrados");
      if (!clientesEncontrados || !Array.isArray(clientesEncontrados)) {
        console.log("Error: No hay 'clientesEncontrados' en el estado");
        await flowDynamic("❌ Error interno. Por favor, intenta iniciar el proceso de nuevo.");
        return;
      }
      
      // Procesar la selección
      let clienteSeleccionado = null;
      if (/^[0-9]+$/.test(seleccion)) {
        // Si es un número, buscamos por índice
        const indice = parseInt(seleccion) - 1;
        if (indice >= 0 && indice < clientesEncontrados.length) {
          clienteSeleccionado = clientesEncontrados[indice];
        }
      } else {
        // Si no es un número, buscamos por nombre o código
        const seleccionLowerCase = seleccion.toLowerCase();
        clienteSeleccionado = clientesEncontrados.find(
          cliente => cliente.CardCode === seleccion || 
                     cliente.CardName.toLowerCase().includes(seleccionLowerCase)
        );
      }
      
      // Verificar si se encontró un cliente
      if (!clienteSeleccionado) {
        await flowDynamic("❌ Selección inválida. Por favor, vuelve a intentarlo con un número de la lista.");
        return;
      }
      
      console.log("CLIENTE SELECCIONADO CORRECTAMENTE:", clienteSeleccionado.CardCode, clienteSeleccionado.CardName);
      
      // Actualizar estado y redirigir al flujo de empresa
      await state.update({ 
        clienteSeleccionado, 
        flujoAnterior: "estadocuenta", 
        currentFlow: "empresaSeleccion"
      });
      
      await flowDynamic(`Has seleccionado: *${clienteSeleccionado.CardName}*\n\nAhora, indica de qué empresa deseas el estado de cuenta.`);
      
      try {
        // const { empresaSeleccionFlow } = await import("../flow/estado-cuenta/empresaSeleccion.flow");
        // return gotoFlow(empresaSeleccionFlow);
      } catch (error) {
        console.error("Error redirigiendo al flujo de empresa:", error);
        await flowDynamic("❌ Error interno. Por favor, escribe *menu* para volver al menú principal.");
      }
    }
  );
