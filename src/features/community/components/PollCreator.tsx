'use client';

import { useState, useCallback } from 'react';
import { CreatePollInput } from '../types';

interface PollCreatorProps {
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  onPollChange: (poll: CreatePollInput | null) => void;
}

export function PollCreator({ isActive, onActiveChange, onPollChange }: PollCreatorProps) {
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const handleDeactivate = useCallback(() => {
    onActiveChange(false);
    setOptions(['', '']);
    setAllowMultiple(false);
    onPollChange(null);
  }, [onActiveChange, onPollChange]);

  // Reset options when activated
  const handleReset = useCallback(() => {
    setOptions(['', '']);
    setAllowMultiple(false);
  }, []);

  const handleOptionChange = useCallback((index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);

    // Update poll if we have valid options
    const validOptions = newOptions.filter(o => o.trim());
    if (validOptions.length >= 2) {
      onPollChange({
        allow_multiple: allowMultiple,
        options: validOptions,
      });
    } else {
      onPollChange(null);
    }
  }, [options, allowMultiple, onPollChange]);

  const handleAddOption = useCallback(() => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  }, [options]);

  const handleRemoveOption = useCallback((index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);

      // Update poll
      const validOptions = newOptions.filter(o => o.trim());
      if (validOptions.length >= 2) {
        onPollChange({
          allow_multiple: allowMultiple,
          options: validOptions,
        });
      } else {
        onPollChange(null);
      }
    }
  }, [options, allowMultiple, onPollChange]);

  const handleAllowMultipleChange = useCallback((value: boolean) => {
    setAllowMultiple(value);
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length >= 2) {
      onPollChange({
        allow_multiple: value,
        options: validOptions,
      });
    }
  }, [options, onPollChange]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Crear encuesta</h4>
        <button
          type="button"
          onClick={handleDeactivate}
          className="p-1 text-muted hover:text-foreground"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Opción ${index + 1}`}
              maxLength={100}
              className="flex-1 px-3 py-2 text-sm bg-surface border border-border/30 rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-primary/50"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => handleRemoveOption(index)}
                className="p-1.5 text-muted hover:text-red-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add option button */}
      {options.length < 10 && (
        <button
          type="button"
          onClick={handleAddOption}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Añadir opción
        </button>
      )}

      {/* Allow multiple toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allowMultiple}
          onChange={(e) => handleAllowMultipleChange(e.target.checked)}
          className="w-4 h-4 rounded border-border/30 text-primary focus:ring-primary/50"
        />
        <span className="text-sm text-muted">Permitir múltiples respuestas</span>
      </label>
    </div>
  );
}
