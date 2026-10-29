import type { Modo } from './salaPolicy';

export type RecordingModeHistory = {
  version: 1;
  changes: { at: string; mode: Modo }[];
};

/** This history is saved atomically with the room mode, never from client telemetry. */
export function readRecordingModes(value: unknown): RecordingModeHistory | null {
  if (!value || typeof value !== 'object') return null;
  const history = value as Partial<RecordingModeHistory>;
  if (history.version !== 1 || !Array.isArray(history.changes) || !history.changes.length) return null;
  let previous = -Infinity;
  for (const change of history.changes) {
    if (!change || !['clase', 'abierta'].includes(change.mode)) return null;
    const at = Date.parse(change.at);
    if (!Number.isFinite(at) || at <= previous) return null;
    previous = at;
  }
  return history as RecordingModeHistory;
}

export function appendRecordingMode(value: unknown, mode: Modo, now = Date.now()): RecordingModeHistory {
  const history = readRecordingModes(value);
  const last = history?.changes.at(-1);
  if (last?.mode === mode) return history!;
  // Preserve strict ordering even if two requests happen in one millisecond.
  const at = new Date(Math.max(now, last ? Date.parse(last.at) + 1 : now)).toISOString();
  return { version: 1, changes: [...(history?.changes ?? []), { at, mode }] };
}
