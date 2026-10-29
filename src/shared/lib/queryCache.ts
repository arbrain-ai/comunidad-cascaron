// ============================================
// queryCache — caché de datos en memoria (stale-while-revalidate)
// ============================================
// La app entera es client-side: cada página refetchea TODO al montar, así que
// navegar Comunidad → Niveles → Comunidad pagaba 3-6 roundtrips a Supabase
// (~150-300ms c/u) y pintaba skeletons cada vez. Este módulo es la memoria
// entre navegaciones: un hook sirve el último dato al instante (cero red,
// cero skeleton) y revalida en silencio por detrás.
//
// Semántica (misma que TanStack Query con staleTime 60s / gcTime 30min):
// - fresh  (< staleTime): se sirve del caché; el fetch de fondo es opcional
// - stale  (> staleTime): se sirve del caché Y se revalida en background
// - ausente: flujo normal (skeleton + fetch)
//
// Vive a nivel módulo: sobrevive a unmount/mount de páginas dentro de la
// misma pestaña. Un reload duro lo limpia (correcto: la sesión se rehidrata).

const STALE_MS = 60_000; // 1 min: igual que el staleTime default de la referencia
const GC_MS = 30 * 60_000; // 30 min: después de esto la entrada se barre

interface Entry {
  data: unknown;
  time: number;
}

const store = new Map<string, Entry>();

/** Barrido perezoso: se ejecuta al escribir, no hay timers colgando. */
function sweep() {
  if (store.size < 80) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.time > GC_MS) store.delete(key);
  }
}

export interface CachedResult<T> {
  data: T;
  /** true = ya pasó staleTime: sírvelo, pero revalida en background */
  isStale: boolean;
}

export function getCached<T>(key: string | null | undefined, staleMs: number = STALE_MS): CachedResult<T> | null {
  if (!key) return null;
  const entry = store.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.time;
  if (age > GC_MS) {
    store.delete(key);
    return null;
  }
  return { data: entry.data as T, isStale: age > staleMs };
}

export function setCached(key: string | null | undefined, data: unknown) {
  if (!key) return;
  store.set(key, { data, time: Date.now() });
  sweep();
}

/** Invalida por prefijo (mutaciones: "posts:" tras crear un post, etc.) */
export function invalidateCached(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
