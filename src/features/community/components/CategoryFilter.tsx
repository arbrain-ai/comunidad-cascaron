'use client';

import { useState, useRef, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { Category } from '../types';
import { UserTier } from '@/features/admin/types';
import { TimeRange, PostSortOption } from '../services/communityService';

// Re-export for backwards compatibility
export type { PostSortOption } from '../services/communityService';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  userTier?: UserTier | null;
  // Sort filter props
  sortBy?: PostSortOption;
  onSortChange?: (sort: PostSortOption) => void;
  // Time range filter props
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  // Favorites filter props
  showFavoritesOnly?: boolean;
  onToggleFavorites?: () => void;
}

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelectCategory,
  userTier = 'no-paid',
  sortBy = 'default',
  onSortChange,
  timeRange = 'all',
  onTimeRangeChange,
  showFavoritesOnly = false,
  onToggleFavorites,
}: CategoryFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const timeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking/touching outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
        setShowTimeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Check if user has access to a category based on tier
  const hasAccessToCategory = (category: Category): boolean => {
    const permissions = category.permissions;

    // No tier restrictions (members = everyone can access)
    if (permissions === 'members' || permissions === 'admins') {
      return true;
    }

    // Categorias solo VIP
    if (permissions === 'vip') {
      return userTier === 'vip';
    }

    return true;
  };

  const handleCategoryClick = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category && !hasAccessToCategory(category)) {
      setShowLockedModal(true);
      return;
    }
    onSelectCategory(categoryId);
  };

  // Desktop visibility rules (expand/collapse)
  const hasMoreDesktop = categories.length > 4;
  const getDesktopVisibilityClass = (index: number): string => {
    if (isExpanded) return '';
    if (index < 4) return '';
    return 'hidden';
  };

  const sortOptions: { value: PostSortOption; label: string; icon: React.ReactNode }[] = [
    {
      value: 'default',
      label: 'Recientes',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
      ),
    },
    {
      value: 'new',
      label: 'Nuevos',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      value: 'top',
      label: 'Populares',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      ),
    },
    {
      value: 'most_commented',
      label: 'Más comentados',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
    {
      value: 'most_saved',
      label: 'Más guardados',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      value: 'unread',
      label: 'Sin leer',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
  ];

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: 'all', label: 'Todo' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
    { value: '1y', label: '1 año' },
  ];

  const currentTimeRange = timeRangeOptions.find(o => o.value === timeRange) || timeRangeOptions[0];

  const currentSort = sortOptions.find(o => o.value === sortBy) || sortOptions[0];

  // Category button component to avoid duplication
  const CategoryButton = ({ category, extraClass = '' }: { category: Category; extraClass?: string }) => {
    const isLocked = !hasAccessToCategory(category);
    const isSelected = selectedCategoryId === category.id;

    return (
      <button
        onClick={() => handleCategoryClick(category.id)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-fast whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
          isSelected
            ? 'text-white shadow-[0_2px_12px_rgba(var(--primary-rgb),0.4),inset_0_1px_0_rgba(255,255,255,0.15)]'
            : isLocked
            ? 'bg-surface border border-border/50 text-muted cursor-not-allowed'
            : 'bg-surface border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
        } ${extraClass}`}
        style={{
          backgroundColor: isSelected ? category.color || undefined : undefined,
        }}
      >
        {(category as any).emoji && <span>{(category as any).emoji}</span>}
        {category.name}
        {isLocked && (
          <svg className="w-3 h-3 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </button>
    );
  };

  const TodasButton = ({ extraClass = '' }: { extraClass?: string }) => (
    <button
      onClick={() => onSelectCategory(null)}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-fast whitespace-nowrap flex-shrink-0 ${
        selectedCategoryId === null && !showFavoritesOnly
          ? 'bg-primary text-white shadow-[0_2px_12px_rgba(var(--primary-rgb),0.4),inset_0_1px_0_rgba(255,255,255,0.15)]'
          : 'bg-surface border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
      } ${extraClass}`}
    >
      Todas
    </button>
  );

  const FavoritesButton = ({ extraClass = '' }: { extraClass?: string }) => {
    if (!onToggleFavorites) return null;

    return (
      <button
        onClick={onToggleFavorites}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
          showFavoritesOnly
            ? 'bg-primary text-white shadow-[0_2px_12px_rgba(var(--primary-rgb),0.4),inset_0_1px_0_rgba(255,255,255,0.15)]'
            : 'bg-surface border border-border text-foreground hover:border-primary/40 hover:bg-primary/5'
        } ${extraClass}`}
      >
        <Bookmark className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
        Mis Favoritos
      </button>
    );
  };

  // Time range dropdown component
  const TimeRangeDropdown = () => {
    if (!onTimeRangeChange) return null;

    return (
      <div ref={timeDropdownRef} className="relative flex-shrink-0">
        <button
          onClick={() => setShowTimeDropdown(!showTimeDropdown)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
            timeRange !== 'all'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'bg-surface border border-border text-muted hover:text-foreground hover:border-primary/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {currentTimeRange.label}
        </button>

        {showTimeDropdown && (
          <div className="absolute right-0 top-full mt-2 w-36 glass-panel-strong rounded-xl border border-glass-strong shadow-elevation-md z-50 overflow-hidden">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onTimeRangeChange(option.value);
                  setShowTimeDropdown(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                  timeRange === option.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-surface'
                }`}
              >
                {option.label}
                {timeRange === option.value && (
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Sort dropdown component
  const SortDropdown = () => (
    <div ref={sortDropdownRef} className="relative flex-shrink-0">
      <button
        onClick={() => setShowSortDropdown(!showSortDropdown)}
        className="p-2 rounded-full bg-surface border border-border text-muted hover:text-foreground hover:border-primary/40 hover:shadow-sm transition-all duration-fast"
        title={`Ordenar: ${currentSort.label}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {showSortDropdown && (
        <div className="absolute right-0 top-full mt-2 w-48 glass-panel-strong rounded-xl border border-glass-strong shadow-elevation-md z-50 overflow-hidden">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onSortChange?.(option.value);
                setShowSortDropdown(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                sortBy === option.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-surface'
              }`}
            >
              {option.icon}
              {option.label}
              {sortBy === option.value && (
                <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {/* MOBILE: Horizontal scroll (visible on small screens) */}
      <div className="flex md:hidden items-center gap-2">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex items-center gap-2 pb-1">
            <TodasButton />
            {categories.map((category) => (
              <CategoryButton key={category.id} category={category} />
            ))}
            <FavoritesButton />
          </div>
        </div>
        <TimeRangeDropdown />
        {onSortChange && <SortDropdown />}
      </div>

      {/* DESKTOP: Two rows when expanded (visible on md+) */}
      <div className="hidden md:block">
        {/* First row: Main categories + More button + Sort */}
        <div className="flex items-center justify-center gap-2">
          <TodasButton />
          {categories.slice(0, 4).map((category) => (
            <CategoryButton key={category.id} category={category} />
          ))}

          {/* More Button - Only when collapsed */}
          {hasMoreDesktop && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-fast whitespace-nowrap bg-surface border border-border text-muted hover:text-foreground hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
            >
              Más...
            </button>
          )}
          <TimeRangeDropdown />
          {onSortChange && <SortDropdown />}
        </div>

        {/* Second row: Additional categories + Favorites + Less (only when expanded) */}
        {isExpanded && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {categories.slice(4).map((category) => (
              <CategoryButton key={category.id} category={category} />
            ))}
            <FavoritesButton />
            <button
              onClick={() => setIsExpanded(false)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-fast whitespace-nowrap bg-surface border border-border text-muted hover:text-foreground hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
            >
              Menos
            </button>
          </div>
        )}
      </div>

      {/* Locked Category Modal */}
      {showLockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLockedModal(false)} />
          <div className="relative w-full max-w-md glass-panel-strong rounded-xl border border-glass-strong shadow-purple-glow p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Contenido VIP</h3>
                <p className="text-sm text-muted">Acceso restringido</p>
              </div>
            </div>

            <p className="text-foreground">
              Esta categoría es exclusiva para miembros <span className="font-semibold text-primary">VIP</span>.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLockedModal(false)}
                className="flex-1 px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cerrar
              </button>
              <a
                href="/"
                className="btn-primary flex-1 text-sm text-center"
              >
                Aplicar ahora
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
