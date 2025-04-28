import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import { geminiAgent } from "./geminiAgent";
import { flowOrchestrator } from "./flowOrchestrator";

export const empresaFlow = addKeyword<Provider, Database>([
  "empresa",
  "seleccionar empresa",
  "cambiar empresa",
  "elegir empresa",
])
  .addAnswer(
    [
      "🏢 *Selección de Empresa*",
      "",
      "¿Con qué empresa deseas trabajar? Puedes escribir el nombre (Fertica o Cadelga) o indicarme tu preferencia de forma natural.",
    ].join("\n"),
    { capture: true }
  )
  .addAction(async (ctx, { flowDynamic, provider, state, gotoFlow }) => {
    await typing(ctx, provider);

    const userMessage = ctx.body;
    const respuesta = userMessage.toLowerCase().trim();

    // Obtenemos el flujo anterior para saber dónde volver
    const flujoAnterior = (await state.get("flujoAnterior")) || "menu";
    console.log("Flujo anterior:", flujoAnterior);

    let empresaSeleccionada = null;

    // Verificación directa de palabras clave
    if (respuesta.includes("fertica")) {
      empresaSeleccionada = "Fertica";
    } else if (respuesta.includes("cadelga")) {
      empresaSeleccionada = "Cadelga";
    }

    // Si no encontramos las palabras clave directas, usamos Gemini
    if (!empresaSeleccionada) {
      try {
        const prompt = `Determina qué empresa está seleccionando el usuario entre dos opciones: Fertica o Cadelga.
        
        El mensaje del usuario es: "${userMessage}"
        
        Si el mensaje se refiere claramente a Fertica, responde únicamente: "fertica"
        Si el mensaje se refiere claramente a Cadelga, responde únicamente: "cadelga"
        Si no está claro o no menciona ninguna empresa, responde con una pregunta breve pidiendo aclaración.
        
        Respuesta:`;

        // Usar el modelo Gemini centralizado en geminiAgent
        const geminiModel = await geminiAgent.getModel({
          model: "gemini-1.5-flash",
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
          }
        });
        const result = await geminiModel.generateContent(prompt);
        const geminiResponse = result.response.text().trim().toLowerCase();

        if (geminiResponse === "fertica") {
          empresaSeleccionada = "Fertica";
        } else if (geminiResponse === "cadelga") {
          empresaSeleccionada = "Cadelga";
        }
      } catch (error) {
        console.error("Error con Gemini:", error);
      }
    }

    // Si aún no tenemos una empresa seleccionada, verificamos palabras clave básicas
    if (!empresaSeleccionada) {
      if (respuesta.includes("1") || respuesta.includes("primera")) {
        empresaSeleccionada = "Fertica";
      } else if (respuesta.includes("2") || respuesta.includes("segunda")) {
        empresaSeleccionada = "Cadelga";
      }
    }

    // Si tenemos una empresa seleccionada, la guardamos y continuamos
    if (empresaSeleccionada) {
      await seleccionarEmpresa(empresaSeleccionada, state, flowDynamic);

      // Si venimos de un flujo específico, continuamos con ese flujo
      if (flujoAnterior === "limitesCredito" || flujoAnterior === "credito") {
        // Limpiamos el flujo anterior para futuros usos
        await state.update({ flujoAnterior: null, currentFlow: "credito" });
        // Usar el orquestrador para manejar el flujo
        const intention = { flujo: "credito" };
        return await flowOrchestrator.routeToFlow(
          intention, 
          ctx, 
          { flowDynamic, provider, state, gotoFlow }
        );
      } else if (flujoAnterior === "inventario") {
        // Limpiamos el flujo anterior para futuros usos
        await state.update({ flujoAnterior: null, currentFlow: "inventario" });
        // Usar el orquestrador para manejar el flujo
        const intention = { flujo: "inventario" };
        return await flowOrchestrator.routeToFlow(
          intention, 
          ctx, 
          { flowDynamic, provider, state, gotoFlow }
        );
      }

      // Por defecto, volvemos al menú
      await state.update({ currentFlow: "menu" });
      const intention = { flujo: "menu" };
      return await flowOrchestrator.routeToFlow(
        intention, 
        ctx, 
        { flowDynamic, provider, state, gotoFlow }
      );
    } else {
      // Si no pudimos determinar la empresa, pedimos aclaración
      await flowDynamic(
        "No he podido identificar qué empresa deseas seleccionar. Por favor, escribe 'Fertica' o 'Cadelga' para continuar."
      );
    }
  });

// Función auxiliar para seleccionar empresa
async function seleccionarEmpresa(empresa, state, flowDynamic) {
  console.log("Seleccionando empresa:", empresa);
  await state.update({ empresaSeleccionada: empresa });
  const empresaGuardada = await state.get("empresaSeleccionada");
  console.log("Empresa guardada en estado:", empresaGuardada);
  await flowDynamic(`✅ Has seleccionado *${empresa}*.`);
}
