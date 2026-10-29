import { createClient } from '@supabase/supabase-js';
import { appendRecordingMode, readRecordingModes } from './recordingModePolicy';
import type { Modo } from './salaPolicy';

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Compare-and-swap keeps concurrent hosts from overwriting a recorded transition.
 * No schema change: metadata and mode commit together in the existing session row.
 * Omitting mode initializes a snapshot BEFORE the audio recording starts.
 */
export async function persistRecordingMode(sessionId: string, requested?: Modo): Promise<Modo> {
  const db = admin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: session, error } = await db.from('video_sessions')
      .select('modo, modo_cambiado_at, metadata, ended_at, estado_version').eq('id', sessionId).single();
    if (error || !session) throw new Error(error?.message ?? 'Sesión no encontrada');
    if (session.ended_at) throw new Error('La clase ya terminó');
    const mode = requested ?? session.modo as Modo;
    const metadata = session.metadata as Record<string, unknown> | null;
    const history = readRecordingModes(metadata?.recording_modes);
    if (history?.changes.at(-1)?.mode === mode && session.modo === mode) return mode;
    const next = appendRecordingMode(history, mode);
    const changedAt = next.changes.at(-1)!.at;
    let query = db.from('video_sessions').update({
      modo: mode,
      ...(session.modo !== mode ? { modo_cambiado_at: changedAt } : {}),
      estado_version: session.estado_version + 1,
      metadata: { ...metadata, recording_modes: next },
    }).eq('id', sessionId).eq('modo', session.modo).is('ended_at', null);
    query = session.modo_cambiado_at === null
      ? query.is('modo_cambiado_at', null) : query.eq('modo_cambiado_at', session.modo_cambiado_at);
    query = metadata === null ? query.is('metadata', null) : query.eq('metadata', JSON.stringify(metadata));
    const result = await query.select('id').maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (result.data) return mode;
  }
  throw new Error('La sala cambió mientras guardábamos el modo. Inténtalo de nuevo.');
}
