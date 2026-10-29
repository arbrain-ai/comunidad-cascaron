'use client';

/**
 * SearchOverlay — LA experiencia de búsqueda
 *
 * Una sola superficie para móvil y desktop (command palette):
 * - Resultados EN VIVO mientras escribes (debounce 250ms, sin Enter)
 * - AbortController: una respuesta vieja jamás pisa a una nueva
 * - Recientes (localStorage) + búsquedas populares cuando está vacío
 * - Navegación por teclado (↑/↓/Enter/Esc) + Cmd+K para abrir
 * - Filtros por tipo
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  MagnifyingGlass,
  X,
  FileText,
  BookOpen,
  GraduationCap,
  Users,
  ClockCounterClockwise,
} from '@phosphor-icons/react/dist/ssr';
import { SearchResultAvatar } from '@/shared/components/SearchResultAvatar';
import { searchCommunity, type SearchResultType } from '../services/searchService';

interface OverlayResult {
  id: string;
  type: string;
  title: string;
  description: string;
  url: string;
  metadata?: Record<string, unknown>;
}

type FilterType = 'all' | SearchResultType;

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'post', label: 'Posts' },
  { value: 'lesson', label: 'Lecciones' },
  { value: 'course', label: 'Cursos' },
  { value: 'member', label: 'Miembros' },
];

const TYPE_ORDER = ['post', 'lesson', 'course', 'member'];

const TYPE_LABELS: Record<string, string> = {
  post: 'Publicaciones',
  lesson: 'Lecciones',
  course: 'Cursos',
  member: 'Miembros',
};

const RECENT_KEY = 'app:recent-searches';
const RECENT_MAX = 8;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const q = query.trim();
    if (q.length < 2) return;
    const list = [q, ...getRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase())];
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // localStorage lleno/bloqueado: los recientes son nice-to-have
  }
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className || 'w-4 h-4';
  switch (type) {
    case 'post': return <FileText className={cls} />;
    case 'lesson': return <BookOpen className={cls} />;
    case 'course': return <GraduationCap className={cls} />;
    case 'member': return <Users className={cls} />;
    default: return <FileText className={cls} />;
  }
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OverlayResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [recents, setRecents] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset + autofocus al abrir; lock del scroll del body
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setFilter('all');
    setActiveIndex(-1);
    setLatencyMs(null);
    setRecents(getRecentSearches());

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // El autofocus inmediato pierde contra la animación de montaje en iOS
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [isOpen]);

  // Búsqueda en vivo: debounce + abort de la request anterior
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();

    if (q.length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const t0 = performance.now();

      try {
        const mapped: OverlayResult[] = await searchCommunity(
          q,
          filter !== 'all' ? [filter] : undefined
        );
        if (controller.signal.aborted) return;

        setResults(mapped);
        setHasSearched(true);
        setActiveIndex(mapped.length > 0 ? 0 : -1);
        setLatencyMs(Math.round(performance.now() - t0));
        setIsLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // llegó una tecla nueva
        setResults([]);
        setHasSearched(true);
        setIsLoading(false);
      }
    }, 250);

    // El cleanup DEBE abortar el fetch en vuelo, no solo el timer: si la
    // respuesta de la query vieja llega mientras el debounce reprograma, sin
    // este abort pisaría los resultados de la nueva query (justo lo que el
    // AbortController debía evitar). clearTimeout solo cubre el caso pre-fetch.
    return () => {
      clearTimeout(timeout);
      abortRef.current?.abort();
    };
  }, [query, filter, isOpen]);

  // Resultados agrupados por tipo (y lista plana para navegación por teclado)
  const grouped = useMemo(() => {
    const groups: { type: string; items: OverlayResult[] }[] = [];
    for (const type of TYPE_ORDER) {
      const items = results.filter((r) => r.type === type);
      if (items.length > 0) groups.push({ type, items });
    }
    return groups;
  }, [results]);

  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const handleSelect = useCallback(
    (result: OverlayResult) => {
      saveRecentSearch(query);
      onClose();
      router.push(result.url);
    },
    [query, onClose, router]
  );

  // Teclado: Esc cierra, ↑/↓ navegan, Enter abre el activo
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
        e.preventDefault();
        handleSelect(flatResults[activeIndex]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flatResults, activeIndex, onClose, handleSelect]);

  // Mantener visible el resultado activo al navegar con flechas
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-result-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  // Portal a body: el overlay vive dentro del header (backdrop-blur), que crea
  // un containing block y atrapa el fixed adentro de sus ~100px de alto.
  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Buscar">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel: full-screen en móvil, palette centrada en desktop */}
      <div className="absolute inset-0 md:inset-x-0 md:top-[8vh] md:bottom-auto md:mx-auto md:max-w-2xl md:px-4">
        <div className="flex flex-col h-full md:h-auto md:max-h-[70vh] pt-[var(--sat)] md:pt-0 bg-background md:bg-surface md:rounded-2xl md:border md:border-glass-strong md:shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-glass flex-shrink-0">
            <MagnifyingGlass size={20} className="text-muted flex-shrink-0" weight="duotone" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca posts, lecciones, cursos, videos, miembros..."
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none min-w-0"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {isLoading && (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted/10 transition-colors flex-shrink-0"
              aria-label="Cerrar búsqueda"
            >
              <X size={20} />
            </button>
          </div>

          {/* Filtros por tipo */}
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-hide border-b border-glass flex-shrink-0" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                  filter === f.value
                    ? 'bg-primary text-white'
                    : 'bg-muted/10 text-muted hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Cuerpo */}
          <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain min-h-0 md:min-h-[200px]">
            {query.trim().length < 2 ? (
              /* Vacío: recientes */
              <div className="p-4 space-y-5">
                {recents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                      <ClockCounterClockwise size={14} />
                      Recientes
                    </div>
                    <div className="space-y-0.5">
                      {recents.map((term) => (
                        <button
                          key={term}
                          onClick={() => setQuery(term)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-2"
                        >
                          <MagnifyingGlass size={14} className="text-muted flex-shrink-0" />
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {recents.length === 0 && (
                  <p className="text-sm text-muted text-center py-6">
                    Busca publicaciones, cursos, lecciones y miembros
                  </p>
                )}
              </div>
            ) : hasSearched && flatResults.length === 0 && !isLoading ? (
              <div className="p-8 text-center">
                <p className="text-muted mb-1">Sin resultados para &quot;{query}&quot;</p>
                <p className="text-sm text-muted/70">Intenta con otros términos</p>
              </div>
            ) : (
              /* Resultados agrupados por tipo */
              <div className="py-2">
                {grouped.map((group) => (
                  <div key={group.type}>
                    <div className="px-4 pt-3 pb-1.5 text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
                      <TypeIcon type={group.type} className="w-3.5 h-3.5" />
                      {TYPE_LABELS[group.type] || group.type}
                    </div>
                    {group.items.map((result) => {
                      const index = flatResults.indexOf(result);
                      const isActive = index === activeIndex;
                      const authorName = result.metadata?.author_name as string | undefined;
                      const authorAvatar = result.metadata?.author_avatar as string | undefined;
                      const memberAvatar = result.metadata?.avatar_url as string | undefined;
                      const thumbnail = result.metadata?.thumbnail_url as string | undefined;
                      const courseTitle = result.metadata?.course_title as string | undefined;

                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          data-result-index={index}
                          onClick={() => handleSelect(result)}
                          onMouseMove={() => setActiveIndex(index)}
                          // Sincroniza activeIndex con el foco por Tab: el handler
                          // global de Enter abre flatResults[activeIndex], así que
                          // sin esto Tab+Enter abriría el resultado equivocado.
                          onFocus={() => setActiveIndex(index)}
                          className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                            isActive ? 'bg-primary/10' : 'hover:bg-primary/5'
                          }`}
                        >
                          {/* Visual: avatar (miembro/autor) o thumbnail o ícono */}
                          {result.type === 'member' ? (
                            <SearchResultAvatar src={memberAvatar} name={result.title} className="w-9 h-9 flex-shrink-0" />
                          ) : authorName ? (
                            <SearchResultAvatar src={authorAvatar} name={authorName} className="w-9 h-9 flex-shrink-0" />
                          ) : thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumbnail} alt="" className="w-14 aspect-video rounded-md object-cover flex-shrink-0 bg-surface" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                              <TypeIcon type={result.type} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-semibold text-foreground truncate">
                                {result.title}
                              </h4>
                            </div>
                            {result.description && (
                              <p className="text-xs text-muted line-clamp-2 mt-0.5">{result.description}</p>
                            )}
                            {(authorName || courseTitle) && (
                              <p className="text-[11px] text-muted/70 mt-0.5 truncate">
                                {courseTitle || authorName}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer: conteo + latencia (desktop además muestra atajos) */}
          {hasSearched && flatResults.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-glass text-[11px] text-muted flex-shrink-0">
              <span>
                {flatResults.length} resultados{latencyMs !== null ? ` · ${latencyMs}ms` : ''}
              </span>
              <span className="hidden md:flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-muted/10 border border-border/30">↑↓</kbd>
                navegar
                <kbd className="px-1.5 py-0.5 rounded bg-muted/10 border border-border/30">↵</kbd>
                abrir
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
