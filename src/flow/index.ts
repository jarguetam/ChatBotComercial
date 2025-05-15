import { createFlow } from "@builderbot/bot";
import { welcomeFlow } from "./welcome.flow";
import { byeFlow } from "./bye.flow";
import { menuFlow } from "./menu.flow";
import { metaMensualFlow } from "./meta-mensual/metaMensual.flow";
import { ventasFlow } from "./ventas/ventas.flow";
import { topClientesFlow } from "./top-clientes/topClientes.flow";
import { topProductosFlow } from "./top-productos/topProductos.flow";
import { inventarioFlow } from "./inventario/inventario.flow";
import { limitesCreditoFlow } from "./limites-credito/limitesCredito.flow";
import { estadoCuentaFlow } from "./estado-cuenta/estadoCuenta.flow";
import { cuentasPorCobrarNuevoFlow } from "./cuentas-por-cobrar/cuentasCobrar.flow";

// Exportar todos los flujos individuales para acceso directo
export {
  welcomeFlow,
  byeFlow,
  menuFlow,
  metaMensualFlow,
  ventasFlow,
  topClientesFlow,
  topProductosFlow,
  inventarioFlow,
  limitesCreditoFlow,
  cuentasPorCobrarNuevoFlow
};

// Crear y exportar el flujo combinado
export const flow = createFlow([
  welcomeFlow,
  byeFlow,
  menuFlow,
  metaMensualFlow,
  ventasFlow,
  topClientesFlow,
  topProductosFlow,
  inventarioFlow,
  limitesCreditoFlow,
  cuentasPorCobrarNuevoFlow,
  estadoCuentaFlow
]); 