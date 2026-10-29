// ============================================
// MainHeader Component - Skool Style
// ============================================
// Header compacto de 2 filas: Logo|Search|Actions + Nav debajo

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useFocusModeSafe } from '@/shared/contexts/FocusModeContext';
import { spring } from '@/shared/lib/animations';
import { UserDropdown } from './UserDropdown';
import { SearchBar } from './SearchBar';
import { SearchOverlay } from '@/features/search/components/SearchOverlay';
import { BRAND } from '@/shared/config/brand';
import { NotificationBell } from '@/features/notifications/components';
import { LevelHUD } from '@/features/gamification/components';

const navItems = [
  { href: '/community', label: 'Comunidad' },
  { href: '/classroom', label: 'Cursos' },
  { href: '/calendar', label: 'Calendario' },
  { href: '/members', label: 'Miembros' },
  { href: '/map', label: 'Mapa' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

/** Baja la geometría del mapa una sola vez, en cuanto se intuye que hace falta. */
let mapGeometryPrefetched = false;
const prefetchMapGeometry = () => {
  if (mapGeometryPrefetched) return;
  mapGeometryPrefetched = true;
  // Prioridad baja: no debe competir con lo que el usuario está viendo ahora.
  fetch('/map/world-geometry.json', { priority: 'low' } as RequestInit).catch(() => {
    mapGeometryPrefetched = false;
  });
};

export function MainHeader() {
  const { userProfile } = useUserProfile();
  const pathname = usePathname();
  const { isFocusMode } = useFocusModeSafe();
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K abre la búsqueda desde cualquier página
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Hide header in focus mode
  if (isFocusMode) {
    return null;
  }

  // Determinar título basado en ruta (solo en móvil para rutas específicas)
  const getPageTitle = () => {
    if (pathname.startsWith('/notifications')) return 'Notificaciones';
    return null;
  };

  const isActive = (href: string) => {
    if (href === '/community') {
      return pathname === '/community';
    }
    return pathname.startsWith(href);
  };

  const pageTitle = getPageTitle();
  const isFullScreenPage = pageTitle !== null;

  // Ocultar navegación en admin panel para más espacio
  const isAdminPage = pathname.startsWith('/admin');

  return (
    <div className="py-2.5">
      {/* Row 1: Logo | Search | Actions - Grid compacto */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Logo + Name */}
        <Link href="/community" className="flex items-center gap-2.5 group flex-shrink-0 min-w-0">
          <div className="relative flex-shrink-0">
            {/* Brand glow, sutil en reposo */}
            <div className="absolute -inset-1 bg-gold/20 blur-md rounded-lg transition-all duration-300 group-hover:bg-gold/40 group-hover:blur-lg" />
            <div className="absolute -inset-0.5 bg-gold/15 blur-sm rounded-lg transition-opacity duration-300 group-hover:opacity-80" />
            <img
              src="/logo.png"
              alt={`${BRAND.name} logo`}
              className="relative w-7 h-7 rounded-lg transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <span className={`text-base font-semibold text-foreground whitespace-nowrap tracking-tight ${isFullScreenPage ? 'hidden md:inline' : ''}`}>
            {BRAND.name}
          </span>
        </Link>

        {/* Título de página en móvil (cuando aplica) */}
        {isFullScreenPage && (
          <h1 className="text-lg font-bold md:hidden flex-1 text-center">{pageTitle}</h1>
        )}

        {/* Center: SearchBar (desktop only) - Expande para llenar espacio */}
        <div className="hidden md:flex flex-1 max-w-2xl">
          <SearchBar onOpen={() => setSearchOpen(true)} />
        </div>

        {/* Right: Actions - Compacto */}
        <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
          {/* Search Icon (solo en móvil): abre el overlay de búsqueda */}
          <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="icon-btn md:hidden p-2 rounded-lg text-muted hover:text-foreground transition-all"
              aria-label="Buscar"
            >
              <MagnifyingGlass size={20} weight="duotone" />
            </button>

          {/* HUD de nivel: visible en TODA la app, móvil incluido */}
          {userProfile && <LevelHUD />}

          {/* Notifications */}
          {userProfile && (
            <div className="hidden md:flex">
              <NotificationBell />
            </div>
          )}

          {/* User Dropdown */}
          <div className="hidden md:flex">
            <UserDropdown />
          </div>
        </div>
      </div>

      {/* Row 2: Navigation (desktop only, hidden in admin)
          El underline activo usa layoutId para animarse entre items (Linear/Vercel pattern). */}
      {!isAdminPage && (
        <nav className="hidden md:flex items-center gap-5 mt-1 -mb-1 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                /* prefetch explícito: las rutas son dinámicas (auth) y sin esto
                   Next solo precarga el loading boundary. Con true, el payload
                   RSC de CADA tab ya está en el router cache antes del click —
                   la navegación no espera red (patrón medido en la referencia). */
                prefetch={true}
                /* El Mapa además precarga su geometría al pasar el cursor: son
                   36 KB que nadie paga si no va para allá, y si va, ya están
                   en caché cuando la ruta monta. */
                onMouseEnter={item.href === '/map' ? prefetchMapGeometry : undefined}
                className={`relative flex-shrink-0 text-sm font-medium transition-all duration-fast py-2 ${
                  active
                    ? 'text-foreground'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="main-nav-underline"
                    className="sf-nav-underline absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    transition={spring.smooth}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Búsqueda unificada (móvil + desktop + ⌘K) */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
