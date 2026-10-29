import { createLocalScreenTracks, LocalAudioTrack, LocalVideoTrack, Track, type ScreenShareCaptureOptions } from 'livekit-client';
import { SCREEN_SHARE_CAPTURE } from './screenShareCapture';

/**
 * Cambiar la ventana compartida sin cortar la pantalla (6 oct 2026).
 * Antes el presentador tenia que dejar de compartir y volver a compartir: cada ciclo
 * crea un track screen_share NUEVO (SID nuevo) que el grabador del servidor a veces no
 * recoge, y los alumnos ven un hueco. Aqui se pide otra captura y se cambia la fuente
 * DENTRO del LocalVideoTrack ya publicado con replaceTrack: mismo SID, grabacion continua.
 * replaceTrack mueve el listener `ended` al track nuevo, asi que el «Dejar de compartir»
 * del navegador sigue disparando el flujo normal de LiveKit.
 */
export type ResultadoCambioVentana = { estado: 'cambiada'; conSonido: boolean } | { estado: 'cancelada' } | { estado: 'sin_pantalla' };

interface PublicacionLocal { track?: unknown }
export interface ParticipanteLocalMin {
  getTrackPublication(source: Track.Source): PublicacionLocal | undefined;
}

/** El selector del navegador se cerro sin elegir: no es un fallo, la pantalla actual sigue. */
export function esCancelacionSelector(error: unknown): boolean {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  return name === 'NotAllowedError' || name === 'AbortError' || name === 'PermissionDeniedError';
}

export async function cambiarVentanaCompartida(
  participante: ParticipanteLocalMin,
  opciones: ScreenShareCaptureOptions = SCREEN_SHARE_CAPTURE,
  capturar: typeof createLocalScreenTracks = createLocalScreenTracks,
): Promise<ResultadoCambioVentana> {
  const video = participante.getTrackPublication(Track.Source.ScreenShare)?.track;
  if (!(video instanceof LocalVideoTrack)) return { estado: 'sin_pantalla' };

  let capturados: Awaited<ReturnType<typeof createLocalScreenTracks>>;
  try {
    // Copia: livekit puede completar la resolucion sobre el objeto recibido.
    capturados = await capturar({ ...opciones });
  } catch (err) {
    if (esCancelacionSelector(err)) return { estado: 'cancelada' };
    throw err;
  }

  const nuevoVideo = capturados.find((t) => t.kind === Track.Kind.Video)?.mediaStreamTrack;
  const nuevoAudio = capturados.find((t) => t.kind === Track.Kind.Audio)?.mediaStreamTrack;
  const detener = () => { capturados.forEach((t) => t.mediaStreamTrack.stop()); };
  if (!nuevoVideo) { detener(); return { estado: 'sin_pantalla' }; }
  if (opciones.contentHint) nuevoVideo.contentHint = opciones.contentHint;

  const viejoVideo = video.mediaStreamTrack;
  try {
    await video.replaceTrack(nuevoVideo, { userProvidedTrack: false });
  } catch (err) {
    detener(); // la pantalla vieja sigue intacta
    throw err;
  }
  viejoVideo.stop();

  // Audio: solo si ya hay uno publicado; si no, se descarta el nuevo (no se publica un track extra).
  const audio = participante.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
  let conSonido = audio instanceof LocalAudioTrack;
  if (nuevoAudio) {
    if (audio instanceof LocalAudioTrack) {
      const viejoAudio = audio.mediaStreamTrack;
      try {
        await audio.replaceTrack(nuevoAudio, { userProvidedTrack: false });
        viejoAudio.stop();
        conSonido = true;
      } catch {
        nuevoAudio.stop(); // el video ya cambio; el audio anterior se queda
      }
    } else {
      nuevoAudio.stop();
    }
  }
  return { estado: 'cambiada', conSonido };
}
