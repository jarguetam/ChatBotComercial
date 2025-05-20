import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";

export const byeFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  'adios', 
  'chao', 
  'hasta luego', 
  'bye', 
  'goodbye',
  'salir',
  'exit',
  'bye',
  'bye',
  'bye',
  'bye',
  'bye',
  'bye',
])
.addAction(async (ctx, { flowDynamic, provider, state }) => {
  await typing(ctx, provider);
  
  // Obtener el nombre del vendedor si está disponible
  const sellerName = await state.get('sellerName') || '';
  
  const despedida = sellerName 
    ? `👋 ¡Hasta pronto, ${sellerName}! Estoy aquí cuando necesites información comercial.` 
    : "👋 ¡Hasta pronto! Estoy aquí cuando necesites información comercial.";
  
  await flowDynamic(despedida);
  
  // Limpiar datos de sesión específicos
  await state.update({
    currentFlow: null,
    flujoAnterior: null,
    clienteSeleccionado: null,
    empresaSeleccionada: null
  });
}); 