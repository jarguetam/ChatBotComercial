import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { ApiService } from "../../services/apiService";
import { typing } from "../../utils/presence";

export const topProductosFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "4️⃣ Productos destacados", 
  "4 Productos destacados",
  "4",
  "Productos destacados",
  "top productos",
  "productos",
  "mejores productos",
  "principales productos"
])
.addAction(async (ctx, { flowDynamic, provider, state }) => {
  const phone = ctx.from;
  console.log("Número de teléfono en topProductosFlow:", phone);
  await typing(ctx, provider);
  
  // Establecer el flujo actual
  await state.update({ currentFlow: "productos" });
  
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

    // Obtener los top productos
    const responseData = await ApiService.getTopProductBySeller(sellerCode);
    console.log("Respuesta de getTopProductBySeller:", JSON.stringify(responseData));

    if (responseData && responseData.response && responseData.response.result) {
      const productData = responseData.response.result;
      console.log("Datos de productos obtenidos:", productData);

      await flowDynamic(
        "📦 *TOP PRODUCTOS*\n\nA continuación te muestro el detalle de tus productos más vendidos:"
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
      const ferticaProducts = productData.filter((item: any) => item.Empresa === "Fertica");
      const cadelgaProducts = productData.filter((item: any) => item.Empresa === "Cadelga");

      // Generar mensaje para Fertica
      let mensajeFertica = "";
      if (ferticaProducts.length > 0) {
        mensajeFertica =
          "*📦 Top Productos Fertica:*\n\n" +
          ferticaProducts
            .sort((a: any, b: any) => b.VentasTM - a.VentasTM)
            .slice(0, 10)
            .map(
              (item: any, index: number) =>
                `*${index + 1}. ${item.NombreProducto}*\n` +
                `Ventas: ${formatNumber(item.VentasTM)} TM\n`
            )
            .join("\n");
      }

      // Generar mensaje para Cadelga
      let mensajeCadelga = "";
      if (cadelgaProducts.length > 0) {
        mensajeCadelga =
          "*📦 Top Productos Cadelga:*\n\n" +
          cadelgaProducts
            .sort((a: any, b: any) => b.TotalVentas - a.TotalVentas)
            .slice(0, 10)
            .map(
              (item: any, index: number) =>
                `*${index + 1}. ${item.NombreProducto}*\n` +
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
        "❌ No se encontraron datos de productos. Por favor, intenta más tarde."
      );
    }

    // Añadir mensaje para preguntar qué más desea saber o volver al menú
    await typing(ctx, provider);
    await flowDynamic("¿Qué más deseas saber sobre tus productos? Escribe *menu* para volver al menú principal o indica qué otra información necesitas.");
    
  } catch (error) {
    console.error("Error en topProductosFlow:", error);
    await flowDynamic("❌ Hubo un error al procesar la solicitud. Por favor, intenta más tarde.");
    
    // Añadir mensaje para volver al menú incluso en caso de error
    await typing(ctx, provider);
    await flowDynamic("Escribe *menu* para volver al menú principal.");
  }
}); 