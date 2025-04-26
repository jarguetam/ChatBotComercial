import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";

export const empresaFlow = addKeyword<Provider, Database>([
  "empresa",
  "seleccionar empresa",
  "cambiar empresa",
])
  .addAnswer(
    [
      "🏢 *SELECCIÓN DE EMPRESA*",
      "",
      "Por favor, selecciona la empresa:",
      "",
      "1️⃣ Fertica",
      "2️⃣ Cadelga",
      "",
      "Escribe el número de la opción que deseas consultar.",
    ].join("\n"),
    {
      capture: true,
      buttons: [
        { body: "1️⃣ Fertica" },
        { body: "2️⃣ Cadelga" },
      ],
    },
    async (ctx, { flowDynamic, provider, state }) => {
      await typing(ctx, provider);
      const respuesta = ctx.body.toLowerCase().trim();
      let empresa = "";

      if (respuesta === "1" || respuesta.includes("fertica")) {
        empresa = "Fertica";
      } else if (respuesta === "2" || respuesta.includes("cadelga")) {
        empresa = "Cadelga";
      } else {
        await flowDynamic(
          "❌ Opción no válida. Por favor selecciona 1 para Fertica o 2 para Cadelga."
        );
        return;
      }

      // Guardar la empresa seleccionada en el estado
      await state.update({ empresaSeleccionada: empresa });
      return empresa;
    }
  ); 