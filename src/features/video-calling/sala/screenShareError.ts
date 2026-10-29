/** Capture errors can come from another realm or the SDK, not just DOMException. */
export function screenShareError(error: unknown): { name: string; message: string } {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : 'UnknownError';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return { name, message: 'No se autorizó compartir pantalla. Si cancelaste el selector, vuelve a intentarlo. Si elegiste una pantalla, revisa el permiso de grabación de pantalla del navegador en tu sistema.' };
  if (name === 'NotReadableError') return { name, message: 'El sistema no pudo capturar esa pantalla. Revisa los permisos de grabación de pantalla o intenta compartir otra ventana.' };
  if (name === 'InvalidStateError') return { name, message: 'Vuelve a pulsar Compartir pantalla con esta pestaña al frente.' };
  if (name === 'NotFoundError') return { name, message: 'No hay una pantalla disponible para compartir. Abre la ventana que quieres mostrar e inténtalo otra vez.' };
  return { name, message: 'No se pudo compartir la pantalla. Intenta otra ventana; si persiste, avisa al anfitrión.' };
}
