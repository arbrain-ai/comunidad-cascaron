'use client';

import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, Maximize, Minimize, Settings, Check, Sparkles } from 'lucide-react';
import type { VideoLayoutMode } from '../types';

interface MoreMenuProps {
  layout: VideoLayoutMode;
  isFullscreen: boolean;
  isBackgroundSupported?: boolean;
  onChangeLayout: (layout: VideoLayoutMode) => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onOpenBackgroundSelector?: () => void;
  onClose: () => void;
}

const LAYOUT_OPTIONS: { mode: VideoLayoutMode; label: string }[] = [
  { mode: 'gallery', label: 'Galeria' },
  { mode: 'speaker', label: 'Orador' },
  { mode: 'presentation', label: 'Presentacion' },
];

export function MoreMenu({
  layout,
  isFullscreen,
  isBackgroundSupported,
  onChangeLayout,
  onToggleFullscreen,
  onOpenSettings,
  onOpenBackgroundSelector,
  onClose,
}: MoreMenuProps) {
  const [showLayoutSubmenu, setShowLayoutSubmenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-3 right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 w-64 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Layout switcher */}
      <button
        onClick={() => setShowLayoutSubmenu(!showLayoutSubmenu)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
      >
        <LayoutGrid className="w-4 h-4 text-white/50" />
        <span>Ajustar vista</span>
        <span className="ml-auto text-[11px] text-white/40">
          {LAYOUT_OPTIONS.find((o) => o.mode === layout)?.label}
        </span>
      </button>

      {showLayoutSubmenu && (
        <div className="border-t border-white/5 py-1 bg-black/10">
          {LAYOUT_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => {
                onChangeLayout(mode);
                onClose();
              }}
              className={`w-full text-left pl-11 pr-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                layout === mode
                  ? 'text-[#8ab4f8] bg-[#8ab4f8]/5'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <span>{label}</span>
              {layout === mode && (
                <Check className="w-3.5 h-3.5 ml-auto text-[#8ab4f8]" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Background effects */}
      {isBackgroundSupported && onOpenBackgroundSelector && (
        <button
          onClick={() => {
            onOpenBackgroundSelector();
            onClose();
          }}
          className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-white/80 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <Sparkles className="w-4 h-4 text-[#8ab4f8]" />
          <span>Efectos visuales</span>
        </button>
      )}

      {/* Fullscreen */}
      <button
        onClick={() => {
          onToggleFullscreen();
          onClose();
        }}
        className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-white/80 hover:bg-white/5 transition-colors border-t border-white/5"
      >
        {isFullscreen ? (
          <Minimize className="w-4 h-4 text-white/50" />
        ) : (
          <Maximize className="w-4 h-4 text-white/50" />
        )}
        <span>
          {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </span>
      </button>

      {/* Device settings */}
      <button
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
        className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-white/80 hover:bg-white/5 transition-colors border-t border-white/5"
      >
        <Settings className="w-4 h-4 text-white/50" />
        <span>Configuracion</span>
      </button>
    </div>
  );
}
