'use client';

import { useState, useEffect, useRef } from 'react';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  label?: string;
  maxLength?: number;
  confirmText?: string;
  cancelText?: string;
}

export function InputModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder = '',
  defaultValue = '',
  label = '',
  maxLength = 100,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value when modal opens with new defaultValue
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus input after a small delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      handleClose();
    }
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-glass-strong shadow-[0_0_30px_rgba(168,85,247,0.15)] bg-background">
        <div className="p-6 space-y-5">
          {/* Header */}
          <h2 className="text-lg font-semibold text-foreground">
            {title}
          </h2>

          {/* Input */}
          <div className="space-y-2">
            {label && (
              <label className="text-sm text-muted">
                {label}
              </label>
            )}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              placeholder={placeholder}
              className="w-full px-4 py-3 bg-surface border border-border border-t-white/8 rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--primary)] transition-all duration-fast shadow-[var(--shadow-xs),inset_0_1px_0_rgba(255,255,255,0.06)] text-base"
            />
            {maxLength && (
              <div className="text-xs text-muted text-right">
                {value.length} / {maxLength}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              className="btn-ghost"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!value.trim()}
              className="btn-primary"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
