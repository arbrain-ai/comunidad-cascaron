'use client';

// ============================================
// useTabNotifier
// ============================================
// El motor del aviso en la pestaña, estilo Skool: el título ALTERNA entre el
// contador y quién generó el pendiente.
//
//   "(3) Mi Comunidad"  ->  "Ana te envio un mensaje"  ->  "(3) Mi Comunidad"  -> ...
//
// Buenas prácticas implementadas:
//   1. Un solo dueño del <title>: nadie más lo escribe mientras hay pendientes.
//   2. MutationObserver sobre <head>: cuando Next cambia el título al navegar,
//      se toma como nueva base SIN perder el badge (bug del badge que se
//      borraba al cambiar de ruta).
//   3. `prefers-reduced-motion`: sin alternancia, solo "(N) Base". El parpadeo
//      es movimiento y hay gente que lo desactiva a nivel sistema.
//   4. Restauración total en cleanup y al llegar a cero (título, favicon, badge
//      de app): nunca deja residuo.
//   5. Timers solo cuando hay pendientes; al volver a la pestaña el ciclo
//      reinicia en el contador (el frame más informativo).
//   6. Favicon con burbuja + Badging API para la PWA instalada.

import { useEffect, useRef } from 'react';
import { BRAND } from '@/shared/config/brand';
import { clearFaviconBadge, paintFaviconBadge, setAppBadge } from '../utils/faviconBadge';

/** Cadencia del parpadeo. 2.5s: se alcanza a leer sin marear. */
const CYCLE_MS = 2500;

/** Máximo de frases en el ciclo; más allá el usuario ya no lee, solo cuenta. */
const MAX_PHRASES = 3;

/** Prefijo "(12) " que este mismo hook escribe: se limpia antes de reusar la base. */
const COUNT_PREFIX_RE = /^\(\d+\+?\)\s*/;

const DEFAULT_BASE_TITLE = BRAND.name;

/** Separador no imprimible para la clave de dependencias. */
const KEY_SEPARATOR = '␟';

/** El frame del contador se representa con `null` dentro de la secuencia. */
type Frame = string | null;

interface TabNotifierInput {
  /** Total de pendientes (notificaciones + mensajes sin leer). */
  count: number;
  /** Frases ya listas, de la más reciente a la más vieja. */
  phrases: string[];
  /** Apaga el motor sin desmontar el componente (ej. usuario sin sesión). */
  enabled?: boolean;
}

function cleanBaseTitle(title: string): string {
  return title.replace(COUNT_PREFIX_RE, '').trim();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Intercala el contador entre frases: contador -> frase -> contador -> frase... */
function buildFrames(phrases: string[], animated: boolean): Frame[] {
  if (!animated || phrases.length === 0) return [null];

  return phrases.slice(0, MAX_PHRASES).flatMap((phrase): Frame[] => [null, phrase]);
}

export function useTabNotifier({ count, phrases, enabled = true }: TabNotifierInput): void {
  const baseTitleRef = useRef('');
  const lastWrittenRef = useRef('');

  // Las frases se leen por ref dentro del efecto; la key (separador no
  // imprimible) decide cuándo REINICIAR el ciclo. Así el efecto no se
  // re-dispara por la identidad del array en cada render.
  const phrasesRef = useRef<string[]>(phrases);
  phrasesRef.current = phrases;
  const phrasesKey = phrases.join(KEY_SEPARATOR);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // La base viva es lo que haya en el <title> menos nuestro prefijo.
    if (!baseTitleRef.current) {
      baseTitleRef.current = cleanBaseTitle(document.title) || DEFAULT_BASE_TITLE;
    }

    const write = (title: string) => {
      lastWrittenRef.current = title;
      document.title = title;
    };

    const restoreBase = () => write(baseTitleRef.current);

    if (!enabled || count <= 0) {
      restoreBase();
      clearFaviconBadge();
      setAppBadge(0);
      return;
    }

    const frames = buildFrames(phrasesRef.current, !prefersReducedMotion());
    const countFrame = () => `(${count > 99 ? '99+' : count}) ${baseTitleRef.current}`;

    let index = 0;
    const paint = () => write(frames[index] ?? countFrame());

    paint();
    void paintFaviconBadge(count);
    setAppBadge(count);

    // Next reescribe el <title> en cada navegación (metadata por ruta). Sin
    // esto, el badge desaparecía hasta el siguiente cambio de contador.
    const observer = new MutationObserver(() => {
      const current = document.title;
      if (!current || current === lastWrittenRef.current) return;

      const nextBase = cleanBaseTitle(current);
      if (!nextBase || nextBase === baseTitleRef.current) return;

      baseTitleRef.current = nextBase;
      paint();
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });

    const interval =
      frames.length > 1
        ? window.setInterval(() => {
            index = (index + 1) % frames.length;
            paint();
          }, CYCLE_MS)
        : null;

    // Al volver a la pestaña, arrancar en el contador (los navegadores
    // ralentizan los timers en background y el ciclo queda a medias).
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      index = 0;
      paint();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (interval !== null) window.clearInterval(interval);
      restoreBase();
    };
  }, [count, phrasesKey, enabled]);

  // Cleanup duro al desmontar (logout, cierre de sesión): sin residuo visual.
  useEffect(() => {
    return () => {
      clearFaviconBadge();
      setAppBadge(0);
    };
  }, []);
}

export default useTabNotifier;
