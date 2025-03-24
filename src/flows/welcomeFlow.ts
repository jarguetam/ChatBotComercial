import { addKeyword } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { ApiService } from "../services/apiService";
import { typing } from "../utils/presence";

export const welcomeFlow = addKeyword<Provider, Database>([
  "hi",
  "hello",
  "hola",
  "buen día",
  "buenas",
  "buenos días",
  "buenas tardes",
  "buenas noches",
])
  .addAction(async (ctx, { flowDynamic, state, provider }) => {
    await typing(ctx, provider);
    // Extraer el número de teléfono del contexto
    const phone = ctx.from;
    console.log("Número de teléfono en welcomeFlow:", phone);

    try {
      // Validar si el número está registrado
      const sellerData = await ApiService.validateSeller(phone);
      console.log("Datos del vendedor:", JSON.stringify(sellerData));

      if (sellerData) {
        // Verificar la estructura de datos del vendedor
        console.log("Estructura de sellerData:", Object.keys(sellerData));

        // Guardar la información del vendedor en el estado
        // Garantizamos que el código se guarde correctamente
        const sellerCode =
          sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
        const sellerName =
          sellerData.name || sellerData.SlpName || sellerData.nombre;

        console.log(
          "Guardando en estado: código:",
          sellerCode,
          "nombre:",
          sellerName
        );

        await state.update({
          isRegistered: true,
          sellerName: sellerName,
          sellerCode: sellerCode,
        });

        // Verificar que se haya guardado correctamente
        const storedCode = await state.get("sellerCode");
        console.log("Código almacenado en estado:", storedCode);

        // Mensaje para vendedor registrado
        await flowDynamic(`Hola ${sellerName} 👋!   Es un gusto tenerte aquí.`);
      } else {
        // Actualizar estado como no registrado
        await state.update({ isRegistered: false });

        // Mensaje para número no registrado
        await flowDynamic(
          "¡Hola que tal!   Parece que tu número no está registrado. Si eres un vendedor de Grupo Cadelga, favor comunícate al departamento de Data BI 👋"
        );
      }
    } catch (error) {
      console.error("Error en welcomeFlow:", error);
      await flowDynamic(
        "¡Hola! Estamos experimentando problemas técnicos. Por favor, intenta más tarde."
      );
    }
  })
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
      "",
      "Escribe el número de la opción que deseas consultar.",
    ].join("\n"),
    {
      buttons: [
        { body: "1️⃣ Meta mensual" },
        { body: "2️⃣ Ventas últimos 6 meses" },
        { body: "3️⃣ Top Clientes" },
        { body: "4️⃣ Top Productos" },
        { body: "5️⃣ Consultar inventario en transito" },
        { body: "6️⃣ Limites de credito disponibles" },
      ],
      capture: true,
    }
  ); 