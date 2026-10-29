// ============================================
// VIDEO CALLING - RECORDING SERVICE v2 (Meet Soberano)
// ============================================
// Graba SIN Chrome y SIN encode en vivo. La v1 (RoomComposite + Chrome
// headless + x264 en la caja del SFU) satura el servidor. La v2 divide el trabajo:
//
//   DURANTE la llamada (costo ~1% CPU, verificado):
//     - 1 RoomComposite AUDIO-ONLY (SDK source, sin Chrome): mezcla el
//       audio de TODOS los participantes, incluidos los que entran tarde.
//     - N Track Egress de video (remux puro, sin transcode): screenshare
//       + camaras hasta MAX_RECORDED_VIDEO_TRACKS.
//
//   DESPUES de la llamada (fuera de esta app):
//     - los archivos quedan en el almacenamiento del egress; componer el MP4
//       final o transcribir es trabajo de tu propio proceso externo.
//
// Server-side only (usa LiveKit server SDK).

import {
  RoomServiceClient,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  DirectFileOutput,
  TrackType,
  TrackSource,
  EgressStatus,
  type ParticipantInfo,
} from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_API_URL } from '../config/livekit';
import { persistRecordingMode } from './recordingModeService';

// Server-side admin client (bypasses RLS) - this service runs only in API routes
// Perezoso a proposito: creado al importar, esto corre durante el BUILD y
// tumba la compilacion en cualquier entorno sin las variables de Supabase.
const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const supabaseAdmin = () => (_supabaseAdmin ??= crearSupabaseAdmin());
import type { VideoRecording, RecordingType, RecordingQuality } from '../types';

/**
 * Techo de tracks de video grabados por sesion. El compositor muestra max 6
 * tiles; grabar mas solo quema slots de admission del egress.
 */
import { selectRecordingTracks, recordingAdmission, recordingHost } from './recordingPolicy';
export { MAX_RECORDED_VIDEO_TRACKS } from './recordingPolicy';

function getEgressClient(): EgressClient {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_API_URL) {
    throw new Error('LiveKit API credentials not configured');
  }
  return new EgressClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

function getRoomClient(): RoomServiceClient {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_API_URL) {
    throw new Error('LiveKit API credentials not configured');
  }
  return new RoomServiceClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

/**
 * Path base de una sesion dentro del container del egress. ABSOLUTO a
 * proposito: egress v1.13 corre como usuario no-root y un path relativo
 * intenta mkdir en / (permission denied). /tmp/egress esta bind-mounted a
 * un directorio del host, de donde lo recoge tu proceso externo.
 */
function sessionBasePath(sessionId: string): string {
  return `/tmp/egress/sessions/${sessionId}`;
}

function participantRole(p: ParticipantInfo): string | undefined {
  try {
    return p.metadata ? (JSON.parse(p.metadata) as { role?: string }).role : undefined;
  } catch {
    return undefined;
  }
}

type VideoTrackRef = {
  trackSid: string;
  identity: string;
  source: 'screen_share' | 'camera';
  isHost: boolean;
};

/** Colecta los tracks de video publicados, ya ordenados por prioridad de grabacion. */
function collectVideoTracks(participants: ParticipantInfo[]): VideoTrackRef[] {
  const refs: VideoTrackRef[] = [];
  for (const p of participants) {
    const isHost = recordingHost(p.metadata);
    for (const t of p.tracks ?? []) {
      if (t.type !== TrackType.VIDEO) continue;
      const isShare = t.source === TrackSource.SCREEN_SHARE;
      if (!isShare && t.source !== TrackSource.CAMERA) continue;
      refs.push({
        trackSid: t.sid,
        identity: p.identity,
        source: isShare ? 'screen_share' : 'camera',
        isHost,
      });
    }
  }
  return selectRecordingTracks(refs);
}

/**
 * Arranca el track egress de UN track de video (remux puro, sin transcode).
 * El filename codifica identity/source/track para que el compositor offline
 * reconstruya el timeline sin tocar la base de datos (separador __ porque
 * las identities son UUIDs con guiones).
 */
async function startVideoTrackEgress(
  roomName: string,
  sessionId: string,
  track: { trackSid: string },
): Promise<string | null> {
  const egressClient = getEgressClient();
  try {
    const output = new DirectFileOutput({
      filepath: `${sessionBasePath(sessionId)}/video__{publisher_identity}__{track_source}__{track_id}__{time}`,
    });
    const info = await egressClient.startTrackEgress(roomName, output, track.trackSid);
    return info.egressId ?? null;
  } catch (err) {
    // Un track que fallo no debe tumbar la grabacion completa
    console.error(`[Recording] track egress fallo (${track.trackSid}):`, err);
    return null;
  }
}

