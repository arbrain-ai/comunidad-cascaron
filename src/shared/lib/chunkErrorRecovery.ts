// ============================================
// chunkErrorRecovery — auto-recuperación post-deploy
// ============================================
// Los assets son POR-DEPLOYMENT: una PWA que despierta del background con la
// página de un build anterior pide chunks que ya no existen (404) y el
// envío/navegación truena.
// La cura correcta es UNA recarga dura: el HTML fresco apunta a los chunks
// del build vivo. Guard por sessionStorage: máximo un auto-reload por minuto
// (cicatriz anti-loop, mismo patrón que el reload del SW en PWARegister).

const RELOAD_GUARD_KEY = 'app-chunk-reload-at';
const RELOAD_COOLDOWN_MS = 60_000;

export function isChunkLoadError(message: string): boolean {
  return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to load chunk/i.test(
    message
  );
}

/** Recarga la página UNA vez (con cooldown) para tomar el build vivo.
 *  Devuelve true si disparó la recarga. */
export function recoverFromChunkError(source: string): boolean {
  if (typeof window === 'undefined') return false;
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
  } catch {
    /* noop */
  }
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
  console.warn(`[ChunkRecovery] Chunk de un deploy anterior no disponible (${source}) — recargando al build vivo`);
  window.location.reload();
  return true;
}
