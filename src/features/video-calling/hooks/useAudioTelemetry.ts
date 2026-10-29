'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import {
  ParticipantEvent,
  RoomEvent,
  Track,
  type Participant,
  type TrackPublication,
  type RemoteTrackPublication,
  type LocalTrackPublication,
  type ConnectionQuality,
  type DisconnectReason,
} from 'livekit-client';
import { voiceCaptureEvidence } from '../services/voiceCapturePolicy';
import { connectionFailure } from '../services/connectionFailure';
import { motivoDeDesconexion, type MotivoSalida } from '../services/exitPolicy';

/**
 * INSTRUMENTACION DE LOS CORTES DE AUDIO.
 *
 * "A veces como que se pierde el audio y se deja de escuchar." Hipotesis con
 * motivo, NO confirmada: `stopMicTrackOnMute: true` suelta fisicamente el
 * track al mutear y al desmutear hay que republicar y que todos re-suscriban.
 * Cambiar a ciegas ya costo 6 dias de audio roto en febrero. Asi que primero
 * se MIDE: cada cliente registra los eventos que forman ese hueco y los manda
 * por lotes (ver `flush`).
 *
 * Eventos (nombres en español, sin siglas):
 *   micro_publicado / micro_despublicado      (local; el hueco de stopMicTrackOnMute)
 *   micro_silenciado / micro_activado         (local)
 *   audio_remoto_suscrito / audio_remoto_desuscrito / suscripcion_fallida
 *   audio_remoto_silenciado / audio_remoto_activado
 *   reconectando / senal_reconectando / reconectado / desconectado
 *   calidad_conexion (solo cambios a poor/lost y la recuperacion)
 *   error_dispositivo · reproduccion_audio (autoplay bloqueado/liberado)
 *   camara_publicada {width,height,aspect} — sensor para la camara "estirada"
 *   transporte {tipo_local,tipo_remoto,protocolo,rtt_ms,bitrate_disponible_kbps}
 *              — POR DONDE viaja la media: `relay` = salto extra por TURN.
 *              Al entrar y cada 2 min .
 *   ruido_detectado {identities,tipo}       — lo alimenta el detector
 *   turno_de_voz {inicio,fin}               — cuando hablo YO (local). Es la
 *              fuente de "quien dice que" en el transcript de la clase: el
 *              audio grabado es UNA pista mezclada y adivinar al hablante por
 *              el texto confunde a las personas.
 */
export type EventoAudio = {
  event: string;
  detail?: Record<string, unknown>;
  client_ts: string;
};

const LOTE_MS = 8000;
const LOTE_MAX = 25;
/** Un turno que no termina se corta aqui, para que un cierre brusco pierda poco. */
const TURNO_MAX_MS = 30000;

