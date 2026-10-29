'use client';

// ============================================
// SALA v2 - la composicion (vive DENTRO de <LiveKitRoom>)
// ============================================
// Aqui se cablea todo: el estado que dicta el servidor (useSala), lo que el
// servidor me deja publicar (usePermisosLocales), la telemetria, la rejilla,
// la barra, el panel de gente, el chat y las reacciones. Este archivo no
// decide nada de gobierno: pregunta y obedece.

import './sala.css';
import { usuarioDeIdentity } from '@/features/video-calling/lib/identidad';
import { screenShareError } from './screenShareError';
import { cambiarVentanaCompartida } from './cambiarVentana';
import { SCREEN_SHARE_CAPTURE, SCREEN_SHARE_PUBLISH, presentationAudioNotice, presentationPlatform } from './screenShareCapture';
import { mediaDeviceError, type MediaDevice } from './mediaDeviceError';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useParticipants,
  useTrackToggle,
  useTracks,
  useConnectionState,
  useRoomContext,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { ConnectionState, LocalVideoTrack, Track, VideoQuality, type Participant } from 'livekit-client';
import { supabase } from '@/shared/lib/supabase';
import { getRoomChannel } from '../config/livekit';
import type { VideoLayoutMode, VideoPermissions, VideoRoomWithDetails } from '../types';
import type { EstadoSala } from '../services/salaService';
import { useAudioTelemetry } from '../hooks/useAudioTelemetry';
import { useMediaReceptionTelemetry } from '../hooks/useMediaReceptionTelemetry';
import { useActiveSpeaker } from '../hooks/useActiveSpeaker';
import { choosePresentation, orderParticipants, speakerController } from './sharedComposition';
import { useSharedSpeaker } from './useSharedSpeaker';
import { useParticipantVolume } from '../hooks/useParticipantVolume';
import { useHandRaise } from '../hooks/useHandRaise';
import { useCallChat } from '../hooks/useCallChat';
import { useReactions } from '../hooks/useReactions';
import { useBackgroundEffect } from '../hooks/useBackgroundEffect';
import { InCallChat } from '../components/InCallChat';
import { FloatingReactions } from '../components/FloatingReactions';
import { CallToast, type ToastMessage } from '../components/CallToast';
import { useSala } from './useSala';
import { usePermisosLocales } from './usePermisosLocales';
import { Rejilla, type Vista } from './Rejilla';
import { useVisibleCameras } from './useVisibleCameras';
import type { CeldaDatos } from './Celda';
import { BarraControles } from './BarraControles';
import { PanelGente } from './PanelGente';
import { BarraSuperior, BannerEstado, ConfirmarSalida, OverlayTurno, TarjetaAnfitrion } from './Avisos';
import { salidaRequiereConfirmacion } from '../services/exitPolicy';
import { AvisoMudanza, MoverClase } from './Mudanza';
import type { FormatoCamara } from './useFormatoCamara';

