'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { X, Ban, Sparkles, Upload, Trash2 } from 'lucide-react';
import type { BackgroundEffectMode } from '../hooks/useBackgroundEffect';

interface BackgroundSelectorProps {
  currentMode: BackgroundEffectMode;
  onChangeMode: (mode: BackgroundEffectMode) => void;
  onClose: () => void;
}

// localStorage key for the user's uploaded custom background. Persists across
// reloads so the same user keeps their fondo without re-uploading.
const CUSTOM_BG_KEY = 'app_video_custom_background';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB cap; bigger images choke the segmentation processor

// Generate gradient image as data URL (for virtual backgrounds)
function createGradientDataUrl(colors: string[], direction = 135): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Compute gradient endpoints from angle (in degrees, like CSS).
  const rad = ((direction - 90) * Math.PI) / 180;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const len = Math.max(canvas.width, canvas.height);
  const x0 = cx - Math.cos(rad) * len * 0.5;
  const y0 = cy - Math.sin(rad) * len * 0.5;
  const x1 = cx + Math.cos(rad) * len * 0.5;
  const y1 = cy + Math.sin(rad) * len * 0.5;

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  colors.forEach((color, i) => {
    gradient.addColorStop(i / Math.max(colors.length - 1, 1), color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

interface BackgroundPreset {
  id: string;
  label: string;
  colors: string[];
  /** Optional: pre-rendered noise / radial accents for richer presets. */
  accent?: 'glow-tl' | 'glow-br' | 'noise';
}

const IMAGE_PRESETS: BackgroundPreset[] = [
  { id: 'bg-purple', label: 'Violeta', colors: ['#1a0b3d', '#4c1d95', '#8b5cf6'] },
  { id: 'bg-amber', label: 'Ámbar', colors: ['#451a03', '#9a3412', '#f59e0b'] },
  { id: 'bg-ocean', label: 'Océano', colors: ['#0c1e3e', '#1e3a8a', '#0ea5e9'] },
  { id: 'bg-forest', label: 'Bosque', colors: ['#022c1a', '#14532d', '#22c55e'] },
  { id: 'bg-sunset', label: 'Atardecer', colors: ['#3f0f0f', '#9a3412', '#f97316', '#fbbf24'] },
  { id: 'bg-night', label: 'Noche', colors: ['#020617', '#0f172a', '#1e293b'] },
  { id: 'bg-rose', label: 'Rosa', colors: ['#3f0a1a', '#881337', '#ec4899'] },
  { id: 'bg-mono', label: 'Monocromo', colors: ['#0a0a0a', '#262626', '#525252'] },
];

export function BackgroundSelector({
  currentMode,
  onChangeMode,
  onClose,
}: BackgroundSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load any previously uploaded custom background from localStorage.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CUSTOM_BG_KEY);
      if (stored && stored.startsWith('data:image/')) {
        setCustomBg(stored);
      }
    } catch {
      // localStorage may be unavailable (Safari private mode). Silently degrade.
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Generate gradient images (cached via useMemo)
  const presetImages = useMemo(() => {
    return IMAGE_PRESETS.map((preset) => ({
      ...preset,
      dataUrl: createGradientDataUrl(preset.colors),
    }));
  }, []);

  const isBlurMode =
    currentMode === 'blur-light' || currentMode === 'blur-medium' || currentMode === 'blur-strong';
  const isImageMode = currentMode !== 'none' && !isBlurMode;

  const handleUpload = useCallback(
    (file: File) => {
      setUploadError(null);
      if (!file.type.startsWith('image/')) {
        setUploadError('Solo imagenes (PNG, JPG, WebP)');
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError('Maximo 4 MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (typeof dataUrl !== 'string') return;
        try {
          window.localStorage.setItem(CUSTOM_BG_KEY, dataUrl);
        } catch {
          // localStorage may reject if data is too big. Apply once but warn.
          setUploadError('No se pudo guardar (memoria llena). Aplicado solo esta sesion.');
        }
        setCustomBg(dataUrl);
        onChangeMode(dataUrl);
      };
      reader.onerror = () => setUploadError('Error leyendo el archivo');
      reader.readAsDataURL(file);
    },
    [onChangeMode],
  );

  const clearCustomBg = useCallback(() => {
    try {
      window.localStorage.removeItem(CUSTOM_BG_KEY);
    } catch {
      // ignore
    }
    setCustomBg(null);
    if (currentMode === customBg) {
      onChangeMode('none');
    }
  }, [currentMode, customBg, onChangeMode]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-3 right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 w-[calc(100vw-1rem)] md:w-96 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#8ab4f8]" />
          <h3 className="text-sm font-medium text-white">Efectos visuales</h3>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-4 max-h-[420px] overflow-y-auto">
        {/* Blur options — 4 levels (none + 3 blur intensities) */}
        <div>
          <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2.5 px-0.5">
            Desenfoque
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {/* None */}
            <button
              onClick={() => onChangeMode('none')}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 ${
                currentMode === 'none'
                  ? 'bg-[#8ab4f8]/10 ring-2 ring-[#8ab4f8]'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-[#3c4043] flex items-center justify-center">
                <Ban className="w-5 h-5 text-white/50" />
              </div>
              <span className="text-[10px] text-white/60">Ninguno</span>
            </button>

            {/* Blur light */}
            <button
              onClick={() => onChangeMode('blur-light')}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 ${
                currentMode === 'blur-light'
                  ? 'bg-[#8ab4f8]/10 ring-2 ring-[#8ab4f8]'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#3c4043] to-[#5c5f63] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 backdrop-blur-[1px] bg-white/5" />
                <div className="relative w-4 h-5 rounded-full bg-white/30 border border-white/20" />
              </div>
              <span className="text-[10px] text-white/60">Leve</span>
            </button>

            {/* Blur medium (NEW) */}
            <button
              onClick={() => onChangeMode('blur-medium')}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 ${
                currentMode === 'blur-medium'
                  ? 'bg-[#8ab4f8]/10 ring-2 ring-[#8ab4f8]'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#3c4043] to-[#5c5f63] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 backdrop-blur-[2px] bg-white/8" />
                <div className="relative w-4 h-5 rounded-full bg-white/30 border border-white/20" />
              </div>
              <span className="text-[10px] text-white/60">Medio</span>
            </button>

            {/* Blur strong */}
            <button
              onClick={() => onChangeMode('blur-strong')}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 ${
                currentMode === 'blur-strong'
                  ? 'bg-[#8ab4f8]/10 ring-2 ring-[#8ab4f8]'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#3c4043] to-[#5c5f63] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 backdrop-blur-[4px] bg-white/12" />
                <div className="relative w-4 h-5 rounded-full bg-white/30 border border-white/20" />
              </div>
              <span className="text-[10px] text-white/60">Fuerte</span>
            </button>
          </div>
        </div>

        {/* Custom uploaded background */}
        <div>
          <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2.5 px-0.5">
            Tu fondo
          </h4>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            {customBg ? (
              <>
                <button
                  onClick={() => onChangeMode(customBg)}
                  className={`flex-1 flex items-center gap-2 p-2 rounded-xl transition-all duration-200 ${
                    isImageMode && currentMode === customBg
                      ? 'bg-[#8ab4f8]/10 ring-2 ring-[#8ab4f8]'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-lg bg-cover bg-center flex-shrink-0"
                    style={{ backgroundImage: `url(${customBg})` }}
                  />
                  <span className="text-[11px] text-white/70 text-left flex-1">Imagen guardada</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  title="Cambiar imagen"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={clearCustomBg}
                  className="w-10 h-10 rounded-lg bg-white/5 hover:bg-red-500/15 flex items-center justify-center text-white/60 hover:text-red-300 transition-colors"
                  title="Eliminar imagen guardada"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/15 hover:border-[#8ab4f8]/40 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-[#3c4043] flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-white/50" />
                </div>
                <span className="text-[11px] text-white/60 text-left flex-1">Subir imagen propia (PNG/JPG/WebP, max 4 MB)</span>
              </button>
            )}
          </div>
          {uploadError && (
            <p className="mt-2 text-[10px] text-red-300/80 px-1">{uploadError}</p>
          )}
        </div>

        {/* Virtual backgrounds */}
        <div>
          <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2.5 px-0.5">
            Fondos virtuales
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {presetImages.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onChangeMode(preset.dataUrl)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 ${
                  isImageMode && currentMode === preset.dataUrl
                    ? 'bg-[#8ab4f8]/10 ring-2 ring-[#8ab4f8]'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-lg overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${preset.colors.join(', ')})`,
                  }}
                />
                <span className="text-[10px] text-white/60 truncate max-w-[68px]">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
