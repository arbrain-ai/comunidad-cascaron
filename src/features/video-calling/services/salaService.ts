// ============================================
// VIDEO CALLING - EL GOBIERNO DE LA SALA (SERVER-SIDE ONLY)
// ============================================
// 5 sep 2026 (sala v2). Hasta hoy el "modo" de la sala vivia en un broadcast
// de Realtime que solo veian los que ya estaban dentro; quien entraba tarde
// entraba en "Libre" con el microfono abierto, y el auto-mute dependia de la
// buena voluntad del navegador del que hablaba. Este modulo mueve TODO eso al
// servidor:
//
//   · MODO      abierta (todos hablan; en la UI "Libre") | clase (micro solo con
//               turno). Vive en video_sessions.modo. Al entrar el anfitrion la
//               sala toma el modo del EVENTO (events.modo_sala) o, si el evento
//               no dice nada, Libre en salas chicas y Clase en grandes; el anfitrion elige en
//               una tarjeta con dos botones. Se cambia cuando quiera (8 sep 2026).
//   · PERMISOS  se traducen a permisos de publicacion en LiveKit
//               (canPublishSources): sin turno no hay microfono, aunque el
//               cliente sea viejo, este cerrado o no coopere.
//   · TURNOS    cada palabra concedida es una fila con vencimiento
//               (video_turnos). El arbitro corre en reconciliar(): cualquier
//               cliente que pregunte por el estado lo dispara.
//   · CIERRE    la sala se apaga sola a cierre_at (90 min por default desde la
//               hora programada): termina la sesion y borra la sala en LiveKit.
//
// Este archivo NUNCA se importa desde el cliente.

import { createClient } from '@supabase/supabase-js';
import { identityDeDispositivo, usuarioDeIdentity } from '@/features/video-calling/lib/identidad';
import {
  RoomServiceClient,
  TrackSource,
  TrackType,
  type ParticipantInfo,
  type ParticipantPermission,
} from 'livekit-server-sdk';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_API_URL } from '../config/livekit';
import { stopRecording } from './recordingService';
import { persistRecordingMode } from './recordingModeService';
import { appendRecordingMode } from './recordingModePolicy';
import { awardSessionPoints } from './gamificationBridge';
import { readRoomFocus, readRoomSpeaker } from '../sala/sharedComposition';
import { readMudanza, type Mudanza } from '../sala/mudanzaPolicy';

import { fuentesPermitidas, modoAlEntrar, type Modo, type RolSala } from './salaPolicy';
export { fuentesPermitidas, modoAlEntrar, SALA_CHICA_MAX_PARTICIPANTES, type Modo, type RolSala } from './salaPolicy';

/** Defaults de la sala. Parametrizables por sala. */
export const DURACION_MAX_MINUTOS_DEFAULT = 90;
export const TURNO_MAX_SEGUNDOS_DEFAULT = 180;
export const PRESUPUESTO_TOTAL_SEGUNDOS_DEFAULT = 300;
/** La sala abre antes de la hora: "a la racita le gusta hablar antes de que yo llegue". */
export const MINUTOS_ANTES_PARA_ABRIR = 20;
/** El arbitro no vuelve a preguntarle al SFU si acaba de hacerlo. */
const RECONCILIAR_CADA_MS = 6_000;

