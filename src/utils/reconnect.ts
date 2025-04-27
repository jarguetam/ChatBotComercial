/**
 * Utilidad para manejar reconexiones de Baileys
 */
// Eliminamos la importación directa y definimos las constantes que necesitamos
const DISCONNECT_REASONS = {
  loggedOut: 401, // Código cuando se cierra sesión
  connectionClosed: 428 // Código cuando se pierde la conexión
};

export const handleConnectionUpdate = (update: any, startSock: () => void) => {
  const { connection, lastDisconnect } = update;
  
  // Si la conexión se actualiza a 'close'
  if (connection === 'close') {
    // Obtenemos el código de error Baileys
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    
    console.log('Conexión cerrada. Código de estado:', statusCode);
    
    // Si el error es por Logout (intentar conectar a una sesión cerrada)
    // O si el error es 428 (Connection Closed)
    if (
      statusCode === DISCONNECT_REASONS.loggedOut || 
      statusCode === DISCONNECT_REASONS.connectionClosed
    ) {
      console.log('Sesión cerrada o expirada, reiniciando...');
      // Aquí podrías implementar una limpieza de la sesión anterior
      // Por ejemplo, eliminar archivos baileys_*
    }
    
    // Intentamos reconectar con retraso para evitar bucles rápidos de reconexión
    console.log('Intentando reconectar en 5 segundos...');
    setTimeout(() => {
      console.log('Reconectando...');
      startSock();
    }, 5000);
  }
  
  // Si la conexión cambia a 'open'
  if (connection === 'open') {
    console.log('Conexión establecida correctamente');
  }
}; 