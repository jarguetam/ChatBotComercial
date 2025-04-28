import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { FlowIntention, FlowName } from "./geminiAgent";
import { typing } from "../utils/presence";

// Clase orquestadora para centralizar la navegación entre flujos
export class FlowOrchestrator {
  // Mapa de nombres de flujo a sus implementaciones
  private static flowMap: Record<string, any> = {};
  
  // Inicializar el mapa de flujos (se llamará desde app.ts después de importar todos los flujos)
  static initFlowMap(flows: Record<string, any>): void {
    this.flowMap = flows;
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
    
    // Guardar el flujo actual en el estado para futuras referencias
    const flow = intention.flujo as FlowName;
    
    // Si no es un flujo válido, mostrar respuesta conversacional
    if (flow === "default" && intention.respuesta) {
      await flowDynamic(intention.respuesta);
      return;
    }
    
    // Actualizar el estado con el flujo actual
    await state.update({ currentFlow: flow });
    
    // Redirigir al flujo correspondiente
    if (this.flowMap[flow]) {
      return gotoFlow(this.flowMap[flow]);
    } else {
      console.error(`Flujo no encontrado: ${flow}`);
      await flowDynamic(
        "Lo siento, no pude procesar tu solicitud correctamente. ¿Podrías intentarlo de nuevo?"
      );
    }
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
      default: "¿Cómo puedo ayudarte? Puedes preguntarme por ventas, clientes, productos, inventario, metas o créditos."
    };

    return responses[currentFlow] || responses.default;
  }

  // Establecer valores predeterminados en los estados antes de cambiar de flujo
  static async setDefaultStateValues(
    targetFlow: string,
    state: any
  ): Promise<void> {
    // Valores comunes que deben estar disponibles al cambiar entre flujos
    const currentFlow = await state.get("currentFlow") || "default";
    
    if (targetFlow === "inventario" || targetFlow === "credito") {
      // Estos flujos requieren tener una empresa seleccionada
      const empresaSeleccionada = await state.get("empresaSeleccionada");
      
      if (!empresaSeleccionada) {
        // Si no hay empresa seleccionada, guardar el flujo actual como "anterior"
        // para redirigir después de seleccionar empresa
        await state.update({ flujoAnterior: targetFlow });
      }
    }
  }
}

export const flowOrchestrator = FlowOrchestrator; 