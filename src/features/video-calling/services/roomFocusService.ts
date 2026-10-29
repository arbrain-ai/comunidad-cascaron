import { createClient } from '@supabase/supabase-js';

/** Same metadata CAS contract as recordingModeService: preserve concurrent recording history.
 * Uses existing columns only. Authorization and live participant checks belong to the route.
 */
export async function persistRoomFocus(sessionId: string, identity: string | null, key: 'room_focus' | 'room_speaker' = 'room_focus'): Promise<void> {
  return persistSessionMetadata(sessionId, key, identity);
}

/** One CAS writer for every shared-room key (focus, speaker, the class move). */
export async function persistSessionMetadata(sessionId: string, key: 'room_focus' | 'room_speaker' | 'mudanza', value: unknown): Promise<void> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: session, error } = await db.from('video_sessions')
      .select('metadata, ended_at, estado_version').eq('id', sessionId).single();
    if (error || !session) throw new Error('No pudimos leer el foco de la sala');
    if (session.ended_at) throw new Error('La clase ya terminó');
    const metadata = session.metadata as Record<string, unknown> | null;
    if (JSON.stringify(metadata?.[key] ?? null) === JSON.stringify(value)) return;
    let query = db.from('video_sessions').update({
      metadata: { ...metadata, [key]: value }, estado_version: session.estado_version + 1,
    }).eq('id', sessionId).eq('estado_version', session.estado_version).is('ended_at', null);
    query = metadata === null ? query.is('metadata', null) : query.eq('metadata', JSON.stringify(metadata));
    const result = await query.select('id').maybeSingle();
    if (result.error) throw new Error('No pudimos guardar el foco de la sala');
    if (result.data) return;
  }
  throw new Error('La sala cambió mientras fijábamos el foco. Inténtalo de nuevo.');
}
