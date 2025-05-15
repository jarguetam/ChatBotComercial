import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import { geminiAgent } from "./geminiAgent";
import { flowOrchestrator } from "./flowOrchestrator";
import { ApiService } from "../services/apiService";
import path from "path";
import fs from "fs";

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
        console.log("Redirigiendo al flujo de crédito...");
        // Limpiamos el flujo anterior para futuros usos y marcamos la redirección
        await state.update({ 
          flujoAnterior: null, 
          currentFlow: "credito",
          vieneDesdeFlujoEmpresa: true 
        });
        // Usar el orquestrador para manejar el flujo
        const intention = { flujo: "credito" };
        return await flowOrchestrator.routeToFlow(
          intention, 
          ctx, 
          { flowDynamic, provider, state, gotoFlow }
        );
      } else if (flujoAnterior === "inventario") {
        console.log("Redirigiendo al flujo de inventario...");
        // Limpiamos el flujo anterior para futuros usos y marcamos la redirección
        await state.update({ 
          flujoAnterior: null, 
          currentFlow: "inventario",
          vieneDesdeFlujoEmpresa: true 
        });
        // Usar el orquestador para manejar el flujo
        const intention = { flujo: "inventario" };
        return await flowOrchestrator.routeToFlow(
          intention, 
          ctx, 
          { flowDynamic, provider, state, gotoFlow }
        );
      } else if (flujoAnterior === "estadocuenta") {
        console.log("Redirigiendo al flujo de estado de cuenta...");
        console.log("Estado antes de la redirección:", {
          flujoAnterior,
          empresaSeleccionada,
          currentFlow: await state.get("currentFlow"),
          clienteSeleccionado: await state.get("clienteSeleccionado")
        });
        
        // Obtenemos los datos necesarios para generar el estado de cuenta
        const clienteSeleccionado = await state.get("clienteSeleccionado");
        
        if (!clienteSeleccionado) {
          await flowDynamic("❌ Hubo un problema al recuperar los datos del cliente seleccionado. Por favor, inténtalo nuevamente.");
          return;
        }
        
        try {
          // Consultar estado de cuenta para el cliente seleccionado
          const estadoCuentaData = await ApiService.getEstadoCuenta(
            clienteSeleccionado.CardCode,
            empresaSeleccionada
          );

          if (estadoCuentaData &&
              estadoCuentaData.success &&
              estadoCuentaData.base64Content) {
            // Crear una carpeta para guardar el PDF temporalmente
            const tempDir = path.join(process.cwd(), "temp");
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }

            // Crear un nombre de archivo único
            const fileName = `EstadoCuenta_${clienteSeleccionado.CardCode}_${empresaSeleccionada}_${Date.now()}.pdf`;
            const filePath = path.join(tempDir, fileName);

            // Guardar el PDF en el sistema de archivos
            fs.writeFileSync(
              filePath,
              Buffer.from(estadoCuentaData.base64Content, "base64")
            );

            // Mensaje informativo
            await flowDynamic(
              `📄 *Estado de Cuenta - ${clienteSeleccionado.CardName}*\n\nAquí tienes el estado de cuenta actualizado para el cliente.`
            );

            // Enviar el PDF usando flowDynamic con la ruta local
            await flowDynamic([
              {
                body: `Estado de cuenta para ${clienteSeleccionado.CardName} - ${empresaSeleccionada}`,
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
            await flowDynamic(
              "❌ No se encontró el estado de cuenta. Intenta más tarde."
            );
          }
        } catch (error) {
          console.error("Error obteniendo estado de cuenta:", error);
          await flowDynamic(
            "❌ Hubo un error al obtener el estado de cuenta. Intenta más tarde."
          );
        }

        // Limpiamos las variables de estado para futuros usos
        await state.update({ 
          flujoAnterior: null,
          clienteSeleccionado: null,
          clientesEncontrados: null,
          currentFlow: "menu"
        });

        await typing(ctx, provider);
        await flowDynamic(
          "¿Deseas ver otra información? Escribe *menu* para volver al menú principal."
        );
        return;
      }

      // Por defecto, volvemos al menú
      console.log("Redirigiendo al menú principal...");
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
