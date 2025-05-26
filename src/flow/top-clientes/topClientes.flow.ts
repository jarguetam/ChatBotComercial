import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { ApiService } from "../../services/apiService";
import { typing } from "../../utils/presence";

export const topClientesFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "3 Análisis de clientes importantes",
  "3 Análisis de clientes",
  "3",
  "top clientes",
  "clientes",
  "mejores clientes",
  "principales clientes"
])
.addAction(async (ctx, { flowDynamic, provider, state, endFlow }) => {
  // Validación estricta: solo permitir comandos específicos de top clientes
  const mensaje = ctx.body.trim().toLowerCase();
  
  // Lista de comandos válidos para top clientes
  const comandosValidos = [
    "3",
    "top clientes",
    "clientes",
    "mejores clientes", 
    "principales clientes",
    "3 análisis de clientes importantes",
    "3 análisis de clientes",
    "3 analisis de clientes"
  ];
  
  // Verificar si el mensaje es exactamente uno de los comandos válidos
  const esComandoValido = comandosValidos.some(comando => 
    mensaje === comando || mensaje.includes("clientes")
  );
  
  // Si el mensaje contiene números pero no es exactamente "3", rechazarlo
  if (/\d/.test(mensaje) && mensaje !== "3" && !mensaje.includes("clientes")) {
    console.log(`Mensaje "${ctx.body}" contiene números pero no es un comando válido para top clientes`);
    return endFlow(); // Terminar el flujo completamente
  }
  
  if (!esComandoValido) {
    console.log(`Mensaje "${ctx.body}" no es un comando válido para top clientes`);
    return endFlow(); // Terminar el flujo completamente
  }
  
  console.log(`Comando válido para top clientes: "${ctx.body}"`);
})
.addAction(async (ctx, { flowDynamic, provider, state }) => {
  const phone = ctx.from;
  console.log("Número de teléfono en topClientesFlow:", phone);
  await typing(ctx, provider);
  
  // Establecer el flujo actual
  await state.update({ currentFlow: "clientes" });
  
  try {
    const sellerData = await ApiService.validateSeller(phone);
    if (!sellerData) {
      await flowDynamic(
        "❌ No se pudo identificar tu información de vendedor. Por favor, intenta más tarde."
      );
      await typing(ctx, provider);
      await flowDynamic("¿Deseas ver otra información? Escribe *menu* para volver al menú principal.");
      return;
    }

    const sellerName = sellerData.nombre || sellerData.name || "Vendedor";
    const sellerCode = sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
    console.log("Código del vendedor obtenido:", sellerCode);
    
    // Guardar datos del vendedor
    await state.update({ sellerName, sellerCode });

    // Obtener los top clientes
    const responseData = await ApiService.getTopCustomerBySeller(sellerCode);
    console.log("Respuesta de getTopCustomerBySeller:", JSON.stringify(responseData));

    if (responseData && responseData.response && responseData.response.result) {
      const clientData = responseData.response.result;
      console.log("Datos de clientes obtenidos:", clientData);

      await flowDynamic(
        "👥 *TOP CLIENTES*\n\nA continuación te muestro el detalle de tus clientes principales:"
      );

      // Función para formatear números
      const formatNumber = (num: any) => {
        try {
          // Convertir a número si es string
          const numberValue = typeof num === 'string' ? parseFloat(num) : Number(num);
          
          // Verificar si es un número válido
          if (isNaN(numberValue)) {
            console.error('Valor no numérico recibido:', num);
            return '0.00';
          }
          
          // Formatear el número
          const parts = numberValue.toFixed(2).split('.');
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          return parts.join('.');
        } catch (error) {
          console.error('Error formateando número:', error);
          return '0.00';
        }
      };

      // Separar datos de Fertica y Cadelga
      const ferticaClients = clientData.filter((item: any) => item.Empresa === "Fertica");
      const cadelgaClients = clientData.filter((item: any) => item.Empresa === "Cadelga");

      // Generar mensaje para Fertica
      let mensajeFertica = "";
      if (ferticaClients.length > 0) {
        mensajeFertica =
          "*👥 Top Clientes Fertica:*\n\n" +
          ferticaClients
            .sort((a: any, b: any) => b.Ventas - a.Ventas)
            .slice(0, 10)
            .map(
              (item: any, index: number) =>
                `*${index + 1}. ${item.NombreCliente}*\n` +
                `Ventas: ${formatNumber(item.Ventas)} TM\n`
            )
            .join("\n");
      }

      // Generar mensaje para Cadelga
      let mensajeCadelga = "";
      if (cadelgaClients.length > 0) {
        mensajeCadelga =
          "*👥 Top Clientes Cadelga:*\n\n" +
          cadelgaClients
            .sort((a: any, b: any) => b.TotalVentas - a.TotalVentas)
            .slice(0, 10)
            .map(
              (item: any, index: number) =>
                `*${index + 1}. ${item.NombreCliente}*\n` +
                `Ventas: $${formatNumber(item.TotalVentas)}\n`
            )
            .join("\n");
      }

      // Enviar mensajes por separado para mejor legibilidad
      if (mensajeFertica) {
        await flowDynamic(mensajeFertica);
      }

      if (mensajeCadelga) {
        await flowDynamic(mensajeCadelga);
      }
    } else {
      await flowDynamic(
        "❌ No se encontraron datos de clientes. Por favor, intenta más tarde."
      );
    }

    // Añadir mensaje para preguntar qué más desea saber o volver al menú
    await typing(ctx, provider);
    await flowDynamic("¿Qué más deseas saber sobre tus clientes? Escribe *menu* para volver al menú principal o indica qué otra información necesitas.");
    
  } catch (error) {
    console.error("Error en topClientesFlow:", error);
    await flowDynamic("❌ Hubo un error al procesar la solicitud. Por favor, intenta más tarde.");
    
    // Añadir mensaje para volver al menú incluso en caso de error
    await typing(ctx, provider);
    await flowDynamic("Escribe *menu* para volver al menú principal.");
  }
}); 