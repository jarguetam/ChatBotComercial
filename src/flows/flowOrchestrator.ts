import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { FlowIntention, FlowName } from "./geminiAgent";
import { typing } from "../utils/presence";
import fs from "fs";
import path from "path";

// Helper para logs
const logDebug = (message: string) => {
  console.log(`[ORCHESTRATOR] ${message}`);
  try {
    const logPath = path.join(process.cwd(), "logs", "flow_debug.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [ORCHESTRATOR] ${message}\n`);
  } catch (error) {
    console.error("Error escribiendo log:", error);
  }
};

// Clase orquestadora para centralizar la navegación entre flujos
export class FlowOrchestrator {
  // Mapa de nombres de flujo a sus implementaciones
  private static flowMap: Record<string, any> = {};
  
  // Inicializar el mapa de flujos (se llamará desde app.ts después de importar todos los flujos)
  static initFlowMap(flows: Record<string, any>): void {
    this.flowMap = flows;
    logDebug(`Flujos inicializados: ${Object.keys(flows).join(', ')}`);
  }

  // Función para redirigir a un flujo específico basado en la intención detectada
  static async routeToFlow(
    intention: FlowIntention,
    ctx: any,
    { flowDynamic, provider, state, gotoFlow }: { 
      flowDynamic: any;
      provider: Provider;
      state: any;
      gotoFlow: any;
    }
  ): Promise<any> {
    await typing(ctx, provider);
    
    // Obtener flujo actual y nuevo
    const currentFlow = await state.get("currentFlow") || "default";
    const flow = intention.flujo as FlowName;
    
    // Guardar estado previo para diagnóstico
    const blockedForOtherFlows = await state.get("blockedForOtherFlows");
    logDebug(`Estado previo a cambio de flujo - Bloqueado: ${blockedForOtherFlows}, Flujo actual: ${currentFlow}`);
    
    // Verificar si está bloqueado para otros flujos (para diagnóstico)
    if (blockedForOtherFlows === true && currentFlow !== "menu") {
      logDebug(`ADVERTENCIA: Intentando cambiar flujo mientras está bloqueado. De ${currentFlow} a ${flow}`);
    }
    
    // Limpiar estados de espera al cambiar de flujo
    if (currentFlow !== flow) {
      await this.cleanWaitingStates(state);
    }
    
    logDebug(`Redirigiendo de flujo "${currentFlow}" a flujo "${flow}"`);
    
    // Si no es un flujo válido, mostrar respuesta conversacional
    if (flow === "default" && intention.respuesta) {
      logDebug(`No se identificó flujo específico, mostrando respuesta: "${intention.respuesta.substring(0, 50)}..."`);
      await flowDynamic(intention.respuesta);
      return;
    }
    
    // Actualizar el estado con el flujo actual y asegurar que no está bloqueado
    await state.update({ 
      currentFlow: flow,
      blockedForOtherFlows: false 
    });
    
    // Redirigir al flujo correspondiente
    if (this.flowMap[flow]) {
      logDebug(`Flujo "${flow}" encontrado, redirigiendo...`);
      
      // Configuración específica para algunos flujos
      if (flow === 'estadocuenta') {
        logDebug('Configurando estado para estado de cuenta');
        await state.update({
          esperandoInput: false,
          esperandoSeleccionCliente: false,
          esperandoEmpresaSeleccion: false,
          blockedForOtherFlows: false,
          clienteSeleccionado: null,
          empresaSeleccionada: null
        });
      }
      
      try {
        return gotoFlow(this.flowMap[flow]);
      } catch (error) {
        logDebug(`Error redirigiendo al flujo ${flow}: ${error}`);
        await flowDynamic("Lo siento, hubo un problema al procesar tu solicitud. Por favor intenta nuevamente.");
      }
    } else {
      logDebug(`Error: Flujo "${flow}" no encontrado`);
      console.error(`Flujo no encontrado: ${flow}`);
      console.log("Flujos disponibles:", Object.keys(this.flowMap));
      await flowDynamic(
        "Lo siento, no pude procesar tu solicitud correctamente. ¿Podrías intentarlo de nuevo?"
      );
    }
  }

  // Limpiar estados de espera cuando se cambia de flujo
  static async cleanWaitingStates(state: any): Promise<void> {
    logDebug("Limpiando estados de espera");
    await state.update({
      esperandoInput: false,
      esperandoSeleccionCliente: false,
      esperandoEmpresaSeleccion: false,
      blockedForOtherFlows: false
    });
  }

  // Obtener una respuesta genérica cuando el usuario está en un flujo específico
  static async getGenericFlowResponse(currentFlow: string): Promise<string> {
    const responses: Record<string, string> = {
      meta: "¿Qué más te gustaría saber sobre tus metas comerciales? Puedes consultar tus KPIs o el progreso mensual.",
      ventas: "¿Qué otra información sobre ventas necesitas? Puedo mostrarte tendencias, comparativas o datos específicos.",
      clientes: "¿Qué más quieres saber sobre tus clientes principales? Puedo mostrarte rankings, frecuencia o volumen de compras.",
      productos: "¿Qué otra información sobre productos te interesa? Puedo mostrarte los más vendidos o análisis de stock.",
      inventario: "¿Qué más necesitas saber sobre el inventario? Puedo mostrarte productos en tránsito o disponibilidad.",
      credito: "¿Qué otra información sobre límites de crédito necesitas? Puedo mostrarte disponibilidad por cliente.",
      empresa: "¿Con qué empresa quieres trabajar? Fertica o Cadelga.",
      menu: "¿En qué puedo ayudarte ahora?",
      estadocuenta: "¿Qué más necesitas saber sobre el estado de cuenta? Puedes preguntarme por el saldo, pagos pendientes o fechas de vencimiento.",
      default: "¿Cómo puedo ayudarte? Puedes preguntarme por ventas, clientes, productos, inventario, metas o créditos."
    };

    logDebug(`Generando respuesta genérica para flujo: ${currentFlow}`);
    return responses[currentFlow] || responses.default;
  }

  // Establecer valores predeterminados en los estados antes de cambiar de flujo
  static async setDefaultStateValues(
    targetFlow: string,
    state: any
  ): Promise<void> {
    // Valores comunes que deben estar disponibles al cambiar entre flujos
    const currentFlow = await state.get("currentFlow") || "default";
    
    logDebug(`Estableciendo valores predeterminados para cambio de "${currentFlow}" a "${targetFlow}"`);
    
    if (targetFlow === "inventario" || targetFlow === "credito" || targetFlow === "estadocuenta") {
      // Estos flujos requieren tener una empresa seleccionada
      const empresaSeleccionada = await state.get("empresaSeleccionada");
      
      if (!empresaSeleccionada) {
        // Si no hay empresa seleccionada, guardar el flujo actual como "anterior"
        // para redirigir después de seleccionar empresa
        logDebug(`No hay empresa seleccionada, guardando flujo anterior: ${targetFlow}`);
        await state.update({ flujoAnterior: targetFlow });
      }
    }
    
    // Actualizar el flujo actual y asegurar que no está bloqueado para otros flujos
    await state.update({ 
      currentFlow: targetFlow,
      blockedForOtherFlows: false 
    });
    
    // Reiniciar flags específicamente para estado de cuenta
    if (targetFlow === "estadocuenta") {
      await state.update({
        esperandoInput: false,
        esperandoSeleccionCliente: false,
        esperandoEmpresaSeleccion: false
      });
    }
  }
}

export const flowOrchestrator = FlowOrchestrator; 