const ROLES_STAFF = new Set(['admin', 'owner', 'moderator']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Perezoso a proposito: creado al importar, esto corre durante el BUILD.
const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const db = () => (_supabaseAdmin ??= crearSupabaseAdmin());

/** Identity que recibe ESTE dispositivo: user.id, o user.id~dispositivo si la
 *  persona ya está conectada desde otro (LiveKit expulsaría al anterior). */
export async function identityParaDispositivo(sala: SalaFila, userId: string, dispositivo: string | null): Promise<string> {
  if (!dispositivo) return userId;
  try {
    const gente = await sfu().listParticipants(nombreSala(sala));
    const base = gente.find((p) => p.identity === userId);
    if (!base) return userId;
    let suyo: string | null = null;
    try { suyo = base.metadata ? (JSON.parse(base.metadata) as { dispositivo?: string }).dispositivo ?? null : null; } catch { suyo = null; }
    return suyo === dispositivo ? userId : identityDeDispositivo(userId, dispositivo);
  } catch {
    return userId; // sala vacía en el SFU
  }
}

function sfu(): RoomServiceClient {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_API_URL) throw new Error('LiveKit API credentials not configured');
  return new RoomServiceClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

// ---------------------------------------------------------------------------
// Tipos de lo que vive en la base
// ---------------------------------------------------------------------------

export interface SesionFila {
  id: string;
  room_id: string;
  started_at: string;
  ended_at: string | null;
  modo: Modo;
  modo_cambiado_at: string | null;
  anfitrion_entro_at: string | null;
  cierre_at: string | null;
  cerrada_por: string | null;
  reconciliado_at: string | null;
  estado_version: number;
  recording_status: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AjustesSala {
  turno_max_segundos: number;
  presupuesto_total_segundos: number;
  duracion_max_minutos: number;
  allow_screen_share: boolean;
}

export interface SalaFila {
  id: string;
  slug: string;
  livekit_room_name: string | null;
  event_id: string | null;
  created_by: string | null;
  max_participants: number | null;
  ajustes: AjustesSala;
  evento: { host_id: string | null; start_time: string | null; duration_minutes: number | null; modo_sala: Modo | null } | null;
  /** Quien manda en ESTA sala: el anfitrion del evento, o quien la creo si no hay evento. */
  anfitrion_id: string | null;
}

export interface TurnoFila {
  id: string;
  session_id: string;
  identity: string;
  concedido_por: string | null;
  concedido_at: string;
  vence_at: string;
  terminado_at: string | null;
  motivo_fin: string | null;
  bonus_segundos: number;
}

export interface SalaCargada {
  sesion: SesionFila;
  sala: SalaFila;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function ajustesDe(settings: Record<string, unknown> | null | undefined): AjustesSala {
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);
  return {
    turno_max_segundos: n(settings?.turno_max_segundos, TURNO_MAX_SEGUNDOS_DEFAULT),
    presupuesto_total_segundos: n(settings?.presupuesto_total_segundos, PRESUPUESTO_TOTAL_SEGUNDOS_DEFAULT),
    allow_screen_share: settings?.allow_screen_share !== false,
    duracion_max_minutos: n(settings?.max_duration_minutes, DURACION_MAX_MINUTOS_DEFAULT),
  };
}

export async function cargarSalaPorId(roomId: string): Promise<SalaFila | null> {
  const { data } = await db()
    .from('video_rooms')
    .select('id, slug, livekit_room_name, event_id, created_by, max_participants, room_settings:video_room_settings(*), evento:event_id(host_id, start_time, duration_minutes, modo_sala)')
    .eq('id', roomId)
    .maybeSingle();
  if (!data) return null;
  const settings = Array.isArray(data.room_settings) ? data.room_settings[0] ?? null : data.room_settings;
  const evento = (Array.isArray(data.evento) ? data.evento[0] ?? null : data.evento) as SalaFila['evento'];
  return {
    id: data.id,
    slug: data.slug,
    livekit_room_name: data.livekit_room_name,
    event_id: data.event_id,
    created_by: data.created_by,
    max_participants: typeof data.max_participants === 'number' ? data.max_participants : null,
    ajustes: ajustesDe(settings as Record<string, unknown> | null),
    evento,
    anfitrion_id: evento?.host_id ?? data.created_by ?? null,
  };
}

export async function cargarSesion(sessionId: string): Promise<SalaCargada | null> {
  const { data: sesion } = await db()
    .from('video_sessions')
    .select('id, room_id, started_at, ended_at, modo, modo_cambiado_at, anfitrion_entro_at, cierre_at, cerrada_por, reconciliado_at, estado_version, recording_status, metadata')
    .eq('id', sessionId)
    .maybeSingle();
  if (!sesion) return null;
  const sala = await cargarSalaPorId(sesion.room_id);
  if (!sala) return null;
  return { sesion: sesion as SesionFila, sala };
}

export async function sesionAbiertaDe(roomId: string): Promise<SesionFila | null> {
  const { data } = await db()
    .from('video_sessions')
    .select('id, room_id, started_at, ended_at, modo, modo_cambiado_at, anfitrion_entro_at, cierre_at, cerrada_por, reconciliado_at, estado_version, recording_status, metadata')
    .eq('room_id', roomId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SesionFila | null) ?? null;
}

export function nombreSala(sala: SalaFila): string {
  return sala.livekit_room_name || `room_${sala.slug}`;
}

// ---------------------------------------------------------------------------
// Roles y permisos
// ---------------------------------------------------------------------------

export function rolEnSala(userId: string, role: string | null | undefined, sala: Pick<SalaFila, 'anfitrion_id'>): RolSala {
  if (sala.anfitrion_id && sala.anfitrion_id === userId) return 'anfitrion';
  if (role && ROLES_STAFF.has(role)) return 'moderador';
  return 'miembro';
}

export function gobierna(rol: RolSala): boolean {
  return rol === 'anfitrion' || rol === 'moderador';
}

/** Permiso COMPLETO para updateParticipant: un Partial deja en false lo que no se manda. */
export function permisoLiveKit(fuentes: TrackSource[]): Partial<ParticipantPermission> {
  return {
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canPublishSources: fuentes,
    hidden: false,
    recorder: false,
    canUpdateMetadata: false,
  };
}

function rolDeParticipante(p: ParticipantInfo, sala: Pick<SalaFila, 'anfitrion_id'>): RolSala {
  let role: string | undefined;
  try { role = p.metadata ? (JSON.parse(p.metadata) as { role?: string }).role : undefined; } catch { role = undefined; }
  return rolEnSala(usuarioDeIdentity(p.identity), role, sala);
}

/** Solo personas y participantes sinteticos de prueba: nunca el egress ni los agentes. */
function esParticipanteGobernable(p: ParticipantInfo): boolean {
  // ParticipantInfo_Kind: 0 STANDARD · 1 INGRESS · 2 EGRESS · 3 SIP · 4 AGENT
  return Number(p.kind ?? 0) === 0 && !!p.identity;
}

function mismasFuentes(a: TrackSource[] | undefined, b: TrackSource[]): boolean {
  const x = [...(a ?? [])].map(Number).sort().join(',');
  const y = [...b].map(Number).sort().join(',');
  return x === y;
}

// ---------------------------------------------------------------------------
// Turnos (el arbitro)
// ---------------------------------------------------------------------------

export async function turnosActivos(sessionId: string): Promise<TurnoFila[]> {
  const { data } = await db()
    .from('video_turnos')
    .select('*')
    .eq('session_id', sessionId)
    .is('terminado_at', null)
    .order('concedido_at', { ascending: true });
  return (data as TurnoFila[] | null) ?? [];
}

async function turnosDe(sessionId: string, identity: string): Promise<TurnoFila[]> {
  const { data } = await db()
    .from('video_turnos')
    .select('*')
    .eq('session_id', sessionId)
    .eq('identity', identity);
  return (data as TurnoFila[] | null) ?? [];
}

function segundosUsados(turnos: TurnoFila[], ahora = Date.now()): number {
  return turnos.reduce((acc, t) => {
    // Un turno nunca cuenta mas alla de su vencimiento: el arbitro lo cierra unos
    // segundos DESPUES (corre con el siguiente latido) y eso no es tiempo hablado.
    const fin = Math.min(t.terminado_at ? Date.parse(t.terminado_at) : ahora, Date.parse(t.vence_at));
    return acc + Math.max(0, Math.round((fin - Date.parse(t.concedido_at)) / 1000));
  }, 0);
}

function mmss(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Un turno de menos de esto no vale la pena: se considera presupuesto agotado. */
const TURNO_MINIMO_SEGUNDOS = 5;

/** Segundos de palabra que le quedan a alguien en toda la clase. */
export async function presupuestoRestante(sessionId: string, identity: string, ajustes: AjustesSala): Promise<number> {
  const turnos = await turnosDe(sessionId, identity);
  const bonus = turnos.reduce((a, t) => a + (t.bonus_segundos || 0), 0);
  return Math.max(0, ajustes.presupuesto_total_segundos + bonus - segundosUsados(turnos));
}

async function subirVersion(sessionId: string, extra: Record<string, unknown> = {}): Promise<void> {
  const { data } = await db().from('video_sessions').select('estado_version').eq('id', sessionId).maybeSingle();
  await db()
    .from('video_sessions')
    .update({ estado_version: ((data?.estado_version as number | undefined) ?? 0) + 1, ...extra })
    .eq('id', sessionId);
}

/** Bitacora de la sala en la misma tabla que la telemetria del cliente (la lee la SQL de la sala). */
export async function registrarEvento(sessionId: string, actorId: string | null, event: string, detail: Record<string, unknown> = {}): Promise<void> {
  if (!actorId || !UUID_RE.test(actorId)) return; // la tabla exige un perfil real como autor
  const { error } = await db().from('video_audio_events').insert({
    session_id: sessionId,
    user_id: actorId,
    event,
    detail: { ...detail, origen: 'servidor' },
    client_ts: new Date().toISOString(),
  });
  if (error) console.error('[sala] no pude registrar', event, error.message);
}

// ---------------------------------------------------------------------------
// Aplicar permisos en LiveKit (idempotente)
// ---------------------------------------------------------------------------

export async function aplicarPermisos(cargada: SalaCargada): Promise<{ actualizados: string[]; revisados: number }> {
  const { sesion, sala } = cargada;
  const room = nombreSala(sala);
  const cliente = sfu();
  let participantes: ParticipantInfo[];
  try {
    participantes = await cliente.listParticipants(room);
  } catch {
    return { actualizados: [], revisados: 0 }; // sala sin gente en el SFU
  }
  const activos = new Set((await turnosActivos(sesion.id)).map((t) => t.identity));
  const actualizados: string[] = [];
  await Promise.all(participantes.filter(esParticipanteGobernable).map(async (p) => {
    const rol = rolDeParticipante(p, sala);
    const fuentes = fuentesPermitidas(rol, sesion.modo, activos.has(p.identity), sala.ajustes.allow_screen_share);
    if (mismasFuentes(p.permission?.canPublishSources, fuentes) && p.permission?.canPublish) return;
    try {
      await cliente.updateParticipant(room, p.identity, undefined, permisoLiveKit(fuentes));
      actualizados.push(p.identity);
    } catch (err) {
      console.error('[sala] updateParticipant fallo para', p.identity, err);
    }
  }));
  return { actualizados, revisados: participantes.length };
}

async function silenciarMicrofono(room: string, p: ParticipantInfo): Promise<boolean> {
  const cliente = sfu();
  const mics = (p.tracks ?? []).filter((t) => t.type === TrackType.AUDIO && t.source === TrackSource.MICROPHONE && !t.muted);
  const r = await Promise.allSettled(mics.map((t) => cliente.mutePublishedTrack(room, p.identity, t.sid, true)));
  return r.some((x) => x.status === 'fulfilled');
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

export async function cambiarModo(sessionId: string, modo: Modo, actorId: string | null, motivo: string): Promise<SalaCargada> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada) throw new Error('Sesion no encontrada');
  if (cargada.sesion.ended_at) throw new Error('La clase ya termino');
  if (cargada.sesion.modo !== modo) {
    await persistRecordingMode(sessionId, modo);
    cargada.sesion.modo = modo;
    await registrarEvento(sessionId, actorId ?? cargada.sala.anfitrion_id, 'modo_cambiado', { modo, motivo });
  }
  await aplicarPermisos(cargada);
  return cargada;
}

/** Entrada inicial: respeta el evento; si no hay modo, usa el cupo de la sala. */
export async function anfitrionEntro(sessionId: string, anfitrionId: string): Promise<{ cambio: boolean; modo: Modo; origen: 'evento' | 'default' | null }> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada || cargada.sesion.ended_at) return { cambio: false, modo: cargada?.sesion.modo ?? 'clase', origen: null };
  if (cargada.sesion.anfitrion_entro_at) return { cambio: false, modo: cargada.sesion.modo, origen: null };
  await subirVersion(sessionId, { anfitrion_entro_at: new Date().toISOString() });
  const { modo, origen } = modoAlEntrar(cargada.sala);
  await registrarEvento(sessionId, anfitrionId, 'anfitrion_entro', { modo, origen });
  if (cargada.sesion.modo !== modo) {
    await cambiarModo(sessionId, modo, anfitrionId, origen === 'evento' ? 'evento' : 'anfitrion_entro');
  } else {
    await aplicarPermisos(cargada);
  }
  return { cambio: true, modo, origen };
}

