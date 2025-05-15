import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import { ApiService } from "../services/apiService";

export const welcomeFlow = addKeyword<BaileysProvider, MysqlAdapter>(['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello'])
  .addAction(async (ctx, { flowDynamic, provider, state }) => {
    await typing(ctx, provider);
    
    // Validar vendedor
    const phone = ctx.from;
    try {
      const sellerData = await ApiService.validateSeller(phone);
      if (!sellerData) {
        await flowDynamic("❌ No se pudo identificar tu información de vendedor. Por favor, contacta al administrador.");
        return;
      }
      
      const sellerName = sellerData.nombre || sellerData.name || "Vendedor";
      const sellerCode = sellerData.code || sellerData.U_OS_CODIGO || sellerData.codigo;
      
      // Guardar datos del vendedor
      await state.update({ 
        sellerName,
        sellerCode,
        welcomeShown: true
      });
      
      await flowDynamic(
        [
          `👋 *¡Bienvenido ${sellerName}!*`,
          "",
          "Soy tu asistente virtual y puedo ayudarte con información sobre:",
          "",
          "• Metas mensuales",
          "• Datos de ventas recientes",
          "• Análisis de clientes importantes",
          "• Productos destacados",
          "• Inventario en tránsito",
          "• Límites de crédito disponibles",
          "• Estado de cuenta",
          "• Cuentas por cobrar",
          "¿En qué puedo ayudarte hoy?",
        ].join("\n")
      );
    } catch (error) {
      console.error("Error en welcomeFlow:", error);
      await flowDynamic("❌ Hubo un error al procesar tu solicitud. Intenta más tarde.");
    }
  }); 