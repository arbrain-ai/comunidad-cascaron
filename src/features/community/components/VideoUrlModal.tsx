'use client';

// ============================================
// VideoUrlModal — "Añadir video" (video propio · YouTube · Vimeo · Loom)
// ============================================
// Un solo modal para los tres composers (post nuevo, editar post, comentario).
// Antes cada uno traía su copia y ninguna validaba: aceptaban cualquier texto y
// el error aparecía después, como ficha rota en la bandeja. Aquí la URL se
// valida ANTES de entrar y el botón Añadir solo se enciende con un video real.
//
// Va por PORTAL a body: el editor de posts vive en un contenedor con
// overflow-y-auto + backdrop-filter que rompía el position:fixed (el modal no
// abría dentro de PostEditModal). El portal lo resuelve para todos.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseVideoUrl, videoProviderLabel } from '@/shared/utils/videoUrl';

interface VideoUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se llama SOLO con una URL válida (ya recortada). */
  onAdd: (url: string) => void;
}

export function VideoUrlModal({ isOpen, onClose, onAdd }: VideoUrlModalProps) {
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = url.trim();
  const isValid = trimmed.length > 0 && parseVideoUrl(trimmed).type !== 'invalid';
  const showError = touched && trimmed.length > 0 && !isValid;

  // Cada apertura arranca limpia y con el cursor en el campo.
  useEffect(() => {
    if (!isOpen) return;
    setUrl('');
    setTouched(false);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Esc cierra (mismo gesto que el resto de modales de la casa).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const submit = () => {
    setTouched(true);
    if (!isValid) return;
    onAdd(trimmed);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="video-url-modal-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-panel-strong rounded-xl border border-glass-strong depth-modal p-5 space-y-4">
        <div className="space-y-1">
          <h3 id="video-url-modal-title" className="text-lg font-semibold text-foreground">Añadir video</h3>
          <p className="text-xs text-muted">video propio, YouTube, Vimeo o Loom. Entra a la bandeja como una ficha más: arrástrala para ordenarla junto a las imágenes.</p>
        </div>
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Pega la URL del video"
            className={`w-full px-4 py-3 bg-surface border rounded-lg text-foreground placeholder-muted focus:outline-none transition-colors ${
              showError ? 'border-error focus:border-error' : 'border-glass focus:border-glass-strong'
            }`}
            aria-invalid={showError}
          />
          <p className={`text-xs min-h-[1rem] ${showError ? 'text-error' : 'text-muted'}`}>
            {showError
              ? 'Esa URL no es un video que podamos embeber (video propio, YouTube, Vimeo o Loom).'
              : isValid
                ? `Detectado: ${videoProviderLabel(trimmed)}`
                : ''}
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Añadir
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
