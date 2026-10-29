'use client';

// ============================================
// VIDEO ROOM - la entrada a la sala (sala v2, 5 sep 2026)
// ============================================
// Lobby → LiveKitRoom → <Sala/>. Tres decisiones con historia:
//   · Los tracks que el lobby valido (guardia de formato) son LOS MISMOS que se
//     publican: LiveKitRoom entra con audio/video en false y los publicamos
//     nosotros al conectar. Asi no hay una segunda negociacion con la camara
//     que pueda devolver otro formato (el 4:3 del 5 sep).
//   · El gobierno (modo, turnos, cierre) vive en el servidor: <Sala/> pregunta.
//   · Cuando la clase termina (por reloj o por el anfitrion) el SFU tira la
//     sala; la desconexion NO regresa al lobby: pinta la pantalla de fin.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { ConnectionError, ConnectionErrorReason, DisconnectReason, Room, RoomEvent, Track, VideoPresets } from 'livekit-client';
import { reportEntryFailure, reportEntryStatus } from '../services/entryTelemetry';
import { RoomLobby } from './RoomLobby';
import { SafeAudioRenderer } from './SafeAudioRenderer';
import { Sala } from '../sala/Sala';
import { PantallaFin } from '../sala/Avisos';
import { useVideoRoom } from '../hooks/useVideoRoom';
import { VOICE_CAPTURE } from '../services/voiceCapturePolicy';
import { adoptLobbyMicrophone, VOICE_PUBLISH } from '../services/managedMicrophone';
import { connectionFailure } from '../services/connectionFailure';
import { debeReconectar, ESPERA_SIN_RED_MS, esperaReconexion, MAX_RECONEXIONES } from '../services/exitPolicy';

interface VideoRoomProps {
  roomId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  onExit?: () => void;
}

