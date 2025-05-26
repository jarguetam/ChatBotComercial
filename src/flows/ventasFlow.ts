import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import { ApiService } from "../services/apiService";
import { geminiAgent } from "./geminiAgent";
import { flowOrchestrator } from "./flowOrchestrator";

export const ventasFlow = addKeyword<Provider, Database>([
  "2️⃣",
  "2",
  "ventas",
  "venta",
  "vendido",
  "vendidos",
])
  .addAction(async (ctx, { flowDynamic, provider, state }) => {
    // Validar que el mensaje sea exactamente "2" o contenga "ventas"
    const mensaje = ctx.body.trim().toLowerCase();
    const esComandoValido = mensaje === "2" || 
                           mensaje === "2️⃣" ||
                           mensaje.includes("ventas") || 
                           mensaje.includes("venta") ||
                           mensaje.includes("vendido");
    
    if (!esComandoValido) {
      console.log(`Mensaje "${ctx.body}" no es un comando válido para ventas`);
      return; // No procesar este flujo
    }
    
    console.log(`Comando válido para ventas: "${ctx.body}"`);
  })
  .addAction(async (ctx, { flowDynamic, provider, state }) => {
    const phone = ctx.from;
    await typing(ctx, provider);

    try {
      // Validar si el número está registrado
      const sellerCode = await state.get("sellerCode");
      
      if (!sellerCode) {
        await flowDynamic(
          "❌ No puedo identificar tu código de vendedor. Por favor, escribe *menu* para volver al menú principal."
        );
        return;
      }

      // Obtenemos datos de ventas desde la API
      const responseData = await ApiService.getSalesSixMonthBySeller(sellerCode);

      if (
        responseData &&
        responseData.response &&
        responseData.response.result &&
        responseData.response.result.length > 0
      ) {
        const salesData = responseData.response.result;

        // Separar datos por empresa
        const ferticaData = salesData.filter(
          (item) => item.Empresa === "Fertica"
        );
        const cadelgaData = salesData.filter(
          (item) => item.Empresa === "Cadelga"
        );

        // Ordenar los datos por año y mes
        const sortByDate = (a, b) => {
          if (a.Año !== b.Año) return a.Año - b.Año;

          const meses = [
            "JANUARY",
            "FEBRUARY",
            "MARCH",
            "APRIL",
            "MAY",
            "JUNE",
            "JULY",
            "AUGUST",
            "SEPTEMBER",
            "OCTOBER",
            "NOVEMBER",
            "DECEMBER",
          ];
          return meses.indexOf(a.Mes) - meses.indexOf(b.Mes);
        };

        ferticaData.sort(sortByDate);
        cadelgaData.sort(sortByDate);

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

        // Función para obtener el nombre del mes en español
        const getMesEspanol = (mesIngles) => {
          const mesesTraduccion = {
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
                (item) =>
                  `*${getMesEspanol(item.Mes)} ${item.Año}:*\n` +
                  `Venta: $${formatNumber(item.TM)}\n`
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
                (item) =>
                  `*${getMesEspanol(item.Mes)} ${item.Año}:*\n` +
                  `Venta: $${formatNumber(item.TM)}\n`
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
    } catch (error) {
      console.error("Error obteniendo datos de ventas:", error);
      await flowDynamic(
        "❌ Hubo un error al obtener los datos de ventas. Por favor, intenta más tarde."
      );
    }

    await typing(ctx, provider);
    await flowDynamic(
      "¿Qué más te gustaría saber sobre tus ventas? También puedes escribir *menu* para volver al menú principal."
    );
  })
  .addAnswer(
    "", // Mensaje vacío ya que se manejará en el addAction
    {
      capture: true,
    },
    async (ctx, { flowDynamic, provider, gotoFlow, state }) => {
      const userMessage = ctx.body.toLowerCase();

      try {
        // Usar el geminiAgent para analizar la intención dentro del flujo actual
        const intention = await geminiAgent.analyzeFlowInput(userMessage, "ventas");
        
        // Si se detecta la necesidad de cambiar a un flujo específico, establecer valores predeterminados
        if (intention.flujo !== "default") {
          await flowOrchestrator.setDefaultStateValues(intention.flujo, state);
        }
        
        // Usar el orquestador para manejar la navegación entre flujos
        return await flowOrchestrator.routeToFlow(
          intention,
          ctx,
          { flowDynamic, provider, state, gotoFlow }
        );
      } catch (error) {
        console.error("Error procesando respuesta:", error);
        await flowDynamic(
          "Lo siento, no pude procesar tu solicitud. ¿Podrías intentarlo de nuevo o escribir *menu* para volver al menú principal?"
        );
      }
    }
  ); 