/**
 * Start recording v2: audio composite (ancla) + track egresses de video.
 * El egress_id guardado en video_recordings es el del AUDIO composite;
 * los track egresses viven solo en LiveKit + manifests en disco.
 */
export async function startRecording(
  sessionId: string,
  roomName: string,
  recordingType: RecordingType = 'composite',
  _quality: RecordingQuality | undefined = undefined, // la calidad ahora la decide el compositor offline
): Promise<VideoRecording> {
  const egressClient = getEgressClient();
  const roomClient = getRoomClient();

  // A missing history must never make a Class recording fall back to faces.
  await persistRecordingMode(sessionId);

  // 1) Ancla: mezcla de audio de todo el room, SDK source (sin Chrome).
  const audioOutput = new EncodedFileOutput({
    fileType: EncodedFileType.OGG,
    filepath: `${sessionBasePath(sessionId)}/audio-mixed-{time}.ogg`,
  });
  const audioInfo = await egressClient.startRoomCompositeEgress(
    roomName,
    { file: audioOutput },
    { audioOnly: true },
  );

  // 2) Videos publicados ahora mismo (los que se publiquen despues los
  //    agrega el webhook track_published).
  let tracksStarted = 0;
  try {
    const participants = await roomClient.listParticipants(roomName);
    const videoTracks = collectVideoTracks(participants);
    const results = await Promise.allSettled(
      videoTracks.map((t) => startVideoTrackEgress(roomName, sessionId, t)),
    );
    tracksStarted = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  } catch (err) {
    console.error('[Recording] listParticipants fallo (los tracks entraran via webhook):', err);
  }

  console.log(
    `[Recording] v2 iniciada: session=${sessionId} room=${roomName} audio=${audioInfo.egressId} videoTracks=${tracksStarted}`,
  );

  // 3) Registro en DB (una fila por grabacion; el artefacto final es el
  //    MP4 compuesto que entrega el worker).
  const { data: recording, error } = await supabaseAdmin()
    .from('video_recordings')
    .insert({
      session_id: sessionId,
      recording_type: recordingType,
      egress_id: audioInfo.egressId,
      status: 'recording',
      format: 'mp4',
    })
    .select()
    .single();

  if (error) throw error;

  await supabaseAdmin()
    .from('video_sessions')
    .update({ recording_status: 'recording' })
    .eq('id', sessionId);

  return recording as VideoRecording;
}

/**
 * Suma un track de video recien publicado a una grabacion activa.
 * Llamado desde el webhook track_published. Respeta el techo de tracks.
 */
export async function addTrackToActiveRecording(
  roomName: string,
  sessionId: string,
  trackSid: string,
  priorityCamera = false,
): Promise<boolean> {
  const egressClient = getEgressClient();
  try {
    const active = await egressClient.listEgress({ roomName, active: true });
    const hasAnchor = active.some((e) => e.roomName === roomName && e.request.case === 'roomComposite');
    if (!hasAnchor) return false; // no hay grabacion activa
    const participants = await getRoomClient().listParticipants(roomName);
    const tracks = participants.flatMap(p => (p.tracks ?? []).filter(t => t.type === TrackType.VIDEO).map(t => ({
      trackSid: t.sid, source: t.source === TrackSource.SCREEN_SHARE ? 'screen_share' as const : 'camera' as const,
      isHost: recordingHost(p.metadata),
    })));
    const incoming = tracks.find(t => t.trackSid === trackSid);
    if (!incoming) return false; // it ended before the webhook arrived
    const videoEgress = active.filter(e => e.request.case === 'track');
    const activeTracks = videoEgress.map(e => {
      const id = e.request.case === 'track' ? e.request.value.trackId : '';
      // Unknown tracks are protected, not assumed to be expendable cameras.
      return { ...(tracks.find(t => t.trackSid === id) ?? {trackSid:id,source:'screen_share' as const,isHost:false}), egressId:e.egressId };
    });
    const plan = recordingAdmission(activeTracks, incoming, priorityCamera);
    if (!plan.start) return false;
    if (plan.stop) await egressClient.stopEgress(plan.stop);
    const egressId = await startVideoTrackEgress(roomName, sessionId, { trackSid });
    return Boolean(egressId);
  } catch (err) {
    console.error('[Recording] addTrackToActiveRecording fallo:', err);
    return false;
  }
}

