// ============================================
// API Route: LiveKit Webhook Handler — EL SENSOR DE ASISTENCIA
// ============================================
// POST /api/video-calling/webhooks/livekit
//
// La asistencia se escribe SOLO aqui, porque el
// SFU es el unico que sabe quien esta conectado de verdad:
//   · participant_joined  → UNA FILA NUEVA por conexion (participant_sid).
//     Antes era un upsert por (session,user) que al reentrar pisaba joined_at y
//     dejaba el left_at viejo: 148 filas con "salio antes de entrar".
//   · participant_left    → cierra ESA conexion por participant_sid (y, si la
//     fila es anterior a este cambio, la ultima abierta de esa persona).
//     Ya no exige que la sesion siga abierta: LiveKit no garantiza el orden de
//     sus webhooks y room_finished podia llegar antes que el ultimo left.
//   · room_finished       → cierra la sesion Y las filas que quedaron abiertas,
//     marcadas como "salida no reportada" (la sala murio en ese instante; eso
//     si es un hecho, no un invento).
//   · track_published     → enciende had_audio / had_video / had_screen_share
//     de la conexion viva y, si se esta grabando, suma el video a la grabacion.

import { NextRequest, NextResponse } from 'next/server';
import { usuarioDeIdentity } from '@/features/video-calling/lib/identidad';
import { WebhookReceiver } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from '@/features/video-calling/config/livekit';
import { startRecording, addTrackToActiveRecording, asegurarPistasGrabadas } from '@/features/video-calling/services/recordingService';
import { awardSessionPoints } from '@/features/video-calling/services/gamificationBridge';

// Perezoso a proposito: creado al importar, esto corre durante el BUILD y
// tumba la compilacion en cualquier entorno sin las variables de Supabase.
const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const supabaseAdmin = () => (_supabaseAdmin ??= crearSupabaseAdmin());

