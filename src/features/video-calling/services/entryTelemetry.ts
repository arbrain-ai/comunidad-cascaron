import { entryRequest } from './entryRequest';

/** Evidencia de fallo de entrada. Sin endpoint de ingesta: solo consola. */
export async function reportEntryFailure(sessionId: string | null, stage: 'token' | 'connection' | 'microphone' | 'camera', errorName: string,
  diagnostics?: { category: string; code: number | null; reason: number | null; attempt_id?: string | null }) {
  if (!sessionId) return;
  console.warn('[entry] fallo de entrada', { session_id: sessionId, stage, name: errorName.slice(0, 80), ...diagnostics });
}

export async function reportEntryStatus(attemptId: string | null | undefined, status: 'connected'|'failed'|'disconnected') {
  if (!attemptId) return;
  try { await entryRequest('/api/video-calling/entry-events',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({attempt_id:attemptId,status})},5000); } catch { /* never block entry */ }
}
