'use client';

/**
 * SearchBar (desktop) — trigger del SearchOverlay unificado (Goal 4).
 *
 * Ya no es un input con su propio dropdown: se ve como un input, pero al
 * clickearlo (o con ⌘K) abre el SearchOverlay, la ÚNICA experiencia de
 * búsqueda para móvil y desktop. El dropdown viejo (sin navegación por
 * teclado, sin abort, inconexo del flujo móvil) murió aquí.
 */

interface SearchBarProps {
  onOpen: () => void;
}

export function SearchBar({ onOpen }: SearchBarProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full flex items-center gap-2 pl-10 pr-4 py-2 bg-surface border border-border border-t-white/8 rounded-xl text-muted hover:border-primary/50 focus:outline-none focus:border-primary transition-all duration-fast shadow-[var(--shadow-xs),inset_0_1px_0_rgba(255,255,255,0.06)] text-left"
      aria-label="Abrir búsqueda"
    >
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="flex-1 text-sm">Buscar...</span>
      <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/40 bg-muted/10 text-2xs font-medium text-muted">
        ⌘K
      </kbd>
    </button>
  );
}