export async function concederTurno(sessionId: string, identity: string, actorId: string | null, extraSegundos = 0): Promise<TurnoFila> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada) throw new Error('Sesion no encontrada');
  if (cargada.sesion.ended_at) throw new Error('La clase ya termino');
  const { ajustes } = cargada.sala;
  // Un turno a la vez por persona
  const yaTiene = (await turnosActivos(sessionId)).find((t) => t.identity === identity);
  if (yaTiene) return yaTiene;
  const restante = (await presupuestoRestante(sessionId, identity, ajustes)) + extraSegundos;
  if (restante < TURNO_MINIMO_SEGUNDOS) throw new Error(`Ya usó su tiempo de palabra en esta clase (${mmss(ajustes.presupuesto_total_segundos)}).`);
  const duracion = Math.min(ajustes.turno_max_segundos, restante);
  const ahora = new Date();
  const { data, error } = await db()
    .from('video_turnos')
    .insert({
      session_id: sessionId,
      identity,
      concedido_por: actorId,
      concedido_at: ahora.toISOString(),
      vence_at: new Date(ahora.getTime() + duracion * 1000).toISOString(),
      bonus_segundos: extraSegundos,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'No pude conceder el turno');
  // La mano baja sola al recibir la palabra
  const persona = usuarioDeIdentity(identity);
  if (UUID_RE.test(persona)) {
    await db()
      .from('video_hand_raises')
      .update({ acknowledged_at: ahora.toISOString(), was_addressed: true, lowered_at: ahora.toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', persona)
      .is('lowered_at', null);
  }
  await subirVersion(sessionId);
  await aplicarPermisos(cargada);
  await registrarEvento(sessionId, actorId ?? cargada.sala.anfitrion_id, 'turno_concedido', { identity, segundos: duracion, restante });
  return data as TurnoFila;
}

export async function terminarTurno(sessionId: string, identity: string, motivo: string, actorId: string | null): Promise<boolean> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada) return false;
  const activos = (await turnosActivos(sessionId)).filter((t) => t.identity === identity);
  if (activos.length === 0) return false;
  const ahora = new Date().toISOString();
  await db()
    .from('video_turnos')
    .update({ terminado_at: ahora, motivo_fin: motivo })
    .in('id', activos.map((t) => t.id));
  await subirVersion(sessionId);
  // Primero el candado (permiso), luego el silencio inmediato por si el cliente tarda
  await aplicarPermisos(cargada);
  try {
    const p = await sfu().getParticipant(nombreSala(cargada.sala), identity);
    if (p) await silenciarMicrofono(nombreSala(cargada.sala), p);
  } catch { /* ya no esta en la sala */ }
  await registrarEvento(sessionId, actorId ?? cargada.sala.anfitrion_id, motivo === 'vencido' ? 'presupuesto_agotado' : 'turno_quitado', { identity, motivo });
  return true;
}