/** A granted class turn also prioritizes that person's camera in the saved video. */
export async function priorizarCamaraGrabada(roomName: string, sessionId: string, identity: string): Promise<boolean> {
  try {
    const participant = await getRoomClient().getParticipant(roomName, identity);
    const camera = participant.tracks.find(t=>t.type===TrackType.VIDEO && t.source===TrackSource.CAMERA && !t.muted);
    return camera ? await addTrackToActiveRecording(roomName, sessionId, camera.sid, true) : false;
  } catch (error) { console.warn('[Recording] camera priority unavailable:', identity, error instanceof Error ? error.message : 'unknown'); return false; }
}

/** Lo que hace falta para detener: cualquiera de los tres basta. */
export interface StopTarget {
  egressId?: string | null;
  roomName?: string | null;
  sessionId?: string | null;
}

export interface StopResult {
  /** egresses activos que se mandaron detener */
  stopped: number;
  /** egresses activos que habia en la sala */
  total: number;
  roomName: string | null;
  sessionId: string | null;
}

/**
 * Stop v2: detiene TODOS los egresses activos del room (ancla + tracks).
 *
 * 2 sep 2026 (defecto 0 de la primera clase real): el anfitrion NO podia
 * detener la grabacion porque la UI solo conocia el egress_id si ESA pestaña
 * la habia arrancado, y la auto-grabacion arranca en el servidor. Ahora se
 * acepta el nombre de la sala o el id de la sesion: se resuelve todo lo
 * activo y se detiene. Desde cualquier pestaña, la haya iniciado o no.
 */
export async function stopRecording(target: string | StopTarget): Promise<StopResult> {
  const egressClient = getEgressClient();
  const t: StopTarget = typeof target === 'string'
    ? (target.startsWith('EG_') ? { egressId: target } : { roomName: target })
    : target;

  let roomName: string | null = t.roomName ?? null;
  let sessionId: string | null = t.sessionId ?? null;

  // sesion → sala
  if (!roomName && sessionId) {
    const { data: ses } = await supabaseAdmin()
      .from('video_sessions')
      .select('room:room_id(livekit_room_name, slug)')
      .eq('id', sessionId)
      .maybeSingle();
    const room = Array.isArray(ses?.room) ? ses?.room[0] : ses?.room;
    roomName = (room as { livekit_room_name?: string; slug?: string } | null)?.livekit_room_name
      ?? (room as { slug?: string } | null)?.slug
      ?? null;
  }
  // egress → sala (y sesion, via la fila de grabacion)
  if (t.egressId) {
    if (!roomName) {
      try {
        const infos = await egressClient.listEgress({ egressId: t.egressId });
        roomName = infos[0]?.roomName ?? null;
      } catch (err) {
        console.error('[Recording] listEgress por egressId fallo:', err);
      }
    }
    if (!sessionId) {
      const { data: rec } = await supabaseAdmin()
        .from('video_recordings')
        .select('session_id')
        .eq('egress_id', t.egressId)
        .maybeSingle();
      sessionId = rec?.session_id ?? null;
    }
  }

  // Todo lo activo en la sala
  let active: { egressId: string }[] = [];
  if (roomName) {
    try {
      active = await egressClient.listEgress({ roomName, active: true });
    } catch (err) {
      console.error('[Recording] listEgress por sala fallo:', err);
    }
  }
  if (t.egressId && !active.some((e) => e.egressId === t.egressId)) {
    active.push({ egressId: t.egressId });
  }

  const results = await Promise.allSettled(active.map((e) => egressClient.stopEgress(e.egressId)));
  const stopped = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`[Recording] stop v2: room=${roomName} session=${sessionId} egresses detenidos=${stopped}/${active.length}`);

  // La base refleja el hecho: ya no se graba; el worker compone lo que haya.
  if (sessionId) {
    await supabaseAdmin()
      .from('video_recordings')
      .update({ status: 'uploading' })
      .eq('session_id', sessionId)
      .eq('status', 'recording');
    await supabaseAdmin()
      .from('video_sessions')
      .update({ recording_status: 'processing' })
      .eq('id', sessionId);
  }

  return { stopped, total: active.length, roomName, sessionId };
}

/**
 * Get recordings for a session
 */