const webhookReceiver = (LIVEKIT_API_KEY && LIVEKIT_API_SECRET)
  ? new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const authHeader = request.headers.get('authorization') || '';

    if (webhookReceiver) {
      try {
        const event = await webhookReceiver.receive(body, authHeader);
        return handleWebhookEvent(event);
      } catch {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Fallback: parse without verification (dev mode sin llaves)
    const event = JSON.parse(body);
    return handleWebhookEvent(event);
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWebhookEvent(event: any): Promise<NextResponse> {
  const eventType = event.event;
  console.log(`[LiveKit Webhook] ${eventType}`, JSON.stringify(event).substring(0, 200));

  switch (eventType) {
    case 'participant_joined':
      await handleParticipantJoined(event);
      break;
    case 'participant_left':
      await handleParticipantLeft(event);
      break;
    case 'room_started':
      await handleRoomStarted(event);
      break;
    case 'room_finished':
      await handleRoomFinished(event);
      break;
    case 'egress_ended':
      await handleEgressEnded(event);
      break;
    case 'track_published':
      await handleTrackPublished(event);
      break;
    default:
      console.log(`[LiveKit Webhook] Unhandled event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Solo personas: identidades UUID (miembros). Los egress/ingress/agentes no son asistencia. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function esPersona(participant: any): boolean {
  if (!participant?.identity || !UUID_RE.test(usuarioDeIdentity(participant.identity))) return false;
  const kind = participant.kind;
  // ParticipantInfo_Kind: 0 STANDARD · 1 INGRESS · 2 EGRESS · 3 SIP · 4 AGENT
  if (kind === undefined || kind === null || kind === 0 || kind === 'STANDARD') return true;
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rolDelParticipante(participant: any): 'host' | 'participant' {
  try {
    const meta = participant?.metadata ? JSON.parse(participant.metadata) : null;
    return meta?.role === 'admin' || meta?.role === 'owner' ? 'host' : 'participant';
  } catch {
    return 'participant';
  }
}

type SesionSala = {
  id: string;
  ended_at: string | null;
  peak_participants: number | null;
  recording_status: string | null;
  room: { id: string; event_id: string | null; livekit_room_name: string | null };
};

/**
 * La sesion de una sala por su nombre en LiveKit. `soloAbierta=false` acepta la
 * ultima sesion aunque ya haya cerrado (los webhooks llegan desordenados).
 */
async function sesionDeLaSala(roomName: string, soloAbierta: boolean): Promise<SesionSala | null> {
  let q = supabaseAdmin()
    .from('video_sessions')
    .select('id, ended_at, peak_participants, recording_status, room:room_id!inner(id, event_id, livekit_room_name)')
    .eq('room.livekit_room_name', roomName)
    .order('started_at', { ascending: false })
    .limit(1);
  if (soloAbierta) q = q.is('ended_at', null);
  else q = q.gte('started_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  const { data } = await q;
  const s = data?.[0];
  if (!s) return null;
  const room = Array.isArray(s.room) ? s.room[0] : s.room;
  return { ...s, room } as SesionSala;
}

// ---------------------------------------------------------------------------
// participant_joined → fila nueva por conexion
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleParticipantJoined(event: any): Promise<void> {
  const roomName = event.room?.name;
  const participant = event.participant;
  if (!roomName || !esPersona(participant)) return;

  const session = await sesionDeLaSala(roomName, true);
  if (!session) return;

  const fila = {
    session_id: session.id,
    user_id: usuarioDeIdentity(participant.identity as string),
    participant_sid: (participant.sid as string) || null,
    role: rolDelParticipante(participant),
    joined_at: new Date().toISOString(),
    left_at: null,
    had_audio: false,
    had_video: false,
    had_screen_share: false,
    device_info: {},
    points_awarded: 0,
  };

  // Idempotente por conexion SIN upsert: el indice unico de participant_sid es
  // PARCIAL (WHERE participant_sid IS NOT NULL) y Postgres no lo acepta como
  // target de ON CONFLICT — un upsert ahi fallaba en silencio y no escribia
  // NADA (bug encontrado el 2 sep). Se verifica a mano y el indice queda solo
  // como defensa de ultima linea (el insert que choque se ignora).
  if (fila.participant_sid) {
    const { data: ya } = await supabaseAdmin()
      .from('video_participants')
      .select('id')
      .eq('participant_sid', fila.participant_sid)
      .maybeSingle();
    if (ya) return; // LiveKit reintento este webhook: ya esta registrado
  }
  const { error } = await supabaseAdmin().from('video_participants').insert(fila);
  if (error && error.code !== '23505') {
    console.error('[LiveKit Webhook] no pude registrar la entrada:', error.message);
  }

  const { count } = await supabaseAdmin()
    .from('video_participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .is('left_at', null);

  if (count && count > (session.peak_participants || 0)) {
    await supabaseAdmin()
      .from('video_sessions')
      .update({ peak_participants: count })
      .eq('id', session.id);
  }

  await maybeAutoStartRecording(session, roomName).catch((err) => {
    console.error('[LiveKit Webhook] Auto-start recording failed:', err);
  });
}

/**
 * EL ANFITRION MANDA SOBRE SU GRABACION.
 *
 * Por defecto la grabacion la arranca y detiene quien da la clase, a mano: asi
 * no se graban los minutos de gente entrando ni la sobremesa. El arranque
 * automatico a T=0 del evento queda tras un interruptor: `AUTO_RECORD_CLASES=on`
 * lo activa; cualquier otra cosa (incluida la ausencia de la variable) lo deja
 * apagado.
 */
const AUTO_RECORD_ACTIVO = process.env.AUTO_RECORD_CLASES === 'on';

async function maybeAutoStartRecording(session: SesionSala, roomName: string): Promise<void> {
  if (!AUTO_RECORD_ACTIVO) return;   // el profesor arranca su grabacion
  if (
    session.recording_status === 'recording' ||
    session.recording_status === 'processing' ||
    session.recording_status === 'ready'
  ) {
    return;
  }

  const eventId = session.room?.event_id;
  if (!eventId) return; // sala sin evento: sin auto-grabacion

  const { data: event } = await supabaseAdmin()
    .from('events')
    .select('start_time, duration_minutes')
    .eq('id', eventId)
    .maybeSingle();
  if (!event?.start_time) return;

  const now = Date.now();
  const start = new Date(event.start_time).getTime();
  const end = start + (event.duration_minutes || 60) * 60 * 1000;
  // Solo arranca dentro de la ventana programada. Si la clase se alarga, la
  // grabacion que ya corre sigue; esto solo decide el ARRANQUE.
  if (now < start || now > end) return;

  const { data: existing } = await supabaseAdmin()
    .from('video_recordings')
    .select('id, status')
    .eq('session_id', session.id)
    .in('status', ['recording', 'uploading', 'ready'])
    .limit(1);
  if (existing && existing.length > 0) return;

  console.log(`[LiveKit Webhook] Auto-starting recording for session ${session.id} (event ${eventId})`);
  await startRecording(session.id, roomName, 'composite', '480p');
}

// ---------------------------------------------------------------------------
// participant_left → cierra ESA conexion
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleParticipantLeft(event: any): Promise<void> {
  const roomName = event.room?.name;
  const participant = event.participant;
  if (!roomName || !esPersona(participant)) return;

  const session = await sesionDeLaSala(roomName, false);
  if (!session) return;

  const ahora = new Date().toISOString();
  const sid = participant.sid as string | undefined;

  if (sid) {
    const { data: cerradas } = await supabaseAdmin()
      .from('video_participants')
      .update({ left_at: ahora })
      .eq('participant_sid', sid)
      .is('left_at', null)
      .select('id');
    if (cerradas && cerradas.length > 0) return;
  }

  // Fila anterior a este cambio (sin participant_sid): la ultima abierta de esa persona.
  const { data: abierta } = await supabaseAdmin()
    .from('video_participants')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', usuarioDeIdentity(participant.identity))
    .is('left_at', null)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (abierta) {
    await supabaseAdmin()
      .from('video_participants')
      .update({ left_at: ahora })
      .eq('id', abierta.id);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRoomStarted(event: any): Promise<void> {
  const roomName = event.room?.name;
  if (!roomName) return;
  await supabaseAdmin()
    .from('video_rooms')
    .update({ status: 'active' })
    .eq('livekit_room_name', roomName);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRoomFinished(event: any): Promise<void> {
  const roomName = event.room?.name;
  if (!roomName) return;

  const { data: room } = await supabaseAdmin()
    .from('video_rooms')
    .select('id')
    .eq('livekit_room_name', roomName)
    .single();
  if (!room) return;

  const ahora = new Date().toISOString();
  const { data: abiertas } = await supabaseAdmin()
    .from('video_sessions')
    .select('id')
    .eq('room_id', room.id)
    .is('ended_at', null);

  for (const s of abiertas ?? []) {
    // La sala termino: nadie sigue adentro. Las filas abiertas se cierran a ESTA
    // hora y quedan marcadas: la salida real no se reporto.
    await supabaseAdmin()
      .from('video_participants')
      .update({ left_at: ahora, nota_calidad: 'cerrado al terminar la sala (salida no reportada)' })
      .eq('session_id', s.id)
      .is('left_at', null);

    const { data: filas } = await supabaseAdmin()
      .from('video_participants')
      .select('user_id')
      .eq('session_id', s.id);
    const unicos = new Set((filas ?? []).map((f) => f.user_id)).size;

    // cerrada_por = 'sfu': nadie apreto "Terminar" ni llego el reloj; la sala se vacio sola.
    await supabaseAdmin()
      .from('video_sessions')
      .update({ ended_at: ahora, total_unique_participants: unicos, cerrada_por: 'sfu' })
      .eq('id', s.id);
  }

  await supabaseAdmin()
    .from('video_rooms')
    .update({ status: 'idle' })
    .eq('id', room.id);

  // Incluye reintentos: si el primer webhook cerró la sesión pero falló al
  // acreditar, el siguiente vuelve a la última sesión cerrada sin duplicar.
  const { data: closed, error } = await supabaseAdmin().from('video_sessions')
    .select('id').eq('room_id', room.id).not('ended_at', 'is', null)
    .order('ended_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (closed) await awardSessionPoints(closed.id, supabaseAdmin());
}

/**
 * El post-proceso de la grabacion (MP4 final, transcript) vive fuera de esta
 * app. Aqui solo nos interesa el FALLO del egress ancla (audio composite).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEgressEnded(event: any): Promise<void> {
  const egressInfo = event.egressInfo || event.egress_info;
  const egressId = egressInfo?.egressId || egressInfo?.egress_id;
  if (!egressId) return;

  const status = egressInfo?.status;
  const isComplete = status === 3 || status === 'EGRESS_COMPLETE';
  console.log(`[LiveKit Webhook] Egress ended: ${egressId}, status: ${status}`);
  if (isComplete) return;

  // Un track egress que fallo (5 oct: "could not connect after timeout" en la
  // pantalla y la camara del anfitrion) se reintenta mientras la pista siga
  // publicada y la grabacion viva. El arbitro limita los intentos por pista.
  const trackDelEgress = egressInfo?.track?.trackId || egressInfo?.track?.track_id;
  const salaDelEgress = egressInfo?.roomName || egressInfo?.room_name;
  if (trackDelEgress && salaDelEgress) {
    const session = await sesionDeLaSala(salaDelEgress, true);
    if (session) {
      await new Promise((r) => setTimeout(r, 2000));
      const r = await asegurarPistasGrabadas(salaDelEgress, session.id, true).catch((err) => {
        console.error('[LiveKit Webhook] reintento de pista fallo:', err);
        return null;
      });
      console.log(`[LiveKit Webhook] track egress ${egressId} fallo (${egressInfo?.error ?? status}); reintento: ${JSON.stringify(r)}`);
    }
    return;
  }

  const { data: rec } = await supabaseAdmin()
    .from('video_recordings')
    .select('id, session_id')
    .eq('egress_id', egressId)
    .maybeSingle();
  if (!rec) return;

  await supabaseAdmin()
    .from('video_recordings')
    .update({ status: 'failed', processing_status: 'failed' })
    .eq('id', rec.id);
  await supabaseAdmin()
    .from('video_sessions')
    .update({ recording_status: 'failed' })
    .eq('id', rec.session_id);
  console.error(`[LiveKit Webhook] Egress ancla ${egressId} fallo (status ${status})`);
}

// ---------------------------------------------------------------------------
// track_published → flags de la conexion + sumar video a la grabacion
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTrackPublished(event: any): Promise<void> {
  const roomName = event.room?.name;
  const track = event.track;
  const participant = event.participant;
  if (!roomName || !track) return;

  // TrackType: 0 AUDIO · 1 VIDEO. TrackSource: 1 CAMERA · 2 MICROPHONE · 3 SCREEN_SHARE
  const isVideo = track.type === 1 || track.type === 'VIDEO';
  const isAudio = track.type === 0 || track.type === 'AUDIO';
  const isShare = track.source === 3 || track.source === 'SCREEN_SHARE' || track.source === 4 || track.source === 'SCREEN_SHARE_AUDIO';

  if (esPersona(participant)) {
    const flags: Record<string, boolean> = {};
    if (isAudio && !isShare) flags.had_audio = true;
    if (isVideo && !isShare) flags.had_video = true;
    if (isShare) flags.had_screen_share = true;
    if (Object.keys(flags).length > 0) {
      const sid = participant.sid as string | undefined;
      const base = supabaseAdmin().from('video_participants').update(flags).is('left_at', null);
      const { data: porSid } = sid ? await base.eq('participant_sid', sid).select('id') : { data: [] as { id: string }[] };
      if (!porSid || porSid.length === 0) {
        const session = await sesionDeLaSala(roomName, true);
        if (session) {
          await supabaseAdmin()
            .from('video_participants')
            .update(flags)
            .eq('session_id', session.id)
            .eq('user_id', usuarioDeIdentity(participant.identity))
            .is('left_at', null);
        }
      }
    }
  }

  const trackSid = track.sid;
  if (!isVideo || !trackSid) return;

  // 6 oct 2026: ya no se pregunta a `recording_status`. El 5 oct un callback
  // prematuro del worker la movio con la clase en curso y desde ahi se
  // ignoraron la camara y la pantalla del anfitrion. Quien decide si hay
  // grabacion es el ancla de audio viva (addTrackToActiveRecording la verifica).
  const session = await sesionDeLaSala(roomName, true);
  if (!session) return;

  const added = await addTrackToActiveRecording(roomName, session.id, trackSid);
  if (added) {
    console.log(`[LiveKit Webhook] track ${trackSid} agregado a la grabacion de ${session.id}`);
  }
}