export async function regalarTiempo(sessionId: string, identity: string, segundos: number, actorId: string | null): Promise<TurnoFila> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada) throw new Error('Sesion no encontrada');
  const activo = (await turnosActivos(sessionId)).find((t) => t.identity === identity);
  if (!activo) return concederTurno(sessionId, identity, actorId, segundos);
  const nuevoVence = new Date(Math.max(Date.now(), Date.parse(activo.vence_at)) + segundos * 1000).toISOString();
  const { data } = await db()
    .from('video_turnos')
    .update({ vence_at: nuevoVence, bonus_segundos: (activo.bonus_segundos || 0) + segundos })
    .eq('id', activo.id)
    .select('*')
    .single();
  await subirVersion(sessionId);
  await registrarEvento(sessionId, actorId ?? cargada.sala.anfitrion_id, 'tiempo_regalado', { identity, segundos });
  return data as TurnoFila;
}

/**
 * "Silenciar a todos": los turnos terminan y todos los micros de miembros se cierran.
 * NO cambia el modo (8 sep 2026): en Libre es "callense un momento" y cada quien
 * puede volver a abrir; en Clase el candado ya esta puesto. Para que no puedan
 * volver a abrir, el anfitrion pone Clase (el boton de junto).
 */
export async function silenciarTodos(sessionId: string, actorId: string | null): Promise<{ silenciados: string[]; modo: Modo }> {
  // La foto ANTES de tocar nada: a quien se le cierra el micro. Al terminar los
  // turnos en Clase el permiso se revoca y el SFU despublica los micros solo; si
  // se contara despues, el aviso diria "nadie tenia el microfono abierto" (medido 5 sep).
  const previa = await cargarSesion(sessionId);
  if (!previa) throw new Error('Sesion no encontrada');
  const abiertosAntes = new Set<string>();
  try {
    for (const p of (await sfu().listParticipants(nombreSala(previa.sala))).filter(esParticipanteGobernable)) {
      if (gobierna(rolDeParticipante(p, previa.sala))) continue;
      if ((p.tracks ?? []).some((t) => t.type === TrackType.AUDIO && t.source === TrackSource.MICROPHONE && !t.muted)) abiertosAntes.add(p.identity);
    }
  } catch { /* sala vacia en el SFU */ }
  const cargada = previa;
  const activos = await turnosActivos(sessionId);
  if (activos.length > 0) {
    await db()
      .from('video_turnos')
      .update({ terminado_at: new Date().toISOString(), motivo_fin: 'silenciar_todos' })
      .in('id', activos.map((t) => t.id));
    await aplicarPermisos(cargada);
  }
  const room = nombreSala(cargada.sala);
  let participantes: ParticipantInfo[] = [];
  try { participantes = await sfu().listParticipants(room); } catch { participantes = []; }
  const silenciados = new Set<string>(abiertosAntes);
  await Promise.all(participantes.filter(esParticipanteGobernable).map(async (p) => {
    if (gobierna(rolDeParticipante(p, cargada.sala))) return;
    if (await silenciarMicrofono(room, p)) silenciados.add(p.identity);
  }));
  await subirVersion(sessionId);
  await registrarEvento(sessionId, actorId ?? cargada.sala.anfitrion_id, 'silenciar_todos', { silenciados: silenciados.size, revisados: participantes.length, modo: cargada.sesion.modo });
  return { silenciados: [...silenciados], modo: cargada.sesion.modo };
}