export async function getSessionRecordings(sessionId: string): Promise<VideoRecording[]> {
  const { data, error } = await supabaseAdmin()
    .from('video_recordings')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as VideoRecording[];
}

/**
 * List participants in a LiveKit room (live query)
 */
export async function getLiveParticipants(roomName: string) {
  const roomClient = getRoomClient();
  return roomClient.listParticipants(roomName);
}

/**
 * Mute a participant in a LiveKit room.
 * Uses updateParticipant to set permissions (no track SID needed).
 */
export async function muteParticipant(
  roomName: string,
  identity: string,
  muteAudio: boolean,
  muteVideo: boolean,
): Promise<void> {
  const roomClient = getRoomClient();
  await roomClient.updateParticipant(roomName, identity, undefined, {
    canPublish: !muteAudio && !muteVideo,
    canPublishData: true,
    canSubscribe: true,
  });
}

/**
 * Remove (kick) a participant from a LiveKit room
 */
export async function kickParticipant(
  roomName: string,
  identity: string,
): Promise<void> {
  const roomClient = getRoomClient();
  await roomClient.removeParticipant(roomName, identity);
}

/**
 * Mute every participant in the room EXCEPT admins/owners and the caller.
 * Host shortcut used during live classes when side-chatter needs to stop.
 *
 * IMPORTANT: Uses `mutePublishedTrack` per audio track instead of revoking
 * `canPublish`. This is the critical difference vs the previous implementation:
 *
 *   - mutePublishedTrack: silences the existing track but keeps publish
 *     permission intact. The participant sees their mic muted in the UI and
 *     can unmute themselves with one click ("smooth unmute").
 *
 *   - updateParticipant({canPublish:false}): revokes the publish permission
 *     entirely. The participant's UI looks broken — clicking the mic does
 *     nothing because the server rejects every publish attempt. Only fix is
 *     to leave the room and rejoin (recreates the access token with full
 *     default perms). Users then report "no puedo activar micro ni camara".
 *
 * - Reads `metadata.role` from each participant's LiveKit metadata.
 * - Never mutes admins/owners or the requesting identity.
 * - Only mutes audio tracks (camera/screen share untouched).
 */
export async function muteAllExceptAdmins(
  roomName: string,
  callerIdentity?: string,
): Promise<{ muted: string[]; skipped: string[] }> {
  const roomClient = getRoomClient();

  // Tolerate a missing/finished room: return empty result instead of 500ing.
  let participants: Awaited<ReturnType<RoomServiceClient['listParticipants']>>;
  try {
    participants = await roomClient.listParticipants(roomName);
  } catch (err) {
    console.error(`[muteAllExceptAdmins] listParticipants failed for ${roomName}:`, err);
    return { muted: [], skipped: [] };
  }

  const muted: string[] = [];
  const skipped: string[] = [];

  await Promise.all(
    participants.map(async (p) => {
      const identity = p.identity;
      if (!identity) return;

      if (callerIdentity && identity === callerIdentity) {
        skipped.push(identity);
        return;
      }

      const role = participantRole(p);

      if (role === 'admin' || role === 'owner') {
        skipped.push(identity);
        return;
      }

      // Find this participant's audio tracks and mute each one server-side.
      // mutePublishedTrack flips muted=true on the track but keeps the
      // canPublish permission intact — user can unmute with 1 click.
      const audioTracks = (p.tracks ?? []).filter((t) => t.type === TrackType.AUDIO);

      if (audioTracks.length === 0) {
        // No audio track to mute (mic was already off / never published).
        // Skip silently — nothing to do.
        return;
      }

      const muteResults = await Promise.allSettled(
        audioTracks.map((track) =>
          roomClient.mutePublishedTrack(roomName, identity, track.sid, true),
        ),
      );

      const anySuccess = muteResults.some((r) => r.status === 'fulfilled');
      if (anySuccess) {
        muted.push(identity);
      } else {
        console.error(
          `[muteAllExceptAdmins] all track mutes failed for ${identity}:`,
          muteResults,
        );
      }
    }),
  );

  return { muted, skipped };
}

// ---------------------------------------------------------------------------
// LA GRABACION QUE SE REPARA SOLA
// ---------------------------------------------------------------------------
// Un track egress puede fallar al conectar ("could not connect after timeout")
// y perder la pantalla o la camara del anfitrion si nadie lo reintenta. La verdad de
// "se esta grabando" es el ancla de audio VIVA en LiveKit, no una columna. Este
// arbitro compara lo publicado contra lo que se graba y repara la diferencia;
// lo llaman el polling de la sala (cada pocos segundos, con freno) y el webhook
// de un egress que fallo.

