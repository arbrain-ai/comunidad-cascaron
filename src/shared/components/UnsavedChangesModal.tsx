'use client';

import { useEffect, useRef } from 'react';

export type UnsavedChangesAction = 'save' | 'discard' | 'cancel';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onAction: (action: UnsavedChangesAction) => void;
  isSaving?: boolean;
}

export function UnsavedChangesModal({
  isOpen,
  onAction,
  isSaving = false,
}: UnsavedChangesModalProps) {
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Focus save button when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        saveButtonRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onAction('cancel');
      } else if (e.key === 'Enter') {
        onAction('save');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onAction]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={() => onAction('cancel')}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-glass-strong shadow-[0_0_30px_rgba(168,85,247,0.15)] bg-background">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Cambios sin guardar
              </h2>
              <p className="text-sm text-muted mt-1">
                Tienes cambios que no se han guardado. ¿Qué deseas hacer?
              </p>
            </div>
          </div>

          {/* Actions - 3 clear options */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              ref={saveButtonRef}
              onClick={() => onAction('save')}
              disabled={isSaving}
              className="btn-primary w-full py-3"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>Guardar y continuar</span>
                </>
              )}
            </button>

            <button
              onClick={() => onAction('discard')}
              disabled={isSaving}
              className="btn-danger w-full py-3"
            >
              Descartar cambios
            </button>

            <button
              onClick={() => onAction('cancel')}
              disabled={isSaving}
              className="btn-ghost w-full py-2.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