/** Silenciar SOLO el microfono de una persona (y si tenia turno, se lo quita). */
export async function silenciarUno(sessionId: string, identity: string, actorId: string | null): Promise<boolean> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada) throw new Error('Sesion no encontrada');
  const room = nombreSala(cargada.sala);
  const tenia = await terminarTurno(sessionId, identity, 'silenciado', actorId);
  let ok = false;
  try {
    const p = await sfu().getParticipant(room, identity);
    ok = await silenciarMicrofono(room, p);
  } catch { ok = false; }
  await registrarEvento(sessionId, actorId ?? cargada.sala.anfitrion_id, 'silenciar_uno', { identity, tenia_turno: tenia, silenciado: ok });
  return ok || tenia;
}

export async function expulsar(sessionId: string, identity: string, actorId: string | null): Promise<void> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada) throw new Error('Sesion no encontrada');
  await terminarTurno(sessionId, identity, 'expulsado', actorId);
  await sfu().removeParticipant(nombreSala(cargada.sala), identity);
  await registrarEvento(sessionId, actorId ?? cargada.sala.anfitrion_id, 'expulsado', { identity });
}

// ---------------------------------------------------------------------------
// Apertura y cierre de la sesion
// ---------------------------------------------------------------------------

/** A que hora se apaga sola: desde la hora programada del evento (o desde ahora si no hay evento). */
export function calcularCierre(sala: SalaFila, ahora = new Date()): Date {
  const duracionMs = sala.ajustes.duracion_max_minutos * 60_000;
  // Sin evento (sala ad hoc o de prueba): el reloj corre desde que se abre.
  if (!sala.evento?.start_time) return new Date(ahora.getTime() + duracionMs);
  // Con evento: desde la HORA PROGRAMADA (⚑ B del spec). Si la sala se reabre
  // muy tarde, se dan al menos 15 min para no cerrarla en la cara de nadie.
  const cierre = new Date(new Date(sala.evento.start_time).getTime() + duracionMs);
  const minimo = new Date(ahora.getTime() + 15 * 60_000);
  return cierre.getTime() < minimo.getTime() ? minimo : cierre;
}

