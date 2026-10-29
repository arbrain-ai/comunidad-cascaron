'use client';

import { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react';
import { Lock } from 'lucide-react';
import { MentionableUser } from '@/features/community/types';
import { sbAvatar } from '@/shared/lib/sbImage';

export interface MentionListProps {
  items: MentionableUser[];
  command: (item: MentionableUser) => void;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const selectItem = (index: number) => {
      const item = items[index];
      // No permitir seleccionar agentes bloqueados
      if (item && !item.isLocked) {
        command(item);
      }
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll to selected item
    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }, [selectedIndex]);

    // Función para encontrar el siguiente índice no bloqueado
    const findNextUnlockedIndex = (current: number, direction: 1 | -1): number => {
      const len = items.length;
      let next = (current + direction + len) % len;
      let attempts = 0;
      // Buscar el siguiente item no bloqueado
      while (items[next]?.isLocked && attempts < len) {
        next = (next + direction + len) % len;
        attempts++;
      }
      // Si todos están bloqueados, mantener el actual
      return attempts >= len ? current : next;
    };

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((current) => findNextUnlockedIndex(current, -1));
            return true;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((current) => findNextUnlockedIndex(current, 1));
            return true;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            // Solo seleccionar si no está bloqueado
            if (!items[selectedIndex]?.isLocked) {
              selectItem(selectedIndex);
            }
            return true;
          }

          return false;
        },
      }),
      [items, selectedIndex, command]
    );

    if (items.length === 0) {
      return (
        <div className="glass-panel-strong rounded-xl border border-glass-strong shadow-elevation-lg p-3">
          <p className="text-sm text-muted">No se encontraron usuarios</p>
        </div>
      );
    }

    return (
      <div className="glass-panel-strong rounded-xl border border-glass-strong shadow-elevation-lg overflow-hidden max-h-64 overflow-y-auto">
        {items.map((item, index) => {
          const isLocked = item.isLocked;

          return (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[index] = el; }}
              onClick={() => selectItem(index)}
              disabled={isLocked}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                isLocked
                  ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-900'
                  : index === selectedIndex
                    ? 'bg-primary text-white font-semibold ring-2 ring-primary/50'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground'
              }`}
            >
              {/* Avatar con overlay de candado si está bloqueado */}
              <div className="relative">
                {item.avatar_url ? (
                  <img
                    src={sbAvatar(item.avatar_url, 64)}
                    alt={item.full_name}
                    loading="lazy"
                    className={`w-8 h-8 rounded-full object-cover ${isLocked ? 'grayscale' : ''}`}
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isLocked ? 'bg-gray-200 dark:bg-gray-700' : 'bg-primary/20'
                  }`}>
                    <span className={`text-sm font-medium ${isLocked ? 'text-gray-500' : 'text-primary'}`}>
                      {item.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {/* Candado overlay */}
                {isLocked && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isLocked ? 'text-gray-500' : 'text-foreground'}`}>
                  {item.full_name}
                </p>
                <p className="text-xs text-muted">
                  {isLocked && item.requiredLevel ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Nivel {item.requiredLevel} requerido
                    </span>
                  ) : item.is_agent ? (
                    <span className="text-primary font-medium">Agente AI</span>
                  ) : (
                    <span className="capitalize">{item.role}</span>
                  )}
                </p>
              </div>

              {/* Badge para agentes */}
              {item.is_agent && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${
                  isLocked
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    : 'bg-primary/20 text-primary'
                }`}>
                  {isLocked ? <Lock className="w-3 h-3" /> : 'AI'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';
