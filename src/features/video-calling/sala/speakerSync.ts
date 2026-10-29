import type { AccionSala, ResultadoAccion } from './useSala';

export interface SpeakerSnapshot { controller: boolean; speaker: string | null; shared: string | null }

/** Serialize observation writes, not room authority. Server remains authoritative. */
export function createSpeakerSync(read: () => SpeakerSnapshot,
  action: (a: AccionSala) => Promise<ResultadoAccion>, now = Date.now) {
  let disposed = false;
  let pending = false;
  let revision = 0;
  let previous: SpeakerSnapshot | null = null;
  let blocked = false;
  let failures = 0;
  let nextAt = 0;
  const sync = async () => {
    const state = read();
    if (!previous || previous.controller !== state.controller || previous.speaker !== state.speaker) {
      revision++; blocked = false; failures = 0; nextAt = 0;
    }
    previous = state;
    if (disposed || pending || blocked || !state.controller || !state.speaker || state.speaker === state.shared || now() < nextAt) return;
    pending = true;
    const attempt = revision;
    let result: ResultadoAccion;
    try { result = await action({ accion: 'orador', identity: state.speaker }); }
    catch { result = { ok: false }; }
    finally { pending = false; }
    if (disposed || attempt !== revision) return;
    if (result.ok) {
      failures = 0;
      // Allow the server snapshot to arrive. Do not permanently suppress the
      // same identity: another controller's late write can cause divergence.
      nextAt = now() + 5000;
    } else if (result.status === 403 || result.status === 409) {
      blocked = true; // Retry only after eligibility or controller changes.
    } else {
      failures++; nextAt = now() + Math.min(60000, 1500 * 2 ** Math.min(failures, 6));
    }
  };
  return { sync, dispose: () => { disposed = true; } };
}