/** Puede abrirse la sala ahora? Sin evento: siempre. Con evento: desde 20 min antes hasta el cierre. */
export function ventanaAbierta(sala: SalaFila, ahora = new Date()): { abierta: boolean; abreEn: Date | null; motivo?: string } {
  if (!sala.evento?.start_time) return { abierta: true, abreEn: null };
  const inicio = new Date(sala.evento.start_time);
  const abre = new Date(inicio.getTime() - MINUTOS_ANTES_PARA_ABRIR * 60_000);
  const cierre = new Date(inicio.getTime() + sala.ajustes.duracion_max_minutos * 60_000);
  if (ahora < abre) return { abierta: false, abreEn: abre, motivo: `La sala abre ${MINUTOS_ANTES_PARA_ABRIR} minutos antes de la clase.` };
  if (ahora > cierre) return { abierta: false, abreEn: null, motivo: 'Esta clase ya termino.' };
  return { abierta: true, abreEn: null };
}

export async function abrirSesion(sala: SalaFila, actorId: string | null): Promise<SesionFila> {
  const existente = await sesionAbiertaDe(sala.id);
  if (existente) return existente;
  const ahora = new Date();
  const modoInicial: Modo = 'abierta';
  const { data, error } = await db()
    .from('video_sessions')
    .insert({
      room_id: sala.id,
      modo: modoInicial,
      cierre_at: calcularCierre(sala, ahora).toISOString(),
      metadata: { ...(sala.evento ? {} : { sin_evento: true }), recording_modes: appendRecordingMode(null, modoInicial, ahora.getTime()) },
    })
    .select('id, room_id, started_at, ended_at, modo, modo_cambiado_at, anfitrion_entro_at, cierre_at, cerrada_por, reconciliado_at, estado_version, recording_status, metadata')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'No pude abrir la sesion');
  await db().from('video_rooms').update({ status: 'active' }).eq('id', sala.id);
  await registrarEvento(data.id, actorId ?? sala.anfitrion_id, 'sala_abierta', { cierre_at: data.cierre_at });
  return data as SesionFila;
}

