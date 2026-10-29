// ============================================
// useGlobo — el globo morado que sigue al cursor
// ============================================
// La misma maquinaria del spotlight del PostCard (RAF-throttled, variables
// CSS --spotlight-*), extraída para que cualquier superficie la comparta sin
// duplicar handlers. Se usa junto a la clase `.globo` de ley.css, que pinta
// SOLO la capa del globo — no toca fondo, borde ni la piel de la tarjeta,
// así convive con los estados ámbar del leaderboard.

'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useGlobo<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const raf = useRef<number | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || raf.current !== null) return; // ya hay un frame agendado
    const { clientX, clientY } = e;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--spotlight-x', `${clientX - rect.left}px`);
      node.style.setProperty('--spotlight-y', `${clientY - rect.top}px`);
    });
  }, []);

  const onMouseEnter = useCallback(() => {
    ref.current?.style.setProperty('--spotlight-opacity', '1');
  }, []);

  const onMouseLeave = useCallback(() => {
    ref.current?.style.setProperty('--spotlight-opacity', '0');
  }, []);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    []
  );

  return { ref, onMouseMove, onMouseEnter, onMouseLeave };
}
