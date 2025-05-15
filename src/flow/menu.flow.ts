import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MysqlAdapter } from "@builderbot/database-mysql";
import { typing } from "../utils/presence";
import fs from "fs";
import path from "path";

// Helper para logs
const logDebug = (message: string) => {
  console.log(`[MENU] ${message}`);
  try {
    const logPath = path.join(process.cwd(), "logs", "flow_debug.log");
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] [MENU] ${message}\n`
    );
  } catch (error) {
    console.error("Error escribiendo log:", error);
  }
};

export const menuFlow = addKeyword<BaileysProvider, MysqlAdapter>([
  "menu",
  "menú",
  "MENU",
  "MENÚ",
  "volver",
  "VOLVER",
  "opciones",
  "ayuda",
  "help",
]).addAction(async (ctx, { flowDynamic, provider, state }) => {
  await typing(ctx, provider);

  // Obtener estado actual para diagnosticar
  const currentFlow = await state.get("currentFlow");
  const blockedForOtherFlows = await state.get("blockedForOtherFlows");
  const esperandoSeleccionCliente = await state.get(
    "esperandoSeleccionCliente"
  );

  logDebug(
    `Menú iniciado. Estado actual - Flujo: ${currentFlow}, Bloqueado: ${blockedForOtherFlows}, EsperandoSelección: ${esperandoSeleccionCliente}`
  );

  // Resetear todos los estados de control de flujos
  await state.update({
    currentFlow: "menu",
    blockedForOtherFlows: false,
    esperandoInput: false,
    esperandoSeleccionCliente: false,
    esperandoEmpresaSeleccion: false,
  });

  const menuOptions = [
    "📊 *MENÚ PRINCIPAL*",
    "",
    "• Metas del mes",
    "• Datos de ventas recientes",
    "• Análisis de clientes importantes",
    "• Productos destacados",
    "• Inventario en tránsito",
    "• Límites de crédito disponibles",
    "• Estado de cuenta",
    "• Cuentas por cobrar",
    "",
    "Escribe el número de la opción o puedes preguntarme directamente lo que necesites.",
  ].join("\n");

  logDebug("Mostrando menú principal");
  await flowDynamic(menuOptions);
});
