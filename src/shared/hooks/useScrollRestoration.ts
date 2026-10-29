// ============================================
// useScrollRestoration Hook
// ============================================
// Saves and restores scroll position for main nav routes.
// Uses sessionStorage (survives re-renders, clears on tab close).
// Only tracks top-level nav routes to avoid interference with sub-pages.

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SCROLL_KEY_PREFIX = 'scroll:';

// Only restore scroll for these exact top-level nav routes
const RESTORABLE_ROUTES = new Set([
  '/community',
  '/classroom',
  '/calendar',
  '/members',
  '/map',
  '/leaderboard',
]);

export function useScrollRestoration() {
  const pathname = usePathname();
  const scrollY = useRef(0);
  const prevPathname = useRef(pathname);

  // Track scroll position continuously (passive listener, no perf impact)
  useEffect(() => {
    const handleScroll = () => {
      scrollY.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Save previous route's position + restore new route's position on pathname change
  useEffect(() => {
    const prev = prevPathname.current;

    // Save previous route's scroll position (only for restorable routes)
    if (prev !== pathname && RESTORABLE_ROUTES.has(prev)) {
      try {
        sessionStorage.setItem(
          SCROLL_KEY_PREFIX + prev,
          String(scrollY.current)
        );
      } catch {
        // sessionStorage full or disabled — silent fail
      }
    }

    // Restore new route's scroll position
    if (RESTORABLE_ROUTES.has(pathname)) {
      const saved = sessionStorage.getItem(SCROLL_KEY_PREFIX + pathname);
      if (saved) {
        const pos = parseInt(saved, 10);
        if (pos > 0) {
          // Wait for Next.js scroll-to-top + content render, then restore
          requestAnimationFrame(() => {
            setTimeout(() => {
              window.scrollTo(0, pos);
            }, 80);
          });
        }
      }
    }

    prevPathname.current = pathname;
  }, [pathname]);
}
