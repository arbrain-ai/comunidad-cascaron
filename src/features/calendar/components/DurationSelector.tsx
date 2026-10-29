'use client';

import { DURATION_OPTIONS } from '../types';

interface DurationSelectorProps {
  value: number;
  onChange: (minutes: number) => void;
}

export function DurationSelector({ value, onChange }: DurationSelectorProps) {
  const isPreset = DURATION_OPTIONS.some(opt => opt.minutes === value);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        Duración
      </label>

      <div className="flex flex-wrap gap-2">
        {DURATION_OPTIONS.map((option) => (
          <button
            key={option.minutes}
            type="button"
            onClick={() => onChange(option.minutes)}
            className={`
              px-3 py-1.5 text-sm rounded-lg transition-colors
              ${value === option.minutes
                ? 'bg-primary text-white'
                : 'bg-secondary/50 text-foreground hover:bg-secondary'
              }
            `}
          >
            {option.label}
          </button>
        ))}

        {/* Custom duration input */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={15}
            max={480}
            step={15}
            value={!isPreset ? value : ''}
            onChange={(e) => onChange(parseInt(e.target.value) || 60)}
            placeholder="Custom"
            className={`
              w-20 px-2 py-1.5 text-sm rounded-lg border text-foreground placeholder:text-muted
              ${!isPreset
                ? 'border-primary bg-primary/10'
                : 'border-border/30 bg-secondary/50'
              }
              focus:outline-none focus:ring-2 focus:ring-primary/50
            `}
          />
          <span className="text-sm text-muted">min</span>
        </div>
      </div>
    </div>
  );
}