export async function cerrarSesion(sessionId: string, motivo: 'anfitrion' | 'reloj' | 'sfu', actorId: string | null): Promise<void> {
  const cargada = await cargarSesion(sessionId);
  if (!cargada || cargada.sesion.ended_at) return;
  const { sesion, sala } = cargada;
  const room = nombreSala(sala);
  const ahora = new Date().toISOString();

  // 1) La grabacion se detiene antes de tirar la sala (mejor esfuerzo: el egress puede no estar)
  if (sesion.recording_status === 'recording') {
    try { await stopRecording({ sessionId, roomName: room }); } catch (err) { console.error('[sala] stop recording al cerrar:', err); }
  }

  // 2) Turnos abiertos terminan; filas de asistencia abiertas se cierran a esta hora (es un hecho)
  await db().from('video_turnos').update({ terminado_at: ahora, motivo_fin: 'sala_cerrada' }).eq('session_id', sessionId).is('terminado_at', null);
  await db()
    .from('video_participants')
    .update({ left_at: ahora, nota_calidad: motivo === 'reloj' ? 'cerrado por el reloj de la clase' : 'cerrado al finalizar la sesion el anfitrion' })
    .eq('session_id', sessionId)
    .is('left_at', null);
  const { data: filas } = await db().from('video_participants').select('user_id').eq('session_id', sessionId);
  const unicos = new Set((filas ?? []).map((f: { user_id: string }) => f.user_id)).size;

  await db()
    .from('video_sessions')
    .update({ ended_at: ahora, cerrada_por: motivo, total_unique_participants: unicos, estado_version: (sesion.estado_version ?? 0) + 1 })
    .eq('id', sessionId);
  await db().from('video_rooms').update({ status: 'idle' }).eq('id', sala.id);

  // 3) La sala en el SFU se borra: todos salen. Si no existe, no pasa nada.
  try { await sfu().deleteRoom(room); } catch { /* no habia sala viva en el SFU */ }

  try { await awardSessionPoints(sessionId, db()); } catch (err) { console.error('[sala] puntos al cerrar:', err); }
  await registrarEvento(sessionId, actorId ?? sala.anfitrion_id, motivo === 'reloj' ? 'sala_cerrada_por_tiempo' : 'sala_cerrada', { motivo, personas: unicos });
}

// ---------------------------------------------------------------------------
// El arbitro: lo dispara cualquier cliente que pida el estado
// ---------------------------------------------------------------------------

