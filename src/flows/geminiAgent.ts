import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// Configuración de Gemini
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY no está definida en el archivo .env");
}

const genAI = new GoogleGenerativeAI(API_KEY);

const generationConfig = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Información sobre los servicios disponibles para el contexto de Gemini
const serviciosDisponibles = {
  meta: "Información sobre meta del mes, objetivos de ventas y seguimiento de KPIs",
  ventas: "Datos de ventas de los últimos 6 meses, con análisis de tendencias y comparativas",
  clientes: "Listado de los mejores clientes por volumen de compra o frecuencia",
  productos: "Productos más vendidos, con análisis de stock y demanda",
  inventario: "Estado del inventario en tránsito, fechas de llegada y cantidades",
  credito: "Información sobre límites de crédito disponibles para clientes",
  empresa: "Selección de empresa (Fertica o Cadelga) para consultas específicas",
};

// Tipo para la intención detectada
export type FlowIntention = {
  flujo: string;  // Nombre del flujo a dirigir
  respuesta?: string; // Respuesta conversacional (solo si no se detecta un flujo específico)
};

// Nombres de flujos válidos
export type FlowName = 
  | "menu" 
  | "meta" 
  | "ventas" 
  | "clientes" 
  | "productos" 
  | "inventario" 
  | "credito" 
  | "empresa"
  | "default"; // Para respuestas conversacionales

export class GeminiAgent {
  // Obtener una instancia del modelo Gemini para uso directo
  static async getModel(customConfig?: any) {
    const config = customConfig || {
      model: "gemini-1.5-flash",
      generationConfig,
      safetySettings,
    };
    return genAI.getGenerativeModel(config);
  }

  // Analizar el mensaje principal de entrada (desde el flujo de menú)
  static async analyzeMainInput(userMessage: string): Promise<FlowIntention> {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig,
        safetySettings,
      });

      const prompt = `Eres un asistente comercial inteligente para una empresa. Debes ser profesional, amable y eficiente.

CONTEXTO IMPORTANTE:
El usuario está utilizando un chatbot de WhatsApp para consultar información comercial. Puedes ayudar con los siguientes temas:
${JSON.stringify(serviciosDisponibles, null, 2)}

El mensaje del usuario es: "${userMessage}"

INSTRUCCIONES:
1. Analiza la intención del usuario y categorízala según estos posibles flujos:
   - "meta": Si pregunta sobre metas mensuales o KPIs
   - "ventas": Si consulta sobre ventas recientes o tendencias
   - "clientes": Si quiere información sobre clientes importantes o mis mejores clientes
   - "productos": Si busca datos de productos destacados o mejores productos
   - "inventario": Si necesita información de inventario en tránsito
   - "credito": Si pregunta sobre límites de crédito de clientes
   - "empresa": Si necesita seleccionar o cambiar de empresa (Fertica o Cadelga)

2. Si identificas CLARAMENTE que el usuario quiere información sobre alguno de estos temas específicos, responde ÚNICAMENTE con la palabra clave correspondiente (meta, ventas, clientes, productos, inventario, credito, empresa).

3. Si la consulta es ambigua o es un saludo/pregunta general, responde de forma conversacional y útil, sugiriendo qué información puedes proporcionarle, pero NO respondas con ninguna palabra clave.

Responde de forma directa, sin preámbulos ni explicaciones adicionales.`;

      const result = await model.generateContent(prompt);
      const geminiResponse = result.response.text().trim();
      const lowerResponse = geminiResponse.toLowerCase();

      const validFlows: Record<string, boolean> = {
        "meta": true,
        "ventas": true,
        "clientes": true,
        "productos": true,
        "inventario": true,
        "credito": true,
        "empresa": true,
        "menu": true,
      };

      // Verificar si Gemini identificó un flujo específico
      if (validFlows[lowerResponse]) {
        return { flujo: lowerResponse };
      } else {
        // Si no identificó un flujo específico, usar como respuesta conversacional
        return { flujo: "default", respuesta: geminiResponse };
      }
    } catch (error) {
      console.error("Error al analizar con Gemini:", error);
      return { 
        flujo: "default", 
        respuesta: "Lo siento, estoy teniendo problemas para procesar tu solicitud en este momento. ¿Podrías intentarlo nuevamente o formular tu pregunta de otra manera?" 
      };
    }
  }

  // Analizar mensajes cuando el usuario ya está en un flujo específico
  static async analyzeFlowInput(userMessage: string, currentFlow: string): Promise<FlowIntention> {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig,
        safetySettings,
      });

      const prompt = `El usuario está en el flujo de ${currentFlow} y ha escrito: "${userMessage}"
      
      INSTRUCCIONES:
      1. Si el usuario quiere ver otro tipo de información (productos, clientes, etc.), responde con la palabra clave correspondiente.
      2. Si el usuario quiere volver al menú o hacer una pregunta general, responde con "menu".
      3. Si la consulta es específica sobre ${currentFlow}, responde de forma conversacional y útil.
      
      Responde con una sola palabra clave (meta, ventas, clientes, productos, inventario, credito, empresa, menu) o un mensaje conversacional.`;

      const result = await model.generateContent(prompt);
      const geminiResponse = result.response.text().trim();
      const lowerResponse = geminiResponse.toLowerCase();

      const validFlows: Record<string, boolean> = {
        "meta": true,
        "ventas": true,
        "clientes": true,
        "productos": true,
        "inventario": true,
        "credito": true,
        "empresa": true,
        "menu": true,
      };

      // Verificar si Gemini identificó un flujo específico
      if (validFlows[lowerResponse]) {
        return { flujo: lowerResponse };
      } else {
        // Si no identificó un flujo específico, usar como respuesta conversacional
        return { flujo: "default", respuesta: geminiResponse };
      }
    } catch (error) {
      console.error("Error al analizar con Gemini dentro del flujo:", error);
      return { 
        flujo: "default", 
        respuesta: "Lo siento, no pude procesar tu solicitud. ¿Podrías intentarlo de nuevo o escribir *menu* para volver al menú principal?" 
      };
    }
  }

  // Generar respuesta personalizada para el saludo de bienvenida
  static async generateGreeting(sellerName: string): Promise<string> {
    try {
      const AGENT_NAME = "DataBot";
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
        }
      });

      const prompt = `Genera un saludo amigable, breve y profesional para un vendedor llamado ${sellerName}. 
      El saludo debe ser en español, cálido pero profesional, y debe dar la bienvenida al sistema de información comercial. 
      Hazlo personal usando su nombre. No uses más de 3 líneas. No agregues opciones ni menús. 
      Saludo como ${AGENT_NAME}.`;
      
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error("Error generando saludo:", error);
      return `¡Hola ${sellerName}! 👋 Soy DataBot, tu Asistente Comercial. ¿En qué puedo ayudarte hoy?`;
    }
  }
}

export const geminiAgent = GeminiAgent; 