/** Ancla de audio arrancando o grabando. ENDING no cuenta: es un "Detener" en curso. */
function esAnclaViva(e: { roomName: string; status: EgressStatus; request: { case?: string } }, roomName: string): boolean {
  return e.roomName === roomName && e.request.case === 'roomComposite'
    && (e.status === EgressStatus.EGRESS_STARTING || e.status === EgressStatus.EGRESS_ACTIVE);
}

const intentosPorPista = new Map<string, number>();
const MAX_INTENTOS_PISTA = 4;
const ultimoArbitraje = new Map<string, number>();
const ARBITRAJE_CADA_MS = 20_000;

export interface Arbitraje {
  anclaViva: boolean;
  iniciadas: string[];
  pendientes: string[];
}

/**
 * Asegura que cada pista de video publicada que cabe en la grabacion tenga su
 * track egress. Si el ancla no esta viva, no hay grabacion: no hace nada.
 * `forzar` salta el freno (lo usa el webhook de un egress fallido).
 */
export async function asegurarPistasGrabadas(roomName: string, sessionId: string, forzar = false): Promise<Arbitraje | null> {
  const ahora = Date.now();
  if (!forzar && ahora - (ultimoArbitraje.get(sessionId) ?? 0) < ARBITRAJE_CADA_MS) return null;
  ultimoArbitraje.set(sessionId, ahora);
  const egressClient = getEgressClient();
  const active = await egressClient.listEgress({ roomName, active: true });
  const anclaViva = active.some((e) => esAnclaViva(e, roomName));
  if (!anclaViva) return { anclaViva, iniciadas: [], pendientes: [] };

  const participants = await getRoomClient().listParticipants(roomName);
  const publicadas = participants.flatMap(p => (p.tracks ?? [])
    .filter(t => t.type === TrackType.VIDEO && (t.source === TrackSource.CAMERA || t.source === TrackSource.SCREEN_SHARE) && !t.muted)
    .map(t => ({
      trackSid: t.sid,
      source: t.source === TrackSource.SCREEN_SHARE ? 'screen_share' as const : 'camera' as const,
      isHost: recordingHost(p.metadata),
    })));
  const enCurso = active.filter(e => e.request.case === 'track').map(e => {
    const id = e.request.case === 'track' ? e.request.value.trackId : '';
    return { ...(publicadas.find(t => t.trackSid === id) ?? { trackSid: id, source: 'screen_share' as const, isHost: false }), egressId: e.egressId };
  });
  const faltan = selectRecordingTracks(publicadas).filter(t => !enCurso.some(e => e.trackSid === t.trackSid));

  const iniciadas: string[] = [];
  const pendientes: string[] = [];
  for (const pista of faltan) {
    const n = intentosPorPista.get(pista.trackSid) ?? 0;
    if (n >= MAX_INTENTOS_PISTA) { pendientes.push(pista.trackSid); continue; }
    const plan = recordingAdmission(enCurso, pista, pista.isHost);
    if (!plan.start) { pendientes.push(pista.trackSid); continue; }
    intentosPorPista.set(pista.trackSid, n + 1);
    if (plan.stop) {
      await egressClient.stopEgress(plan.stop).catch(() => undefined);
      const i = enCurso.findIndex(e => e.egressId === plan.stop);
      if (i >= 0) enCurso.splice(i, 1);
    }
    const egressId = await startVideoTrackEgress(roomName, sessionId, pista);
    if (egressId) { iniciadas.push(pista.trackSid); enCurso.push({ ...pista, egressId }); }
    else pendientes.push(pista.trackSid);
  }
  if (iniciadas.length || pendientes.length) {
    console.log(`[Recording] arbitro ${sessionId}: iniciadas=${iniciadas.join(',') || '-'} pendientes=${pendientes.join(',') || '-'}`);
  }
  return { anclaViva, iniciadas, pendientes };
}

/** ¿Sigue viva el ancla de audio de esta sala? null = no se pudo saber. */
export async function anclaDeGrabacionViva(roomName: string): Promise<boolean | null> {
  try {
    const active = await getEgressClient().listEgress({ roomName, active: true });
    return active.some((e) => esAnclaViva(e, roomName));
  } catch (err) {
    console.error('[Recording] no pude consultar el ancla:', err);
    return null;
  }
}