export function useAudioTelemetry({ sessionId, userId }: { sessionId: string | null; userId: string }) {
  const room = useRoomContext();
  const buffer = useRef<EventoAudio[]>([]);
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  // El cascaron no trae endpoint de ingesta: el lote se vacia localmente (y se
  // muestra en consola en desarrollo). Para persistirlo, conecta aqui tu propio
  // destino (p.ej. una ruta que inserte en `video_audio_events`).
  const flush = useCallback(async (_beacon = false) => {
    if (!sessionRef.current || buffer.current.length === 0) return;
    const lote = buffer.current.splice(0, buffer.current.length);
    if (process.env.NODE_ENV === 'development') {
      console.debug('[AudioTelemetry]', { session_id: sessionRef.current, events: lote });
    }
  }, []);

  const salida = useRef<MotivoSalida | null>(null);
  const registrar = useCallback((event: string, detail?: Record<string, unknown>) => {
    buffer.current.push({ event, detail, client_ts: new Date().toISOString() });
    // Lote lleno → vaciar ya. El resto lo barre el intervalo de abajo (a prueba
    // de balas: no depende de un timer.current que un flush directo podia dejar
    // colgado, bug del 2 sep que perdia todo menos el primer evento).
    if (buffer.current.length >= LOTE_MAX) flush();
  }, [flush]);

  /** One motive per departure; the first cause wins over the page/SDK events it triggers. */
  const registrarSalida = useCallback((motivo: MotivoSalida, detail?: Record<string, unknown>) => {
    if (salida.current) return;
    salida.current = motivo;
    registrar('salida', { motivo, ...detail });
    flush(true);
  }, [registrar, flush]);

  useEffect(() => {
    if (!room) return;
    const esAudio = (pub: TrackPublication) => pub.kind === Track.Kind.Audio;
    const esMicro = (pub: TrackPublication) => pub.source === Track.Source.Microphone;
    const quien = (p?: Participant) => (p ? { publisher: p.identity } : {});
    let previousMic: MediaStreamTrack | undefined;
    let previousEvidence = '';
    const inspectMicrophone = () => {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const mic = pub?.track?.mediaStreamTrack;
      if (!mic) { previousMic = undefined; previousEvidence = ''; return; }
      const evidence = {
        ...voiceCaptureEvidence(mic.getSettings(), navigator.mediaDevices.getSupportedConstraints()),
        sid: pub.trackSid, muted: pub.isMuted, readyState: mic.readyState,
      };
      const fingerprint = JSON.stringify(evidence);
      if (mic !== previousMic || fingerprint !== previousEvidence) {
        registrar('micro_configuracion', evidence);
        previousMic = mic; previousEvidence = fingerprint;
      }
    };

    // Turnos de voz del participante LOCAL. `isSpeaking` viene del SFU (no de un
    // analizador local), asi que es la misma señal que resalta el recuadro de
    // quien habla. Cada quien reporta solo su voz: el servidor la firma con su JWT.
    let hablandoDesde: number | null = null;
    const cerrarTurno = (fin: number) => {
      if (hablandoDesde === null) return;
      registrar('turno_de_voz', { inicio: new Date(hablandoDesde).toISOString(), fin: new Date(fin).toISOString() });
      hablandoDesde = null;
    };
    const onSpeaking = (speaking: boolean) => {
      const ahora = Date.now();
      if (speaking) { if (hablandoDesde === null) hablandoDesde = ahora; }
      else cerrarTurno(ahora);
    };
    const partirTurnoLargo = setInterval(() => {
      if (hablandoDesde !== null && Date.now() - hablandoDesde >= TURNO_MAX_MS) {
        const ahora = Date.now();
        cerrarTurno(ahora);
        hablandoDesde = ahora;
      }
    }, 5000);
    const local = room.localParticipant;
    local.on(ParticipantEvent.IsSpeakingChanged, onSpeaking);

    const onLocalPublished = (pub: LocalTrackPublication) => {
      if (esMicro(pub)) registrar('micro_publicado', { sid: pub.trackSid });
      if (esMicro(pub)) inspectMicrophone();
      if (pub.source === Track.Source.Camera) {
        const s = pub.track?.mediaStreamTrack?.getSettings?.();
        const dims = pub.dimensions;
        registrar('camara_publicada', {
          width: s?.width ?? dims?.width ?? null,
          height: s?.height ?? dims?.height ?? null,
          aspect: s?.aspectRatio ?? (s?.width && s?.height ? +(s.width / s.height).toFixed(3) : null),
          frameRate: s?.frameRate ?? null,
          processor: !!(pub.track as { getProcessor?: () => unknown } | undefined)?.getProcessor?.(),
        });
      }
    };
    const onLocalUnpublished = (pub: LocalTrackPublication) => {
      if (esMicro(pub)) registrar('micro_despublicado', { sid: pub.trackSid });
    };
    const onMuted = (pub: TrackPublication, p: Participant) => {
      if (!esAudio(pub)) return;
      registrar(p.identity === userId ? 'micro_silenciado' : 'audio_remoto_silenciado', quien(p));
    };
    const onUnmuted = (pub: TrackPublication, p: Participant) => {
      if (!esAudio(pub)) return;
      registrar(p.identity === userId ? 'micro_activado' : 'audio_remoto_activado', quien(p));
      if (p.identity === userId) inspectMicrophone();
    };
    const onSubscribed = (_t: unknown, pub: RemoteTrackPublication, p: Participant) => {
      if (esAudio(pub)) registrar('audio_remoto_suscrito', { ...quien(p), sid: pub.trackSid });
    };
    const onUnsubscribed = (_t: unknown, pub: RemoteTrackPublication, p: Participant) => {
      if (esAudio(pub)) registrar('audio_remoto_desuscrito', { ...quien(p), sid: pub.trackSid });
    };
    const onSubFailed = (sid: string, p: Participant, reason?: unknown) => {
      registrar('suscripcion_fallida', { ...quien(p), sid, reason: String(reason ?? '') });
    };
    const onReconnecting = () => registrar('reconectando');
    const onSignalReconnecting = () => registrar('senal_reconectando');
    const onReconnected = () => { registrar('reconectado'); inspectMicrophone(); };
    const onDisconnected = (reason?: DisconnectReason) => {
      cerrarTurno(Date.now());
      registrar('desconectado', { reason: reason ?? null });
      registrarSalida(motivoDeDesconexion(reason), { reason: reason ?? null });
      flush(true);
    };
    const onQuality = (q: ConnectionQuality, p: Participant) => {
      if (p.identity !== userId) return;
      registrar('calidad_conexion', { quality: q });
    };
    const onDevicesError = (e: Error) => registrar('error_dispositivo', connectionFailure(e));
    const onPlayback = () => registrar('reproduccion_audio', { canPlayback: room.canPlaybackAudio });

    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, onUnmuted);
    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);
    room.on(RoomEvent.TrackSubscriptionFailed, onSubFailed);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.SignalReconnecting, onSignalReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ConnectionQualityChanged, onQuality);
    room.on(RoomEvent.MediaDevicesError, onDevicesError);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onPlayback);

    const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
    // Capture phase: runs before livekit-client's own beforeunload/pagehide handler, whose
    // CLIENT_INITIATED disconnect would otherwise claim the motive as 'cliente'.
    const onPageHide = (e: Event) => { cerrarTurno(Date.now()); registrarSalida('pagina_cerrada', { evento: e.type, persisted: (e as PageTransitionEvent).persisted ?? null }); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onPageHide, { capture: true });
    window.addEventListener('pagehide', onPageHide, { capture: true });

    registrar('sesion_abierta', { ua: navigator.userAgent.slice(0, 120) });
    inspectMicrophone();
    // Device replacement may retain publication/SID. Observe the actual track,
    // without restarting capture or recording samples. Emit only on a change.
    const microphoneInspection = setInterval(inspectMicrophone, 3000);

    // EL SENSOR: POR DONDE VIAJA LA MEDIA.
    //
    // Una conexion poor/lost con el SFU ocioso no dice por donde viaja la media:
    // el log del SFU cuenta candidatos OFRECIDOS, no el par SELECCIONADO.
    //
    // Esto lo resuelve: `getStats()` dice el par de candidatos REAL y su RTT.
    // Si el tipo es `relay`, la media esta dando un salto extra por TURN y ahi
    // esta la latencia; si es `host`/`srflx`/`prflx`, el problema es otro.
    // Solo LEE estadisticas: no toca media, ni transporte, ni configuracion.
    const leerTransporte = async () => {
      try {
        // 5 sep 2026: el sensor nacio muerto por DOS motivos. (1) El servidor no
        // aceptaba el evento (lista de permitidos). (2) Aqui se leia SOLO el
        // transporte `subscriber`, y esta sala corre con UN solo peer connection
        // (`pcManager.subscriber` no existe; la media viaja por `publisher`).
        // Ahora se leen los dos y gana el que tenga un par nominado.
        type Transporte = { pc?: RTCPeerConnection };
        const pm = (room.engine as { pcManager?: { subscriber?: Transporte; publisher?: Transporte } } | undefined)?.pcManager;
        const pcs = [pm?.subscriber?.pc, pm?.publisher?.pc].filter((x): x is RTCPeerConnection => !!x?.getStats);
        if (pcs.length === 0) return;
        let par: RTCIceCandidatePairStats | undefined;
        const candidatos = new Map<string, { candidateType?: string; protocol?: string; address?: string }>();
        for (const pc of pcs) {
          const stats = await pc.getStats();
          stats.forEach((s) => {
            if (s.type === 'candidate-pair' && (s as RTCIceCandidatePairStats).nominated && (s as RTCIceCandidatePairStats).state === 'succeeded') par = s as RTCIceCandidatePairStats;
            if (s.type === 'local-candidate' || s.type === 'remote-candidate') candidatos.set(s.id, s as never);
          });
          if (par) break;
        }
        if (!par) return;
        const local = candidatos.get((par as { localCandidateId?: string }).localCandidateId ?? '');
        const remoto = candidatos.get((par as { remoteCandidateId?: string }).remoteCandidateId ?? '');
        registrar('transporte', {
          // `relay` = la media pasa por TURN (salto extra). Lo que queremos saber.
          tipo_local: local?.candidateType ?? null,
          tipo_remoto: remoto?.candidateType ?? null,
          protocolo: local?.protocol ?? null,
          rtt_ms: typeof par.currentRoundTripTime === 'number' ? Math.round(par.currentRoundTripTime * 1000) : null,
          bitrate_disponible_kbps: typeof (par as { availableOutgoingBitrate?: number }).availableOutgoingBitrate === 'number'
            ? Math.round((par as { availableOutgoingBitrate: number }).availableOutgoingBitrate / 1000)
            : null,
        });
      } catch {
        // Un sensor que no puede medir se calla; jamas inventa un valor.
      }
    };
    // Al entrar (tras el handshake) y luego cada 2 min: el transporte puede
    // cambiar a media llamada, y eso es justo lo que hay que ver.
    const primeraLectura = setTimeout(leerTransporte, 8000);
    const relojTransporte = setInterval(leerTransporte, 120000);

    // Barrido periódico: cada LOTE_MS manda lo que haya. Simple y confiable.
    const barrido = setInterval(() => { if (buffer.current.length > 0) flush(); }, LOTE_MS);

    return () => {
      local.off(ParticipantEvent.IsSpeakingChanged, onSpeaking);
      clearInterval(partirTurnoLargo);
      cerrarTurno(Date.now());
      clearTimeout(primeraLectura);
      clearInterval(relojTransporte);
      clearInterval(barrido);
      clearInterval(microphoneInspection);
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      room.off(RoomEvent.TrackMuted, onMuted);
      room.off(RoomEvent.TrackUnmuted, onUnmuted);
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      room.off(RoomEvent.TrackSubscriptionFailed, onSubFailed);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.SignalReconnecting, onSignalReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.ConnectionQualityChanged, onQuality);
      room.off(RoomEvent.MediaDevicesError, onDevicesError);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onPlayback);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onPageHide, { capture: true });
      window.removeEventListener('pagehide', onPageHide, { capture: true });
      flush(true);
    };
  }, [room, userId, registrar, registrarSalida, flush]);

  return { registrar, registrarSalida };
}