export async function reconciliar(cargada: SalaCargada, opciones: { forzarSFU?: boolean } = {}): Promise<SalaCargada> {
  const { sesion, sala } = cargada;
  if (sesion.ended_at) return cargada;
  const ahora = Date.now();

  // 1) Cierre por reloj
  if (sesion.cierre_at && ahora >= Date.parse(sesion.cierre_at)) {
    await cerrarSesion(sesion.id, 'reloj', null);
    return (await cargarSesion(sesion.id)) ?? cargada;
  }

  // 2) Turnos vencidos
  const vencidos = (await turnosActivos(sesion.id)).filter((t) => Date.parse(t.vence_at) <= ahora);
  for (const t of vencidos) {
    await terminarTurno(sesion.id, t.identity, 'vencido', null);
  }

  // 3) Anfitrion presente sin que su cliente lo haya avisado (throttle al SFU)
  const hace = sesion.reconciliado_at ? ahora - Date.parse(sesion.reconciliado_at) : Infinity;
  const tocaSFU = opciones.forzarSFU || hace >= RECONCILIAR_CADA_MS;
  if (tocaSFU) {
    await db().from('video_sessions').update({ reconciliado_at: new Date(ahora).toISOString() }).eq('id', sesion.id);
    if (sesion.modo === 'abierta' && !sesion.anfitrion_entro_at && sala.anfitrion_id) {
      try {
        const gente = await sfu().listParticipants(nombreSala(sala));
        if (gente.some((p) => usuarioDeIdentity(p.identity) === sala.anfitrion_id)) {
          await anfitrionEntro(sesion.id, sala.anfitrion_id);
        }
      } catch { /* sala vacia en el SFU */ }
    }
  }
  return (vencidos.length > 0 || tocaSFU) ? ((await cargarSesion(sesion.id)) ?? cargada) : cargada;
}

// ---------------------------------------------------------------------------
// El estado que ve el cliente
// ---------------------------------------------------------------------------

export interface EstadoSala {
  orador_identity?: string | null;
  foco_identity?: string | null;
  /** The class moved to another link (host's button). null = it stays here. */
  mudanza?: Mudanza | null;
  sesion: {
    id: string;
    modo: Modo;
    started_at: string;
    ended_at: string | null;
    cierre_at: string | null;
    cerrada_por: string | null;
    anfitrion_entro_at: string | null;
    recording_status: string | null;
    estado_version: number;
  };
  ajustes: AjustesSala;
  anfitrion_id: string | null;
  /** Lo que el EVENTO dice del modo (null = el anfitrion decide al entrar). */
  modo_evento: Modo | null;
  mi_rol: RolSala;
  mi_turno: { vence_at: string; concedido_at: string } | null;
  mi_presupuesto_restante: number;
  turnos_activos: { identity: string; concedido_at: string; vence_at: string }[];
  presupuestos: Record<string, number>;
  servidor_ahora: string;
}

export async function estadoParaCliente(cargada: SalaCargada, userId: string, role: string | null | undefined, identidades: string[] = [], miIdentityPedida: string | null = null): Promise<EstadoSala> {
  const { sesion, sala } = cargada;
  // La conexión que pregunta: solo se acepta una identity de la MISMA persona.
  const miIdentity = miIdentityPedida && usuarioDeIdentity(miIdentityPedida) === userId ? miIdentityPedida : userId;
  const activos = await turnosActivos(sesion.id);
  const mio = activos.find((t) => t.identity === miIdentity) ?? null;
  const presupuestos: Record<string, number> = {};
  const ids = Array.from(new Set([miIdentity, ...identidades])).slice(0, 80);
  await Promise.all(ids.map(async (id) => { presupuestos[id] = await presupuestoRestante(sesion.id, id, sala.ajustes); }));
  return {
    foco_identity: readRoomFocus(sesion.metadata),
    orador_identity: readRoomSpeaker(sesion.metadata),
    mudanza: readMudanza(sesion.metadata),
    sesion: {
      id: sesion.id,
      modo: sesion.modo,
      started_at: sesion.started_at,
      ended_at: sesion.ended_at,
      cierre_at: sesion.cierre_at,
      cerrada_por: sesion.cerrada_por,
      anfitrion_entro_at: sesion.anfitrion_entro_at,
      recording_status: sesion.recording_status,
      estado_version: sesion.estado_version,
    },
    ajustes: sala.ajustes,
    anfitrion_id: sala.anfitrion_id,
    modo_evento: sala.evento?.modo_sala === 'abierta' || sala.evento?.modo_sala === 'clase' ? sala.evento.modo_sala : null,
    mi_rol: rolEnSala(userId, role, sala),
    mi_turno: mio ? { vence_at: mio.vence_at, concedido_at: mio.concedido_at } : null,
    mi_presupuesto_restante: presupuestos[miIdentity] ?? sala.ajustes.presupuesto_total_segundos,
    turnos_activos: activos.map((t) => ({ identity: t.identity, concedido_at: t.concedido_at, vence_at: t.vence_at })),
    presupuestos,
    servidor_ahora: new Date().toISOString(),
  };
}
