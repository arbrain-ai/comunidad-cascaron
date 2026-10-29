import type { MemberProfile } from '../types';
import { summarizeMembers } from './memberSnapshot';

export function createMemberDirectoryStore(load: () => Promise<MemberProfile[]>) {
  const initial = { rows: [] as MemberProfile[], ...summarizeMembers([], 0), updatedAt: 0,
    loading: true, error: null as string | null };
  let snapshot = initial;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  const refresh = (): Promise<void> => {
    if (pending) return pending;
    pending = Promise.resolve().then(load).then(rows => {
      const updatedAt = Date.now();
      snapshot = { rows, ...summarizeMembers(rows, updatedAt), updatedAt, loading: false, error: null };
    }).catch(() => {
      // Keep the last successful directory, never replace a failed request with zero.
      snapshot = { ...snapshot, loading: false, error: 'Error al actualizar los miembros' };
    }).finally(() => { pending = null; emit(); });
    return pending;
  };
  return {
    refresh,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