export function VideoRoom({ roomId, userId, userName, userAvatar, onExit }: VideoRoomProps) {
  const {
    room, permissions, token, sessionId, salaInicial, isLoading, error, joinError, isInLobby, isConnected, entrada, joinRoom, leaveRoom,
  } = useVideoRoom({ roomId, userId });

  const [fin, setFin] = useState<{ motivo: string | null } | null>(null);
  const [avisoConexion, setAvisoConexion] = useState<string | null>(null);

  // La Room la creamos nosotros para publicar los tracks del lobby al conectar.
  const lkRoom = useMemo(() => new Room({
    adaptiveStream: { pixelDensity: 1, pauseVideoInBackground: true },
    dynacast: true,
    videoCaptureDefaults: {
      resolution: entrada?.formato?.aceptado
        ? { width: entrada.formato.width, height: entrada.formato.height, frameRate: 30, aspectRatio: 16 / 9 }
        : VideoPresets.h720.resolution,
    },
    audioCaptureDefaults: { ...VOICE_CAPTURE },
    publishDefaults: {
      ...VOICE_PUBLISH,
      videoEncoding: { maxBitrate: 1_200_000, maxFramerate: 24 },
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    },
    disconnectOnPageLeave: true,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [token?.token]);

  // Callbacks and pending publications belong to one Room, never to the next
  // entry attempt. Shared refs reset on token change let late SDK events eject it.
  const lifecycle = useMemo(() => ({ connected: false, recovering: false, left: false, published: false, disposed: false }), [lkRoom]);
  useEffect(() => {
    lifecycle.disposed = false;
    return () => { lifecycle.disposed = true; };
  }, [lifecycle]);
  // Automatic rejoin (23 sep 2026): a network loss used to throw people back to the lobby
  // with camera and microphone off, and teachers moved the class to Meet. Remember what was
  // live while connected (publish/mute events only: the SDK unpublishes BEFORE it reports
  // the disconnect) and bring it back on a fresh entry, bounded by exitPolicy.
  const medios = useRef<{ audio: boolean; video: boolean; audioDeviceId?: string; videoDeviceId?: string }>({ audio: false, video: false });
  const reconexiones = useRef(0);
  const [reconexion, setReconexion] = useState<{ intento: number; reason: number | null; desde: number } | null>(null);
  useEffect(() => {
    const foto = () => {
      if (lkRoom.state !== 'connected') return;
      const lp = lkRoom.localParticipant;
      const mic = lp.getTrackPublication(Track.Source.Microphone);
      const cam = lp.getTrackPublication(Track.Source.Camera);
      medios.current = {
        audio: !!mic?.track && !mic.isMuted, video: !!cam?.track && !cam.isMuted,
        audioDeviceId: mic?.track?.mediaStreamTrack.getSettings().deviceId,
        videoDeviceId: cam?.track?.mediaStreamTrack.getSettings().deviceId,
      };
    };
    lkRoom.on(RoomEvent.LocalTrackPublished, foto).on(RoomEvent.TrackMuted, foto).on(RoomEvent.TrackUnmuted, foto);
    return () => { lkRoom.off(RoomEvent.LocalTrackPublished, foto).off(RoomEvent.TrackMuted, foto).off(RoomEvent.TrackUnmuted, foto); };
  }, [lkRoom]);

  // One rejoin routine for both ways a loss surfaces: the SDK reports onError (seen in the
  // 23 sep E2E: offline → onError, which used to send people to the lobby) or onDisconnected.
  const reconectar = useCallback((reason?: DisconnectReason) => {
    const antes = { ...medios.current };
    const desde = Date.now();
    const intentar = () => {
      // Offline (router restart, Wi-Fi hop): wait for the network without spending attempts.
      if (typeof navigator !== 'undefined' && navigator.onLine === false && Date.now() - desde < ESPERA_SIN_RED_MS) {
        setAvisoConexion('Sin conexión a internet. Te reconectamos en cuanto vuelva, con tu cámara y micrófono.');
        const volver = () => { window.removeEventListener('online', volver); clearTimeout(tope); intentar(); };
        const tope = setTimeout(volver, Math.max(0, ESPERA_SIN_RED_MS - (Date.now() - desde)));
        window.addEventListener('online', volver);
        return;
      }
      const intento = ++reconexiones.current;
      setReconexion({ intento, reason: reason ?? null, desde });
      setAvisoConexion(`Se cortó la conexión. Reconectando… (intento ${intento} de ${MAX_RECONEXIONES})`);
      setTimeout(() => {
        void joinRoom({ ...antes, audioTrack: null, videoTrack: null, formato: entrada?.formato ?? null }).then((ok) => {
          if (ok) return;
          if (reconexiones.current < MAX_RECONEXIONES) { intentar(); return; }
          setReconexion(null);
          setAvisoConexion('No pudimos reconectarte. Revisa tu conexión y vuelve a entrar; tu cámara y micrófono estarán apagados.');
          leaveRoom();
        });
      }, esperaReconexion(intento - 1));
    };
    intentar();
  }, [joinRoom, entrada?.formato, leaveRoom]);

  const recoverConnection = useCallback((error?: Error) => {
    if (lifecycle.disposed || lifecycle.recovering || lifecycle.left) return;
    // A superseded connect() is cancelled by the SDK when a newer one starts (23 sep E2E: the
    // rejoin's first attempt was aborted this way and the person landed in the lobby).
    if (error instanceof ConnectionError && error.reason === ConnectionErrorReason.Cancelled) return;
    const diagnostic = connectionFailure(error);
    void reportEntryFailure(sessionId, 'connection', diagnostic.name, { ...diagnostic, attempt_id: token?.entry_attempt_id });
    // A device error after connecting must not throw everyone back through entry.
    if (lifecycle.connected && lkRoom.state !== 'disconnected') {
      setAvisoConexion('No pudimos activar un dispositivo. Revisa sus permisos o elige otro en Configuración; sigues dentro de la sala.');
      return;
    }
    lifecycle.recovering = true;
    if (lifecycle.connected && debeReconectar(undefined, true, reconexiones.current)) {
      // Lost after being inside: same devices, fresh entry, no lobby.
      void reportEntryStatus(token?.entry_attempt_id, 'disconnected');
      reconectar();
      return;
    }
    void reportEntryStatus(token?.entry_attempt_id, 'failed');
    setAvisoConexion('No pudimos conectar con la sala. Vuelve a entrar sin cámara ni micrófono. Si persiste, prueba otra red o navegador.');
    entrada?.audioTrack?.stop(); entrada?.videoTrack?.stop();
    void lkRoom.disconnect(); leaveRoom();
  }, [entrada, lkRoom, lifecycle, leaveRoom, sessionId, token?.entry_attempt_id, reconectar]);
  useEffect(() => {
    if (isInLobby || !token) return;
    const timer = setTimeout(() => {
      if (!lifecycle.connected && lkRoom.state !== 'connected') {
        const timeout = new Error('Initial connection timed out'); timeout.name = 'ConnectionTimeout'; recoverConnection(timeout);
      }
    }, 45000);
    return () => clearTimeout(timer);
  }, [isInLobby, token, lkRoom, lifecycle, recoverConnection]);
  const publicarTracksDelLobby = useCallback(async () => {
    if (lifecycle.disposed || lifecycle.recovering || lifecycle.left) return;
    lifecycle.connected = true;
    setAvisoConexion(null);
    reconexiones.current = 0;
    void reportEntryStatus(token?.entry_attempt_id, 'connected');
    if (lifecycle.published || !entrada) return;
    lifecycle.published = true;
    const lp = lkRoom.localParticipant;
    if (!entrada.audioTrack && !entrada.videoTrack && (entrada.audio || entrada.video)) {
      // Rejoin after a loss: reopen the same devices. The server's permissions still
      // decide (Clase without the floor refuses the microphone, by design).
      if (entrada.video) await lp.setCameraEnabled(true, entrada.videoDeviceId ? { deviceId: entrada.videoDeviceId } : undefined).catch(() => {});
      if (entrada.audio && !lifecycle.disposed && !lifecycle.left) {
        await lp.setMicrophoneEnabled(true, entrada.audioDeviceId ? { deviceId: entrada.audioDeviceId } : undefined).catch(() => {});
      }
      return;
    }
    if (entrada.videoTrack && entrada.video) {
      try {
        await lp.publishTrack(entrada.videoTrack, { source: Track.Source.Camera, name: 'camera' });
      } catch (err) {
        entrada.videoTrack.stop();
        if (lifecycle.disposed || lifecycle.recovering || lifecycle.left) return;
        const diagnostic = connectionFailure(err);
        void reportEntryFailure(sessionId, 'camera', diagnostic.name, { ...diagnostic, attempt_id: token?.entry_attempt_id });
        setAvisoConexion('Entraste a la sala, pero no pudimos activar tu cámara. Puedes volver a encenderla desde los controles.');
      }
    }
    if (lifecycle.disposed || lifecycle.recovering || lifecycle.left || lkRoom.state !== 'connected') {
      entrada.audioTrack?.stop(); entrada.videoTrack?.stop(); return;
    }
    if (entrada.audioTrack && entrada.audio) {
      try {
        // Transfer ownership without opening a second microphone. SDK mute/unmute,
        // device changes and reconnect now reuse the SAME voice constraints.
        const mic = adoptLobbyMicrophone(entrada.audioTrack);
        await lp.publishTrack(mic, { source: Track.Source.Microphone, name: 'microphone' });
      } catch (err) {
        entrada.audioTrack.stop();
        if (lifecycle.disposed || lifecycle.recovering || lifecycle.left) return;
        // Modo Clase sin turno: el servidor no deja publicar el microfono. Es diseño, no error.
        const diagnostic = connectionFailure(err);
        void reportEntryFailure(sessionId, 'microphone', diagnostic.name, { ...diagnostic, attempt_id: token?.entry_attempt_id });
        if (lp.permissions?.canPublish && lp.permissions.canPublishSources?.includes(2)) {
          setAvisoConexion('Entraste a la sala, pero no pudimos activar tu micrófono. Revisa sus permisos o elige otro en Configuración.');
        }
      }
    }
  }, [entrada, lkRoom, lifecycle, sessionId, token?.entry_attempt_id]);

  // LiveKitRoom re-runs its connect effect whenever onError changes identity; a new identity
  // mid-connect re-calls connect() and cancels the attempt in flight. Keep it stable.
  const recoverRef = useRef(recoverConnection);
  recoverRef.current = recoverConnection;
  // Bound to THIS room's lifecycle: a late error from a departed room stays inert.
  const onErrorEstable = useCallback((error: Error) => { if (!lifecycle.disposed) recoverRef.current(error); }, [lifecycle]);

  const handleExit = useCallback(() => {
    if (lifecycle.disposed || lifecycle.left) return;
    lifecycle.left = true;
    entrada?.audioTrack?.stop(); entrada?.videoTrack?.stop();
    void lkRoom.disconnect();
    leaveRoom();
    if (onExit) onExit(); else window.history.back();
  }, [entrada, lkRoom, lifecycle, leaveRoom, onExit]);

  const handleTerminada = useCallback((motivo: string | null) => {
    if (lifecycle.disposed || lifecycle.left || lifecycle.recovering) return;
    setFin({ motivo });
  }, [lifecycle]);

  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    if (lifecycle.disposed || lifecycle.left || lifecycle.recovering) return;
    console.log('[VideoRoom] Disconnected, reason:', reason);
    if (lifecycle.connected) void reportEntryStatus(token?.entry_attempt_id, 'disconnected');
    lifecycle.recovering = true;
    if (debeReconectar(reason, lifecycle.connected, reconexiones.current)) { reconectar(reason); return; }
    // ROOM_DELETED (4) = la clase termino (reloj o anfitrion). PARTICIPANT_REMOVED (3) = expulsado.
    if (reason === DisconnectReason.ROOM_DELETED) { setFin((f) => f ?? { motivo: null }); return; }
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) { setFin({ motivo: 'expulsado' }); return; }
    setAvisoConexion(reason === DisconnectReason.DUPLICATE_IDENTITY
      ? 'Tu cuenta entró desde otra ventana o dispositivo. Cierra la otra llamada antes de volver a entrar aquí con cámara y micrófono apagados.'
      : 'Se cortó la conexión con la sala. Revisa tu conexión y vuelve a entrar; tu cámara y micrófono estarán apagados.');
    leaveRoom();
  }, [leaveRoom, lifecycle, token?.entry_attempt_id, reconectar]);

  if (fin) {
    return <PantallaFin motivo={fin.motivo} onSalir={() => (onExit ? onExit() : window.history.back())} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#161618] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Cargando sala…</p>
        </div>
      </div>
    );
  }

  if (error || !room || !permissions) {
    return (
      <div className="min-h-dvh bg-[#161618] flex items-center justify-center p-4">
        <div className="card-spotlight p-6 max-w-md text-center">
          <h2 className="text-lg font-bold text-white mb-2">No se pudo abrir la sala</h2>
          <p className="text-white/60 text-sm">{error || 'No se pudo cargar la sala'}</p>
          <button onClick={() => (onExit ? onExit() : window.history.back())} className="btn-secondary mt-4">Volver</button>
        </div>
      </div>
    );
  }

  if (isInLobby) {
    return (
      <RoomLobby
        room={room}
        permissions={permissions}
        onJoin={joinRoom}
        onCancel={() => (onExit ? onExit() : window.history.back())}
        joinError={joinError || avisoConexion}
        initialMedia={avisoConexion ? { audio: false, video: false } : undefined}
      />
    );
  }

  return (
    <div className="h-dvh bg-[#0b0b0d] flex flex-col overflow-hidden">
      {token ? (
        <LiveKitRoom
          room={lkRoom}
          token={token.token}
          serverUrl={token.ws_url}
          connect={isConnected}
          audio={false}
          video={false}
          onConnected={publicarTracksDelLobby}
          onDisconnected={handleDisconnected}
          onError={onErrorEstable}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <SafeAudioRenderer />
          {avisoConexion && <p role="status" className="bg-amber-950 text-amber-100 px-4 py-2 text-sm">{avisoConexion}</p>}
          <Sala
            room={room}
            roomId={roomId}
            sessionId={sessionId}
            permissions={permissions}
            userId={userId}
            userName={userName}
            userAvatar={userAvatar}
            salaInicial={salaInicial}
            formatoCamara={entrada?.formato ?? null}
            onLeave={handleExit}
            onTerminada={handleTerminada}
            reconexion={reconexion}
          />
        </LiveKitRoom>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
