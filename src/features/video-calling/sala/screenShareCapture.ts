import { VideoPreset, type ScreenShareCaptureOptions, type TrackPublishOptions } from 'livekit-client';

/**
 * Presentation audio. livekit-client only asks the browser for audio when
 * `audio` is set (`audio: options.audio ?? false`); otherwise the picker never offers
 * "Share audio" and a shared video plays silent for everyone. Voice DSP is disabled: it is tuned for
 * speech and damages music/video. `restrictOwnAudio` keeps the call's own output (other
 * people's voices) out of a system/window capture; unknown constraints are ignored.
 */
export const PRESENTATION_AUDIO: MediaTrackConstraints & { restrictOwnAudio?: boolean } = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 2,
  sampleRate: 48000,
  restrictOwnAudio: true,
};

export const SCREEN_SHARE_CAPTURE: ScreenShareCaptureOptions = {
  audio: PRESENTATION_AUDIO,
  systemAudio: 'include',
  // Sharing the call tab itself mirrors the room and loops its audio back to everyone.
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  suppressLocalAudioPlayback: false,
  // 27 sep 2026: la clase del 26 llego a los alumnos (y al servidor) a 960x540 y
  // ~11 fps. Se captura a 1080p/30 y se le dice al codificador que es TEXTO:
  // nitidez antes que movimiento. La grabacion HD sale del navegador del
  // anfitrion (grabacionLocal.ts); esto mejora lo que ven en vivo.
  resolution: { width: 1920, height: 1080, frameRate: 30 },
  contentHint: 'detail',
};

/**
 * Como se publica la pantalla. Con red apretada, el simulcast por defecto
 * apagaba la capa 1080p y mandaba solo 960x540: codigo ilegible. Ahora la capa
 * alta tiene prioridad de red y, si hay que ceder, cede cuadros por segundo
 * antes que resolucion. La capa baja (540p a 5 fps) queda solo para quien tiene
 * mala bajada, y cuesta poco para no robarle a la alta.
 */
export const SCREEN_SHARE_PUBLISH: TrackPublishOptions = {
  screenShareEncoding: { maxBitrate: 3_000_000, maxFramerate: 15, priority: 'high' },
  screenShareSimulcastLayers: [new VideoPreset(960, 540, 300_000, 5, 'low')],
  degradationPreference: 'maintain-resolution',
};

export type PresentationPlatform = 'mac' | 'windows' | 'safari' | 'other';

export function presentationPlatform(userAgent: string): PresentationPlatform {
  const ua = userAgent.toLowerCase();
  const chromium = /chrome|chromium|crios|edg\//.test(ua);
  if (!chromium && ua.includes('safari')) return 'safari';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'mac';
  return 'other';
}

/** What the presenter needs to hear, right when it matters. null = sound is shared. */
export function presentationAudioNotice(sharedAudio: boolean, platform: PresentationPlatform): string | null {
  if (sharedAudio) return null;
  if (platform === 'safari') {
    return 'Tu pantalla se ve, pero Safari no comparte sonido. Si vas a mostrar un video, entra a la clase con Chrome o Edge.';
  }
  const how = platform === 'windows'
    ? 'elige la pestaña y activa «Compartir audio de la pestaña», o elige Pantalla completa con «Compartir audio del sistema»'
    : 'elige la pestaña del video (no la ventana) y activa «Compartir audio de la pestaña»';
  return `Tu pantalla se comparte SIN sonido. Si vas a mostrar un video: deja de compartir, vuelve a compartir, ${how}.`;
}
