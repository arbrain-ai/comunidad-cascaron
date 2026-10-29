'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh custom para touch (Goal 3 "Community world-class").
 *
 * Contexto: globals.css pone overscroll-behavior-y:none en el body (necesario
 * para el bug de Chromium y el feel PWA), lo que mata el pull-to-refresh
 * NATIVO del navegador — y el nativo además haría full reload (peor). Este
 * hook implementa el gesto por touch events y llama onRefresh() (refetch
 * silencioso), sin recarga de página.
 *
 * Diseño:
 * - Solo escucha touch (desktop no lo necesita).
 * - Solo arma el gesto si window.scrollY === 0 al iniciar el touch.
 * - Listeners passive: JAMÁS bloquea el scroll normal (cero riesgo de jank).
 * - Umbral 80px de arrastre hacia abajo para disparar.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startYRef = useRef<number | null>(null);
  const armedRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    // Gate: solo dispositivos touch
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;

    const THRESHOLD = 80;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        startYRef.current = e.touches[0].clientY;
        armedRef.current = false;
      } else {
        startYRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || window.scrollY > 0) return;
      const dy = e.touches[0].clientY - startYRef.current;
      const armed = dy > THRESHOLD;
      if (armed !== armedRef.current) {
        armedRef.current = armed;
        setIsPulling(armed);
      }
    };

    const onTouchEnd = () => {
      const shouldRefresh = armedRef.current;
      startYRef.current = null;
      armedRef.current = false;
      setIsPulling(false);
      if (shouldRefresh) {
        setIsRefreshing(true);
        onRefreshRef.current().finally(() => setIsRefreshing(false));
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return { isRefreshing, isPulling };
}
