# Chatbot Comercial con BuilderBot

Este proyecto implementa un chatbot comercial utilizando la biblioteca BuilderBot, diseñado para proporcionar información relevante a vendedores sobre sus metas, ventas, clientes, productos, inventario, límites de crédito y estados de cuenta.

## Estructura del Proyecto

```
src/
├── app.ts                # Punto de entrada principal de la aplicación
├── config.ts             # Configuración general y variables de entorno
├── database/             # Configuración de base de datos
│   └── index.ts          # Exportación del adaptador de base de datos
├── flow/                 # Flujos de conversación
│   ├── index.ts          # Combina y exporta todos los flujos
│   ├── welcome.flow.ts   # Flujo de bienvenida
│   ├── menu.flow.ts      # Flujo del menú principal
│   ├── bye.flow.ts       # Flujo de despedida
│   ├── media.flow.ts     # Flujo para archivos multimedia
│   └── estado-cuenta/    # Flujos específicos de estado de cuenta
│       ├── estadoCuenta.flow.ts     # Flujo principal
│       ├── clienteSeleccion.flow.ts # Flujo para seleccionar cliente
│       └── empresaSeleccion.flow.ts # Flujo para seleccionar empresa
├── provider/             # Proveedores de mensajería
│   └── index.ts          # Configuración del proveedor de Baileys
├── services/             # Servicios y API
│   └── apiService.ts     # Servicio para interactuar con API externa
└── utils/                # Utilidades varias
    └── presence.ts       # Utilidad para mostrar indicadores de escritura
```

## Arquitectura

El chatbot está diseñado siguiendo un enfoque modular, donde cada funcionalidad está separada en flujos independientes que pueden interactuar entre sí. La navegación entre flujos se realiza mediante el patrón `gotoFlow`.

### Flujos de Conversación

Cada flujo está implementado como un módulo independiente que puede:

1. **Validar al usuario** (vendedor)
2. **Guardar información** en el estado de la conversación
3. **Mostrar opciones** al usuario
4. **Capturar respuestas** y procesarlas
5. **Derivar a otros flujos** cuando sea necesario

### Patrón de Cambio de Flujo

Para cambiar de un flujo a otro, se utiliza el patrón recomendado por BuilderBot:

```typescript
// En el flujo de origen
.addAnswer(
  "Pregunta", 
  { capture: true },
  async (ctx, { gotoFlow }) => {
    // Procesar respuesta
    // ...
    
    // Importar dinámicamente el flujo destino
    const { destinoFlow } = await import('./destino.flow');
    
    // Redirigir al flujo destino
    return gotoFlow(destinoFlow);
  }
)
```

### Estado Compartido

Los flujos comparten información a través del objeto `state`, que permite:

- Guardar datos con `state.update({ clave: valor })`
- Obtener datos con `await state.get("clave")`
- Rastrear el flujo actual con `currentFlow`

## Implementación de Estado de Cuenta

El flujo de estado de cuenta está separado en tres etapas:

1. **Inicio y Validación** (`estadoCuenta.flow.ts`)
   - Valida al vendedor
   - Registra inicio del flujo
   - Solicita información del cliente
   
2. **Selección de Cliente** (`clienteSeleccion.flow.ts`)
   - Busca clientes por nombre o código
   - Muestra resultados al usuario
   - Procesa la selección
   
3. **Selección de Empresa y Generación de PDF** (`empresaSeleccion.flow.ts`)
   - Muestra opciones de empresa (Fertica o Cadelga)
   - Solicita el PDF de estado de cuenta
   - Envía el documento al usuario

## Desarrollo

### Requisitos

- Node.js v16 o superior
- NPM o PNPM

### Instalación

```bash
npm install
```

### Configuración

Crea un archivo `.env` con las siguientes variables:

```
PORT=3008
API_BASE_URL=https://api.empresa.com
GEMINI_API_KEY=your_gemini_api_key
```

### Ejecución

```bash
npm run dev
```

## Contribuciones

Para contribuir, sigue estos pasos:

1. Crea un nuevo flujo en `src/flow`
2. Implementa la lógica necesaria
3. Exporta el flujo en `src/flow/index.ts`
4. Asegúrate de manejar correctamente los estados y transiciones

## Referencia

Para más información sobre BuilderBot, consulta la [documentación oficial](https://www.builderbot.app/).