const ROLES_STAFF = new Set(['admin', 'owner', 'moderator']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** ⚑ F del spec: por encima de esto no hay toasts de entrada/salida. */
const TOASTS_HASTA = 8;

interface Perfil { id: string; full_name: string; avatar_url: string | null }

interface Props {
  room: VideoRoomWithDetails;
  roomId: string;
  sessionId: string | null;
  permissions: VideoPermissions;
  userId: string;
  userName: string;
  userAvatar: string | null;
  salaInicial: EstadoSala | null;
  formatoCamara: FormatoCamara | null;
  onLeave: () => void;
  onTerminada: (motivo: string | null) => void;
  /** Set by VideoRoom when this entry is an automatic rejoin after a loss. */
  reconexion?: { intento: number; reason: number | null; desde: number } | null;
}

function metadataDe(p: Participant): { role?: string; rol_sala?: string; avatar_url?: string | null } {
  try { return p.metadata ? JSON.parse(p.metadata) : {}; } catch { return {}; }
}

export function Sala({ room, roomId, sessionId, permissions, userId, userName, userAvatar, salaInicial, formatoCamara, onLeave, onTerminada, reconexion = null }: Props) {
  const lkRoom = useRoomContext();
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const conectado = connectionState === ConnectionState.Connected;

  // --- Sensores ---
  // Una persona puede estar en varios dispositivos: "soy yo" se mide por la
  // identity de ESTA conexión, no por el user.id (ver lib/identidad).
  const miIdentity = lkRoom.localParticipant?.identity || userId;
  const telemetria = useAudioTelemetry({ sessionId, userId: miIdentity });
  const registrar = telemetria.registrar;
  const registrarSalida = telemetria.registrarSalida;
  const reconexionVista = useRef<number | null>(null);
  useEffect(() => {
    if (!conectado || !reconexion || reconexionVista.current === reconexion.desde) return;
    reconexionVista.current = reconexion.desde;
    registrar('reconexion_automatica', { intento: reconexion.intento, reason: reconexion.reason, ms: Date.now() - reconexion.desde });
  }, [conectado, reconexion, registrar]);
  useMediaReceptionTelemetry(registrar);

  // --- El estado que dicta el servidor ---
  const identidades = useMemo(() => participants.map((p) => p.identity), [participants]);
  const sala = useSala({ sessionId, identidades, inicial: salaInicial, yo: miIdentity });
  const { estado, accion, ahora, gobierna, soyAnfitrion, modo, modoEvento, terminada, grabando, anfitrionPresente, turnosActivos } = sala;
  const miTurno = estado?.mi_turno ?? null;
  const focoComun = estado?.foco_identity ?? null;

  const [errorMedio, setErrorMedio] = useState<string | null>(null);
  const falloMedio = useCallback((err: unknown, device: MediaDevice) => {
    setErrorMedio(mediaDeviceError(err, device).message);
  }, []);

  // --- Lo que puedo publicar (segun el servidor) ---
  const { puedoMicrofono, puedoCamara, puedoPantalla } = usePermisosLocales({ conTurno: !!miTurno, registrar, onMediaError: falloMedio });

  // --- Tracks de video ---
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });
  const [camarasVisibles, setCamarasVisibles] = useState<string[]>([]);
  useVisibleCameras(camarasVisibles);
  const { camaras, pantalla } = useMemo(() => {
    const camaras = new Map<string, TrackReferenceOrPlaceholder>();
    for (const t of tracks) {
      if (t.source === Track.Source.Camera) camaras.set(t.participant.identity, t);
    }
    const screen = choosePresentation(tracks.filter(t => t.source === Track.Source.ScreenShare && t.publication)
      .map(t => ({ identity: t.participant.identity, sid: t.publication!.trackSid, muted: t.publication!.isMuted, trackRef: t })), focoComun);
    const pantalla = screen ? { trackRef: screen.trackRef, identity: screen.identity } : null;
    return { camaras, pantalla };
  }, [tracks, focoComun]);

  // --- Mis medios ---
  const { toggle: rawMic, enabled: micAbierto } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: rawCam, enabled: camaraAbierta } = useTrackToggle({ source: Track.Source.Camera });
  const { toggle: rawPantalla, enabled: compartiendo } = useTrackToggle({ source: Track.Source.ScreenShare, captureOptions: SCREEN_SHARE_CAPTURE, publishOptions: SCREEN_SHARE_PUBLISH });
  const backgroundEffect = useBackgroundEffect();

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const avisar = useCallback((text: string, type: ToastMessage['type'] = 'info', ms = 3500) => {
    const t: ToastMessage = { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, type };
    setToasts((prev) => [...prev.slice(-3), t]);
    const timer = setTimeout(() => { setToasts((prev) => prev.filter((x) => x.id !== t.id)); timersRef.current.delete(timer); }, ms);
    timersRef.current.add(timer);
  }, []);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); timersRef.current.clear(); }, []);

  const microPendiente = useRef(false);
  const camaraPendiente = useRef(false);
  const onMic = useCallback(async () => {
    if (!conectado || microPendiente.current) return;
    if (!puedoMicrofono) { avisar(modo === 'clase' ? 'Levanta la mano para pedir la palabra.' : 'Tu micrófono no está permitido ahora.'); return; }
    lkRoom.startAudio().catch(() => {});
    microPendiente.current = true;
    try { await rawMic(); setErrorMedio(null); }
    catch (error) { falloMedio(error, 'microphone'); }
    finally { microPendiente.current = false; }
  }, [conectado, puedoMicrofono, modo, avisar, lkRoom, rawMic, falloMedio]);

  const onCamara = useCallback(async () => {
    if (!conectado || camaraPendiente.current) return;
    camaraPendiente.current = true;
    try { if (camaraAbierta) await backgroundEffect.cleanup(); await rawCam(); setErrorMedio(null); }
    catch (error) { falloMedio(error, 'camera'); }
    finally { camaraPendiente.current = false; }
  }, [conectado, camaraAbierta, backgroundEffect, rawCam, falloMedio]);

  // Mientras se comparte pantalla, la camara cede su capa alta (como Zoom): con
  // subida apretada, los 1.2 Mbps de la camara 720p eran justo lo que le faltaba
  // a la pantalla 1080p (27 sep 2026, clase sintetica con subida de 3 Mbps).
  useEffect(() => {
    const cam = lkRoom.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (cam instanceof LocalVideoTrack) cam.setPublishingQuality(compartiendo ? VideoQuality.MEDIUM : VideoQuality.HIGH);
  }, [compartiendo, camaraAbierta, lkRoom]);

  const [avisoSinSonido, setAvisoSinSonido] = useState<string | null>(null);
  useEffect(() => { if (!compartiendo) setAvisoSinSonido(null); }, [compartiendo]);
  const pantallaPendiente = useRef(false);
  const onPantalla = useCallback(async () => {
    if (!conectado || pantallaPendiente.current) return;
    if (!compartiendo && (!puedoPantalla || !permissions.can_screen_share)) {
      avisar(modo === 'clase' ? 'Pide la palabra al anfitrión para compartir tu pantalla.' : 'Compartir pantalla está desactivado en esta sala.', 'info', 6000);
      return;
    }
    if (!compartiendo && !navigator.mediaDevices?.getDisplayMedia) { avisar('Este navegador no permite compartir pantalla. Abre la llamada en un navegador de computadora.', 'leave', 8000); return; }
    pantallaPendiente.current = true;
    registrar('pantalla_intento', { activar: !compartiendo });
    const activar = !compartiendo;
    try {
      await rawPantalla();
      if (activar && lkRoom.localParticipant.isScreenShareEnabled) {
        // The browser picker decides; only the published track tells whether sound is shared.
        const conSonido = !!lkRoom.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
        registrar('pantalla_audio', { con_sonido: conSonido });
        setAvisoSinSonido(presentationAudioNotice(conSonido, presentationPlatform(navigator.userAgent)));
      }
    } catch (err) {
      const detalle = screenShareError(err);
      registrar('pantalla_error', { name: detalle.name });
      avisar(detalle.message, 'leave', 12000);
    } finally { pantallaPendiente.current = false; }
  }, [conectado, compartiendo, puedoPantalla, permissions.can_screen_share, modo, rawPantalla, avisar, registrar, lkRoom]);

  // Cambiar de ventana sin dejar de compartir: replaceTrack sobre el track publicado (mismo SID).
  const onCambiarVentana = useCallback(async () => {
    if (!conectado || !compartiendo || pantallaPendiente.current) return;
    pantallaPendiente.current = true;
    registrar('pantalla_intento', { activar: true, cambiar: true });
    try {
      const r = await cambiarVentanaCompartida(lkRoom.localParticipant);
      if (r.estado === 'cambiada') {
        registrar('pantalla_cambiada', { con_sonido: r.conSonido });
        // El aviso de «sin sonido» describe la captura anterior: se recalcula con la nueva.
        setAvisoSinSonido(presentationAudioNotice(r.conSonido, presentationPlatform(navigator.userAgent)));
      }
    } catch (err) {
      const detalle = screenShareError(err);
      registrar('pantalla_error', { name: detalle.name, cambiar: true });
      avisar('No se pudo cambiar la ventana. Sigues compartiendo la anterior.', 'leave', 8000);
    } finally { pantallaPendiente.current = false; }
  }, [conectado, compartiendo, registrar, lkRoom, avisar]);

  // --- Salir: un paso deliberado cuando cuesta (23 sep 2026) ---
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const salirYa = useCallback(() => { registrarSalida('boton', { confirmada: confirmandoSalida }); onLeave(); }, [registrarSalida, confirmandoSalida, onLeave]);
  const solicitarSalida = useCallback(() => {
    if (salidaRequiereConfirmacion({ compartiendoPantalla: compartiendo, soyAnfitrion, conTurno: !!miTurno })) {
      registrar('salida_confirmacion', { accion: 'mostrada', compartiendo, anfitrion: soyAnfitrion, turno: !!miTurno });
      setConfirmandoSalida(true);
      return;
    }
    salirYa();
  }, [compartiendo, soyAnfitrion, miTurno, registrar, salirYa]);
  const quedarme = useCallback(() => { registrar('salida_confirmacion', { accion: 'quedarse' }); setConfirmandoSalida(false); }, [registrar]);

  // --- Mover la clase ---
  const mudanza = estado?.mudanza ?? null;
  const [moviendo, setMoviendo] = useState(false);
  const moverClase = useCallback(async (url: string) => {
    const r = await accion({ accion: 'mudanza', url });
    if (!r.ok) return r.error || 'No pudimos avisar a todos. Inténtalo de nuevo.';
    avisar('Listo: todos ven el aviso con el link nuevo.', 'info', 5000);
    return null;
  }, [accion, avisar]);
  const quitarMudanza = useCallback(async () => {
    const r = await accion({ accion: 'mudanza', url: null });
    if (!r.ok) avisar(r.error || 'No pudimos quitar el aviso.', 'info');
  }, [accion, avisar]);
  const mudanzaVista = useCallback(() => registrar('mudanza_vista', { donde: 'sala' }), [registrar]);

  // --- Perfiles (nombres y avatares) ---
  const [perfiles, setPerfiles] = useState<Map<string, Perfil>>(new Map());
  useEffect(() => {
    const faltan = Array.from(new Set(identidades.map(usuarioDeIdentity))).filter((id) => UUID_RE.test(id) && !perfiles.has(id));
    if (faltan.length === 0) return;
    let vivo = true;
    supabase.from('profiles').select('id, full_name, avatar_url').in('id', faltan).then(({ data }) => {
      if (!vivo || !data) return;
      setPerfiles((prev) => { const m = new Map(prev); for (const p of data as Perfil[]) m.set(p.id, p); return m; });
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidades.join(',')]);

  // --- Chat + reacciones (canal compartido, como antes) ---
  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chat = useCallChat({ sessionId, userId, userName, userAvatar, sharedChannelRef: roomChannelRef });
  const reacciones = useReactions({ roomId, userId, userName, sharedChannelRef: roomChannelRef });
  const chatRef = useRef(chat.handleIncomingMessage); chatRef.current = chat.handleIncomingMessage;
  const reacRef = useRef(reacciones.handleIncomingReaction); reacRef.current = reacciones.handleIncomingReaction;
  useEffect(() => {
    const canal = supabase.channel(getRoomChannel(roomId));
    canal.on('broadcast', { event: 'chat_message' }, (payload) => chatRef.current(payload as unknown as Parameters<typeof chat.handleIncomingMessage>[0]));
    canal.on('broadcast', { event: 'reaction' }, (payload) => reacRef.current(payload as unknown as Parameters<typeof reacciones.handleIncomingReaction>[0]));
    canal.subscribe();
    roomChannelRef.current = canal;
    return () => { supabase.removeChannel(canal); roomChannelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // --- Manos ---
  const manos = useHandRaise({ sessionId, userId, priority: permissions.hand_raise_priority });
  const posiciones = useMemo(() => { const m = new Map<string, number>(); manos.queue.forEach((h, i) => { if (h.user_id) m.set(h.user_id, i + 1); }); return m; }, [manos.queue]);
  const onMano = useCallback(async () => {
    if (manos.isHandRaised) { await manos.lowerHand(); registrar('mano_bajada'); }
    else { await manos.raiseHand(); registrar('mano_levantada', { modo }); avisar(modo === 'clase' ? 'Pediste la palabra. El anfitrión te la dará.' : 'Mano levantada'); }
  }, [manos, registrar, modo, avisar]);

  // --- Hablante y volumen local ---
  const hablante = useActiveSpeaker();
  const hablandoId = participants.some(p => p.identity === estado?.orador_identity) ? estado?.orador_identity ?? null : null;
  const candidatoOrador = participants.some(p => p.identity === hablante?.identity && p.isMicrophoneEnabled) ? hablante?.identity ?? null : null;
  useSharedSpeaker(conectado && !!estado && speakerController(participants.filter(p => Number(p.kind) === 0).map(p => p.identity), estado?.anfitrion_id ?? null) === miIdentity,
    candidatoOrador, estado?.orador_identity ?? null, accion);
  const volumen = useParticipantVolume();

  // --- Las celdas ---
  const anfitrionId = estado?.anfitrion_id ?? room.created_by ?? null;
  const celdas = useMemo<CeldaDatos[]>(() => {
    const rolDe = (p: Participant): CeldaDatos['rol'] => {
      if (anfitrionId && usuarioDeIdentity(p.identity) === anfitrionId) return 'anfitrion';
      const m = metadataDe(p);
      return m.role && ROLES_STAFF.has(m.role) ? 'moderador' : 'miembro';
    };
    const datos: CeldaDatos[] = participants.map((p) => {
      const perfil = perfiles.get(usuarioDeIdentity(p.identity));
      const meta = metadataDe(p);
      const mic = p.getTrackPublication(Track.Source.Microphone);
      const cam = p.getTrackPublication(Track.Source.Camera);
      const turno = turnosActivos.get(p.identity);
      return {
        identity: p.identity,
        nombre: perfil?.full_name || p.name || 'Alguien',
        avatarUrl: perfil?.avatar_url ?? meta.avatar_url ?? null,
        esLocal: p.identity === miIdentity,
        rol: rolDe(p),
        micAbierto: !!mic && !mic.isMuted,
        camaraAbierta: !!cam && !cam.isMuted,
        hablando: p.identity === hablandoId && p.isSpeaking,
        manoPosicion: posiciones.get(p.identity) ?? null,
        turnoVence: turno?.vence_at ?? null,
        presupuestoRestante: modo === 'clase' ? estado?.presupuestos[p.identity] ?? null : null,
        trackRef: camaras.get(p.identity),
        dimensiones: cam?.dimensions ?? null,
      };
    });
    return orderParticipants(datos, focoComun);
  }, [participants, perfiles, anfitrionId, miIdentity, hablandoId, posiciones, turnosActivos, estado?.presupuestos, camaras, modo, focoComun]);

  // --- Vista ---
  const [vista, setVista] = useState<VideoLayoutMode>('gallery');
  const [fijadoId, setFijadoId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'chat' | 'gente' | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const pantallaInfo = pantalla ? { ...pantalla, nombre: celdas.find((c) => c.identity === pantalla.identity)?.nombre ?? 'alguien' } : null;
  const focoPresente = celdas.some(c => c.identity === focoComun) ? focoComun : null;
  const vistaEfectiva: Vista = pantallaInfo ? 'presentacion' : focoPresente || vista === 'speaker' ? 'orador' : 'rejilla';
  const onFocoComun = useCallback(async (id: string | null) => {
    const result = await accion({ accion: 'foco', identity: id === focoComun ? null : id });
    if (!result.ok) avisar(result.error || 'No pudimos fijar el foco para todos.', 'info');
  }, [accion, focoComun, avisar]);
  const onPantallaCompleta = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const h = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // --- El anfitrion entro: la sala toma el modo del evento (o Clase) y el anfitrion elige en la tarjeta ---
  const aviseEntrada = useRef(false);
  const silencioModoHasta = useRef(0);
  useEffect(() => {
    if (!conectado || !soyAnfitrion || anfitrionPresente || aviseEntrada.current) return;
    aviseEntrada.current = true;
    silencioModoHasta.current = Date.now() + 4000;
    accion({ accion: 'anfitrion_entro' });
  }, [conectado, soyAnfitrion, anfitrionPresente, accion]);

  // La tarjeta de eleccion: una vez por sesion y por navegador (8 sep 2026). Se abre en
  // cuanto el servidor confirma que el anfitrion esta dentro, lo haya avisado este
  // cliente o lo haya detectado el arbitro.
  const claveTarjeta = sessionId ? `sala:tarjeta-anfitrion:${sessionId}` : null;
  const [tarjeta, setTarjeta] = useState(false);
  const [tarjetaOcupada, setTarjetaOcupada] = useState(false);
  useEffect(() => {
    if (!conectado || !soyAnfitrion || !anfitrionPresente || !claveTarjeta) return;
    let vista = false;
    try { vista = window.sessionStorage.getItem(claveTarjeta) === '1'; } catch { vista = false; }
    if (!vista) setTarjeta(true);
  }, [conectado, soyAnfitrion, anfitrionPresente, claveTarjeta]);
  const cerrarTarjeta = useCallback(() => {
    setTarjeta(false);
    try { if (claveTarjeta) window.sessionStorage.setItem(claveTarjeta, '1'); } catch { /* sin storage */ }
  }, [claveTarjeta]);
  const elegirModo = useCallback(async (m: 'abierta' | 'clase') => {
    if (m === modo) { cerrarTarjeta(); return; }
    setTarjetaOcupada(true);
    try {
      const r = await accion({ accion: 'modo', modo: m });
      if (!r.ok) { avisar(r.error || 'No se pudo cambiar el modo', 'leave', 4000); return; }
      registrar('modo_elegido_en_tarjeta', { modo: m });
      cerrarTarjeta();
    } finally { setTarjetaOcupada(false); }
  }, [modo, accion, avisar, registrar, cerrarTarjeta]);

  // --- Cambios que merecen aviso ---
  const modoPrev = useRef(modo);
  useEffect(() => {
    if (modoPrev.current !== modo) {
      modoPrev.current = modo;
      if (Date.now() < silencioModoHasta.current) return;
      avisar(modo === 'clase' ? 'Modo Clase: los micrófonos se abren con turno.' : 'Modo Libre: todos pueden hablar.');
    }
  }, [modo, avisar]);
  const turnoPrev = useRef<string | null>(null);
  useEffect(() => {
    const clave = miTurno?.vence_at ?? null;
    if (clave && clave !== turnoPrev.current) avisar('Tienes la palabra.', 'info');
    if (!clave && turnoPrev.current) avisar('Se terminó tu turno.', 'info');
    turnoPrev.current = clave;
  }, [miTurno?.vence_at, avisar]);

  // Avisos de cierre: a 10 y a 2 minutos, una sola vez cada uno
  const avisados = useRef<Set<number>>(new Set());
  useEffect(() => {
    const cierre = estado?.sesion.cierre_at;
    if (!cierre) return;
    const id = setInterval(() => {
      const restante = (Date.parse(cierre) - ahora()) / 1000;
      for (const umbral of [600, 120]) {
        if (restante <= umbral && restante > umbral - 60 && !avisados.current.has(umbral)) {
          avisados.current.add(umbral);
          avisar(umbral === 600 ? 'La clase se apaga en 10 minutos.' : 'La clase se apaga en 2 minutos.', 'info', 6000);
          registrar('aviso_cierre', { minutos: umbral / 60 });
        }
      }
    }, 5000);
    return () => clearInterval(id);
  }, [estado?.sesion.cierre_at, ahora, avisar, registrar]);

  // Termino: la pantalla de fin la pinta el padre
  useEffect(() => {
    if (terminada) { registrar('sala_terminada_vista', { motivo: estado?.sesion.cerrada_por ?? null }); telemetriaFlush(); onTerminada(estado?.sesion.cerrada_por ?? null); }
    function telemetriaFlush() { /* el hook vacia solo al desmontar */ }
  }, [terminada, estado?.sesion.cerrada_por, onTerminada, registrar]);

  // Formato de camara: el veredicto de la guardia, en la base
  const formatoRegistrado = useRef(false);
  useEffect(() => {
    if (!formatoCamara || formatoRegistrado.current || !sessionId) return;
    formatoRegistrado.current = true;
    registrar(formatoCamara.aceptado && !formatoCamara.corregido ? 'formato_camara' : 'formato_camara_rechazado', { ...formatoCamara });
  }, [formatoCamara, sessionId, registrar]);

  // Entradas y salidas: solo con poca gente (⚑ F)
  const prevIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const actual = new Set(identidades);
    if (prevIds.current.size > 0 && participants.length <= TOASTS_HASTA) {
      for (const id of actual) if (!prevIds.current.has(id) && id !== miIdentity) avisar(`${celdas.find((c) => c.identity === id)?.nombre ?? 'Alguien'} entró`, 'join', 2500);
      for (const id of prevIds.current) if (!actual.has(id) && id !== miIdentity) avisar('Alguien salió', 'leave', 2500);
    }
    prevIds.current = actual;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidades.join(',')]);

  // --- Acciones del anfitrion ---
  const hacer = useCallback(async (a: Parameters<typeof accion>[0], exito?: string) => {
    const r = await accion(a);
    if (!r.ok) avisar(r.error || 'No se pudo', 'leave', 4000);
    else if (exito) avisar(exito);
    return r;
  }, [accion, avisar]);
  const nombreDe = useCallback((id: string) => celdas.find((c) => c.identity === id)?.nombre ?? 'esa persona', [celdas]);
  const onSilenciarTodos = useCallback(async () => {
    const r = await accion({ accion: 'silenciar_todos' });
    if (!r.ok) { avisar(r.error || 'No se pudo silenciar', 'leave', 4000); return; }
    const n = (r.data as { silenciados?: string[] } | undefined)?.silenciados?.length ?? 0;
    const cola = modo === 'abierta' ? ' Pueden volver a abrirlo; para que no puedan, pon Clase.' : '';
    avisar(n === 0 ? `Nadie tenía el micrófono abierto.${cola}` : `${n} ${n === 1 ? 'micrófono cerrado' : 'micrófonos cerrados'}.${cola}`, 'info', 5000);
  }, [accion, avisar, modo]);
  const onModo = useCallback(async (m: 'abierta' | 'clase') => { await hacer({ accion: 'modo', modo: m }); }, [hacer]);
  const onDarPalabra = useCallback((id: string) => { hacer({ accion: 'dar_palabra', identity: id }, `${nombreDe(id)} tiene la palabra.`); }, [hacer, nombreDe]);
  const onQuitarPalabra = useCallback((id: string) => { hacer({ accion: 'quitar_palabra', identity: id }, `Le quitaste la palabra a ${nombreDe(id)}.`); }, [hacer, nombreDe]);
  const onRegalarTiempo = useCallback((id: string) => { hacer({ accion: 'regalar_tiempo', identity: id, segundos: 180 }, `+3 minutos para ${nombreDe(id)}.`); }, [hacer, nombreDe]);
  const onSilenciar = useCallback((id: string) => { hacer({ accion: 'silenciar', identity: id }, `Micrófono de ${nombreDe(id)} cerrado.`); }, [hacer, nombreDe]);
  const onExpulsar = useCallback((id: string) => { if (window.confirm(`¿Expulsar a ${nombreDe(id)} de la clase?`)) hacer({ accion: 'expulsar', identity: id }, `${nombreDe(id)} fue expulsado.`); }, [hacer, nombreDe]);
  const onTerminar = useCallback(() => { hacer({ accion: 'terminar' }); }, [hacer]);
  const onCederPalabra = useCallback(() => { hacer({ accion: 'ceder_palabra' }, 'Cediste la palabra.'); }, [hacer]);

  const onChat = useCallback(() => { setPanel((p) => (p === 'chat' ? null : 'chat')); chat.clearUnread(); }, [chat]);
  const onGente = useCallback(() => setPanel((p) => (p === 'gente' ? null : 'gente')), []);

  const manosLista = useMemo(() => manos.queue.map((h, i) => ({ user_id: h.user_id, nombre: h.profile?.full_name ?? nombreDe(h.user_id), posicion: i + 1 })), [manos.queue, nombreDe]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <BarraSuperior
        personas={participants.length}
        modo={modo}
        grabando={grabando}
        cierreAt={estado?.sesion.cierre_at ?? null}
        ahora={ahora}
        // La grabacion necesita LiveKit Egress: no viene en el cascaron.
        puedeGrabar={false}
        grabacionOcupada={false}
        onGrabar={() => {}}
        onDetenerGrabacion={() => {}}
        compartiendo={pantallaInfo ? (pantallaInfo.identity === miIdentity ? 'Compartiendo tu pantalla' : `Pantalla de ${pantallaInfo.nombre}`) : null}
        gobierna={gobierna}
        onTerminar={onTerminar}
        sinConexion={!conectado}
        onSilenciarTodos={onSilenciarTodos}
        onModo={onModo}
        onMover={sessionId ? () => setMoviendo(true) : undefined}
        manosLevantadas={manos.queue.length}
        onGente={onGente}
      />

      <div className="flex flex-1 min-h-0 relative bg-[#0b0b0d] overflow-hidden">
        <div className="flex-1 min-w-0 h-full overflow-hidden relative flex flex-col">
          {mudanza && <AvisoMudanza mudanza={mudanza} gobierna={gobierna} onQuitar={quitarMudanza} onVista={gobierna ? undefined : mudanzaVista} />}
          {moviendo && <MoverClase onMover={moverClase} onCerrar={() => setMoviendo(false)} />}
          <BannerEstado modo={modo} anfitrionPresente={anfitrionPresente} gobierna={gobierna} grabando={grabando} puedoMicrofono={puedoMicrofono} conTurno={!!miTurno} manoLevantada={manos.isHandRaised} />
          {(focoComun || fijadoId) && <div className="flex flex-wrap items-center gap-2 px-3 py-1 text-xs text-amber-100" data-testid="foco-sala">
            {focoComun && <><span>Foco de la sala: {celdas.find(c => c.identity === focoComun)?.nombre ?? 'participante ausente'}</span>{gobierna && <button onClick={() => onFocoComun(null)} className="min-h-9 underline px-2">Quitar foco común</button>}</>}
            {fijadoId && <button onClick={() => setFijadoId(null)} className="min-h-9 underline px-2">Volver a la vista común</button>}
          </div>}
          {errorMedio && <div role="alert" className="mx-3 mt-2 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100" data-testid="media-device-error"><p className="flex-1 min-w-0">{errorMedio}</p><button onClick={() => setErrorMedio(null)} className="shrink-0 rounded-lg px-2 py-1 hover:bg-white/10" aria-label="Cerrar aviso de dispositivo">Cerrar</button></div>}
          <div className="flex-1 min-h-0 p-2 md:p-3">
          <Rejilla
            onCamerasVisible={setCamarasVisibles}
            celdas={celdas}
            acciones={{
              gobierna,
              onFijar: (id) => setFijadoId((f) => (f === id ? null : id)),
              onFijarTodos: gobierna ? (id) => { void onFocoComun(id); } : undefined,
              focoComunId: focoComun,
              onDarPalabra, onQuitarPalabra, onRegalarTiempo, onSilenciar, onExpulsar,
              onVolumenLocal: (id, v) => volumen.setVolumeFor(id, v),
            }}
            fijadoId={fijadoId ?? focoPresente}
            hablandoId={hablandoId}
            vista={vistaEfectiva}
            pantallaCompartida={pantallaInfo}
            ahora={ahora}
          />
          </div>
          <OverlayTurno venceAt={miTurno?.vence_at ?? null} ahora={ahora} onCeder={onCederPalabra} />
          <FloatingReactions reactions={reacciones.visibleReactions} />
          <CallToast toasts={toasts} />
          {confirmandoSalida && (
            <ConfirmarSalida compartiendo={compartiendo} soyAnfitrion={soyAnfitrion} conTurno={!!miTurno} onQuedarme={quedarme} onSalir={salirYa} />
          )}
          {tarjeta && soyAnfitrion && (
            <TarjetaAnfitrion modo={modo} modoEvento={modoEvento} personas={participants.length} ocupado={tarjetaOcupada} onElegir={elegirModo} onCerrar={cerrarTarjeta} />
          )}
        </div>

        {panel && (
          <div className="absolute inset-0 md:relative md:inset-auto w-full md:w-96 shrink-0 border-l-0 md:border-l border-white/[0.06] bg-[#161618] flex flex-col z-20">
            {panel === 'gente' ? (
              <PanelGente
                modo={modo}
                celdas={celdas}
                manos={manosLista}
                gobierna={gobierna}
                onDarPalabra={onDarPalabra}
                onQuitarPalabra={onQuitarPalabra}
                onRegalarTiempo={onRegalarTiempo}
                onSilenciar={onSilenciar}
                onExpulsar={onExpulsar}
                onSilenciarTodos={onSilenciarTodos}
                onBajarTodasLasManos={manos.lowerAllHands}
                onCerrar={() => setPanel(null)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
                  <span className="text-sm font-semibold text-white">Chat</span>
                  <button onClick={() => setPanel(null)} className="text-xs text-white/60 hover:text-white">Cerrar</button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <InCallChat
                    messages={chat.messages}
                    onSendMessage={chat.sendMessage}
                    onSendAttachment={chat.sendAttachment}
                    isUploadingAttachment={chat.isUploadingAttachment}
                    currentUserId={userId}
                    prefillContent={chat.prefillContent}
                    onClearPrefill={chat.clearPrefill}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <BarraControles
        micAbierto={micAbierto}
        camaraAbierta={camaraAbierta}
        compartiendo={compartiendo}
        puedoMicrofono={puedoMicrofono && permissions.can_activate_mic}
        puedoCamara={puedoCamara && permissions.can_activate_camera}
        puedoPantalla={puedoPantalla && permissions.can_screen_share}
        conTurno={!!miTurno}
        manoLevantada={manos.isHandRaised}
        modo={modo}
        gobierna={gobierna}
        personas={participants.length}
        chatSinLeer={chat.unreadCount}
        chatAbierto={panel === 'chat'}
        genteAbierta={panel === 'gente'}
        manosLevantadas={manos.queue.length}
        vista={vista}
        pantallaCompleta={pantallaCompleta}
        onMic={onMic}
        onCamara={onCamara}
        onPantalla={onPantalla}
        onCambiarVentana={onCambiarVentana}
        onMano={onMano}
        onCederPalabra={onCederPalabra}
        onReaccion={reacciones.sendReaction}
        onChat={onChat}
        onGente={onGente}
        onSilenciarTodos={onSilenciarTodos}
        onModo={onModo}
        onVista={setVista}
        onPantallaCompleta={onPantallaCompleta}
        onSalir={solicitarSalida}
        avisoSinSonido={avisoSinSonido}
        onEntendidoSinSonido={() => { registrar('pantalla_audio', { aviso: 'entendido' }); setAvisoSinSonido(null); }}
        backgroundMode={backgroundEffect.currentMode}
        onChangeBackground={backgroundEffect.setMode}
        isBackgroundSupported={backgroundEffect.isSupported}
      />
    </div>
  );
}
