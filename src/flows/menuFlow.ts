import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import { 
  metaMensualFlow, 
  ventasFlow, 
  topClientesFlow, 
  topProductosFlow, 
  inventarioFlow 
} from "./index";
import { limitesCreditoFlow } from "./limitesCreditoFlow";

export const menuFlow = addKeyword<Provider, Database>([
  "menu",
  "menú",
  "MENU",
  "MENÚ",
  "volver",
  "VOLVER",
])
  .addAnswer(
    [
      "👋 *¡Bienvenido al Sistema de Información Comercial!*",
      "",
      "Por favor, selecciona una opción:",
      "",
      "1️⃣ Meta mensual",
      "2️⃣ Ventas últimos 6 meses",
      "3️⃣ Top Clientes",
      "4️⃣ Top Productos",
      "5️⃣ Consultar inventario en transito",
      "6️⃣ Limites de credito disponibles",
      "Escribe el número de la opción que deseas consultar.",
    ].join("\n"),
    { 
      capture: true,
      buttons: [
        { body: "1️⃣ Meta mensual" },
        { body: "2️⃣ Ventas últimos 6 meses" },
        { body: "3️⃣ Top Clientes" },
        { body: "4️⃣ Top Productos" },
        { body: "5️⃣ Consultar inventario en transito" },
        { body: "6️⃣ Limites de credito disponibles" },
      ]
    },
    async (ctx, { flowDynamic, provider, gotoFlow }) => {
      await typing(ctx, provider);
      const respuesta = ctx.body.toLowerCase();

      // Manejar la respuesta del usuario
      if (respuesta === "1" || respuesta.includes("meta")) {
        return gotoFlow(metaMensualFlow);
      } else if (respuesta === "2" || respuesta.includes("ventas")) {
        //await flowDynamic("Has seleccionado: Ventas últimos 6 meses");
        return gotoFlow(ventasFlow);
      } else if (respuesta === "3" || respuesta.includes("clientes")) {
        //await flowDynamic("Has seleccionado: Top Clientes");
        return gotoFlow(topClientesFlow);
      } else if (respuesta === "4" || respuesta.includes("productos")) {
        //await flowDynamic("Has seleccionado: Top Productos");
        return gotoFlow(topProductosFlow);
      } else if (respuesta === "5" || respuesta.includes("inventario")) {
        //await flowDynamic("Has seleccionado: Consultar inventario en transito");
        return gotoFlow(inventarioFlow);
      } else if (respuesta === "6" || respuesta.includes("credito")) {
        //await flowDynamic("Has seleccionado: Limites de credito disponibles");
        return gotoFlow(limitesCreditoFlow);
      } else {
        await flowDynamic(
          "❌ Opción no válida. Por favor, selecciona un número del 1 al 5."
        );
      }
    }
  ); 