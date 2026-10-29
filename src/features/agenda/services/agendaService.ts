import { supabase } from '@/shared/lib/supabase';
import type { Clase } from '../types';

const SELECT = `
  id, title, description, start_time, duration_minutes, timezone, status,
  is_exception, cover_image_url, google_meet_link, required_level,
  visible_to_tier, series_id, recording_url,
  serie:event_series!events_series_id_fkey ( id, title, rrule, status ),
  anfitrion:profiles!events_host_id_fkey ( id, full_name, avatar_url )
`;

type Fila = Record<string, unknown>;

function aClase(f: Fila): Clase {
  const serie = Array.isArray(f.serie) ? f.serie[0] : f.serie;
  const anfitrion = Array.isArray(f.anfitrion) ? f.anfitrion[0] : f.anfitrion;
  return {
    ...(f as unknown as Clase),
    serie: (serie ?? null) as Clase['serie'],
    anfitrion: (anfitrion ?? null) as Clase['anfitrion'],
    grabacion_url: (f.recording_url as string) || null,
  };
}

/**
 * LAS SALAS VIVAS: sesiones de la plataforma propia con `ended_at IS NULL`,
 * por evento. Acotado a 12 h para que una sesion zombi de un crash viejo no
 * resucite una clase de hace meses. Es el sensor que manda sobre el reloj.
 */
export type SalaViva = { session_id: string; started_at: string };

export async function traerSalasVivas(): Promise<Map<string, SalaViva>> {
  const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data, error } = await supabase
    .from('video_sessions')
    .select('id, started_at, room:video_rooms!inner(event_id)')
    .is('ended_at', null)
    .gte('started_at', desde);
  if (error) throw error;
  const m = new Map<string, SalaViva>();
  for (const s of (data ?? []) as unknown as { id: string; started_at: string; room: { event_id: string | null } | { event_id: string | null }[] }[]) {
    const room = Array.isArray(s.room) ? s.room[0] : s.room;
    if (room?.event_id) m.set(room.event_id, { session_id: s.id, started_at: s.started_at });
  }
  return m;
}

/** Pega a cada clase su sala viva (o null). Puro, para reusarlo en el refresco periodico. */
export function conSalasVivas(clases: Clase[], vivas: Map<string, SalaViva>): Clase[] {
  return clases.map((c) => ({ ...c, sala_viva: vivas.get(c.id) ?? null }));
}

/**
 * La agenda: lo que viene. Trae una cola de pasado reciente para que un evento
 * en curso o recien terminado no desaparezca de la pantalla.
 */
export async function traerAgenda(opts: {
  desde?: Date;
  dias?: number;
  tier?: string | null;
}): Promise<Clase[]> {
  const desde = opts.desde ?? new Date(Date.now() - 4 * 3600_000);
  const hasta = new Date(desde.getTime() + (opts.dias ?? 60) * 864e5);

  let q = supabase
    .from('events')
    .select(SELECT)
    .gte('start_time', desde.toISOString())
    .lte('start_time', hasta.toISOString())
    .order('start_time', { ascending: true });

  // los standard no ven los eventos VIP
  if (opts.tier === 'standard') q = q.eq('visible_to_tier', 'standard');

  const { data, error } = await q;
  if (error) throw error;
  const clases = (data ?? []).map(aClase);
  // si falla la lectura de salas vivas, la agenda sigue (con el reloj solo)
  const vivas = await traerSalasVivas().catch(() => new Map<string, SalaViva>());
  return conSalasVivas(clases, vivas);
}

/** Las clases ya dadas, para la pestaña de grabaciones. */
export async function traerPasadas(limite = 20, tier?: string | null): Promise<Clase[]> {
  let q = supabase
    .from('events')
    .select(SELECT)
    .lt('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })
    .limit(limite);
  if (tier === 'standard') q = q.eq('visible_to_tier', 'standard');
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(aClase);
}

export async function traerClase(id: string): Promise<Clase | null> {
  const { data, error } = await supabase.from('events').select(SELECT).eq('id', id).single();
  if (error) return null;
  const vivas = await traerSalasVivas().catch(() => new Map<string, SalaViva>());
  return conSalasVivas([aClase(data as Fila)], vivas)[0];
}

/** Los ids de las clases para las que el miembro pidio aviso. */
export async function misRecordatorios(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('event_reminders')
    .select('event_id')
    .eq('user_id', userId)
    .is('sent_at', null);
  return new Set((data ?? []).map((r) => r.event_id as string));
}

/** Pedir/quitar aviso. Devuelve el estado nuevo. */
export async function alternarRecordatorio(
  eventId: string,
  userId: string,
  activar: boolean,
  leadMinutes = 15
): Promise<boolean> {
  if (activar) {
    const { error } = await supabase
      .from('event_reminders')
      .upsert({ event_id: eventId, user_id: userId, lead_minutes: leadMinutes },
              { onConflict: 'event_id,user_id,lead_minutes' });
    if (error) throw error;
    return true;
  }
  const { error } = await supabase
    .from('event_reminders')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('lead_minutes', leadMinutes);
  if (error) throw error;
  return false;
}

/** Guarda la zona del miembro. Se llama una vez, al detectarla. */
export async function guardarZona(userId: string, zona: string): Promise<void> {
  await supabase.from('profiles').update({ timezone: zona }).eq('id', userId);
}
