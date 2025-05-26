import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { ApiService } from "../../services/apiService";
import { typing } from "../../utils/presence";

export const ventasFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "2 Datos de ventas recientes",
  "2 Datos de ventas",
  "ventas",
  "mis ventas", 
  "ventas del mes",
  "ventas recientes",
  "2"
])
.addAction(async (ctx, { flowDynamic, provider, state, endFlow }) => {
  // Validación estricta: solo permitir comandos específicos de ventas
  const mensaje = ctx.body.trim().toLowerCase();
  
  // Lista de comandos válidos para ventas
  const comandosValidos = [
    "2",
    "ventas", 
    "mis ventas",
    "ventas del mes",
    "ventas recientes",
    "2 datos de ventas recientes",
    "2 datos de ventas"
  ];
  
  // Verificar si el mensaje es exactamente uno de los comandos válidos
  const esComandoValido = comandosValidos.some(comando => 
    mensaje === comando || mensaje.includes("ventas")
  );
  
  // Si el mensaje contiene números pero no es exactamente "2", rechazarlo
  if (/\d/.test(mensaje) && mensaje !== "2" && !mensaje.includes("ventas")) {
    console.log(`Mensaje "${ctx.body}" contiene números pero no es un comando válido para ventas`);
    return endFlow(); // Terminar el flujo completamente
  }
  
  if (!esComandoValido) {
    console.log(`Mensaje "${ctx.body}" no es un comando válido para ventas`);
    return endFlow(); // Terminar el flujo completamente
  }
  
  console.log(`Comando válido para ventas: "${ctx.body}"`);
})
.addAction(async (ctx, { flowDynamic, provider, state }) => {
  const phone = ctx.from;
  console.log("Número de teléfono en ventasFlow:", phone);
  await typing(ctx, provider);
  
  // Verificar si hay algún flujo bloqueando
  const blockedForOtherFlows = await state.get("blockedForOtherFlows");
  if (blockedForOtherFlows) {
    console.log("Flujo de ventas: No se puede iniciar porque otro flujo está bloqueando");
    return;
  }
  
  // Establecer el flujo actual
  await state.update({ currentFlow: "ventas" });
  
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

    // Obtener datos de ventas de los últimos 6 meses
    const responseData = await ApiService.getSalesSixMonthBySeller(sellerCode);
    console.log("Respuesta de getSalesSixMonthBySeller:", JSON.stringify(responseData));

    if (
      responseData &&
      responseData.response &&
      responseData.response.result
    ) {
      const salesData = responseData.response.result;
      console.log("Datos de ventas obtenidos:", salesData);

      await flowDynamic(
        "📊 *VENTAS DE LOS ÚLTIMOS 6 MESES*\n\nA continuación te muestro el detalle de tus ventas recientes:"
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
      const ferticaData = salesData.filter((item: any) => item.Empresa === "Fertica");
      const cadelgaData = salesData.filter((item: any) => item.Empresa === "Cadelga");

      // Función para obtener el nombre del mes en español
      const getMesEspanol = (mesIngles: string) => {
        const mesesTraduccion: Record<string, string> = {
          JANUARY: "Enero",
          FEBRUARY: "Febrero",
          MARCH: "Marzo",
          APRIL: "Abril",
          MAY: "Mayo",
          JUNE: "Junio",
          JULY: "Julio",
          AUGUST: "Agosto",
          SEPTEMBER: "Septiembre",
          OCTOBER: "Octubre",
          NOVEMBER: "Noviembre",
          DECEMBER: "Diciembre",
        };
        return mesesTraduccion[mesIngles] || mesIngles;
      };

      // Generar mensaje para Fertica
      let mensajeFertica = "";
      if (ferticaData.length > 0) {
        mensajeFertica =
          "*📊 Ventas Fertica:*\n\n" +
          ferticaData
            .map(
              (item: any) =>
                `*${getMesEspanol(item.Mes)} ${item.Año}:*\n` +
                `Venta: ${item.TM.toFixed(2)} TM\n`+
                `Meta: ${item.MetaMes} TM\n`+
                `Cumplimiento: ${(item.TM / item.MetaMes * 100).toFixed(2)}%\n`
            )
            .join("\n");
      }

      // Generar mensaje para Cadelga
      let mensajeCadelga = "";
      if (cadelgaData.length > 0) {
        mensajeCadelga =
          "*📊 Ventas Cadelga:*\n\n" +
          cadelgaData
            .map(
              (item: any) =>
                `*${getMesEspanol(item.Mes)} ${item.Año}:*\n` +
                `Venta: $${formatNumber(item.TM)}\n`+
                `Meta: $${formatNumber(item.MetaMes)}\n`+
                `Cumplimiento: ${(item.TM / item.MetaMes * 100).toFixed(2)}%\n`
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
        "❌ No se encontraron datos de ventas. Por favor, intenta más tarde."
      );
    }

    // Añadir mensaje para preguntar qué más desea saber o volver al menú
    await typing(ctx, provider);
    await flowDynamic("¿Qué más deseas saber? Escribe *menu* para volver al menú principal o indica qué otra información necesitas.");
    
  } catch (error) {
    console.error("Error en ventasFlow:", error);
    await flowDynamic("❌ Hubo un error al procesar la solicitud. Por favor, intenta más tarde.");
    
    // Añadir mensaje para volver al menú incluso en caso de error
    await typing(ctx, provider);
    await flowDynamic("Escribe *menu* para volver al menú principal.");
  }
}); 