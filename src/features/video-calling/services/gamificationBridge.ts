import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** El servidor calcula asistencia y entrega +5 una vez por persona/clase.
 * La RPC actualiza saldo, nivel e historial en la misma transacción.
 * Nunca acepta minutos ni puntos declarados por el navegador. */
export async function awardSessionPoints(sessionId: string, db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc('award_video_session_attendance', { p_session_id: sessionId });
  if (error) throw new Error(`No se pudieron acreditar los puntos de la clase: ${error.message}`);
  return typeof data === 'number' ? data : 0;
}
