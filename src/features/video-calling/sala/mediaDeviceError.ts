export type MediaDevice = 'microphone' | 'camera';

/** System permissions cannot be bypassed; make the required action visible. */
export function mediaDeviceError(error: unknown, device: MediaDevice): { name: string; message: string } {
  const data = error && typeof error === 'object' ? error as { name?: unknown; message?: unknown } : {};
  const name = String(data.name ?? 'UnknownError');
  const label = device === 'microphone' ? 'el micrófono' : 'la cámara';
  const permission = device === 'microphone' ? 'micrófono' : 'cámara';
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) {
    const system = /system|sistema/i.test(String(data.message ?? ''));
    return { name, message: system
      ? `Tu sistema bloqueó ${label}. Permite el acceso del navegador a ${permission} en los ajustes de privacidad del sistema y vuelve a intentarlo.`
      : `No se autorizó ${label}. Permite el acceso a ${permission} para este sitio en tu navegador y vuelve a intentarlo.` };
  }
  if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) return { name, message: `No se pudo abrir ${label}. Cierra otras aplicaciones que lo estén usando y vuelve a intentarlo.` };
  if (['NotFoundError', 'DevicesNotFoundError'].includes(name)) return { name, message: `No encontramos ${label}. Conecta un dispositivo y vuelve a intentarlo.` };
  return { name, message: `No se pudo activar ${label}. Revisa el dispositivo y sus permisos antes de volver a intentarlo.` };
}
