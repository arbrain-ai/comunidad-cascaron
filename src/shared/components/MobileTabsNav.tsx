'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFocusModeSafe } from '@/shared/contexts/FocusModeContext';

const navItems = [
  { href: '/community', label: 'Comunidad' },
  { href: '/classroom', label: 'Cursos' },
  { href: '/calendar', label: 'Calendario' },
  { href: '/members', label: 'Miembros' },
  { href: '/map', label: 'Mapa' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

// Routes where tabs should be hidden (full-screen pages)
const HIDDEN_ROUTES = ['/notifications'];

/**
 * MobileTabsNav - Navegación horizontal con scroll para móvil (estilo Skool)
 *
 * Reemplaza el menú hamburguesa con tabs horizontales que hacen scroll
 * si no caben todos en la pantalla.
 *
 * Affordance: fades en los bordes indican que hay más tabs (sin ellos nada
 * sugiere que se puede hacer swipe). El tab activo se auto-scrollea a la
 * vista al navegar.
 *
 * Se oculta automáticamente en rutas full-screen (notificaciones).
 */
export function MobileTabsNav() {
  const pathname = usePathname();
  const { isFocusMode } = useFocusModeSafe();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Hide tabs on full-screen pages or in focus mode
  const shouldHide = HIDDEN_ROUTES.some(route => pathname.startsWith(route)) || isFocusMode;

  const updateAffordance = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    if (shouldHide) return;
    updateAffordance();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateAffordance, { passive: true });
    window.addEventListener('resize', updateAffordance);
    return () => {
      el.removeEventListener('scroll', updateAffordance);
      window.removeEventListener('resize', updateAffordance);
    };
  }, [updateAffordance, shouldHide]);

  // El tab activo entra a la vista al navegar (p.ej. deep link a /leaderboard)
  useEffect(() => {
    if (shouldHide) return;
    const active = scrollerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    updateAffordance();
  }, [pathname, shouldHide, updateAffordance]);

  if (shouldHide) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/community') {
      return pathname === '/community';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="md:hidden w-full border-b border-glass bg-background/92 backdrop-blur-xl">
      <div className="relative">
        {/* Horizontal scrollable container */}
        <div
          ref={scrollerRef}
          className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide scroll-container"
        >
          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                data-active={active || undefined}
                className={`
                  relative flex-shrink-0 px-4 py-3 text-sm font-medium
                  transition-all duration-fast whitespace-nowrap
                  ${active ? 'text-foreground' : 'text-muted hover:text-foreground'}
                `}
              >
                {item.label}

                {/* Active indicator - bottom border. Morado puro, no
                    .sf-nav-underline (globals.css mezcla var(--gold) al 50%
                    del gradiente) — LEY §1.1: navegación activa va en
                    morado, no ámbar. */}
                {active && (
                  <span
                    className="absolute bottom-0 left-1 right-1 h-0.5 rounded-t-full origin-center animate-in zoom-in-x duration-200"
                    style={{
                      background: 'linear-gradient(90deg, transparent, var(--primary) 20%, var(--primary) 80%, transparent)',
                      boxShadow: '0 0 10px color-mix(in srgb, var(--primary) 45%, transparent)',
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Affordance: fades indican que hay más tabs hacia ese lado */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-200 ${
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-200 flex items-center justify-end pr-1 ${
            canScrollRight ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
