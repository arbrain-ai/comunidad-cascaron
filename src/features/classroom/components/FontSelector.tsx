'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface FontOption {
  value: string;
  label: string;
  fontFamily: string;
}

const FONT_OPTIONS: FontOption[] = [
  { value: '', label: 'Tipografía', fontFamily: 'inherit' },
  { value: 'Inter, system-ui, sans-serif', label: 'Inter', fontFamily: 'Inter, system-ui, sans-serif' },
  { value: 'Space Grotesk, system-ui, sans-serif', label: 'Space Grotesk', fontFamily: 'Space Grotesk, system-ui, sans-serif' },
  { value: 'JetBrains Mono, monospace', label: 'JetBrains Mono', fontFamily: 'JetBrains Mono, monospace' },
  { value: 'Playfair Display, serif', label: 'Playfair Display', fontFamily: 'Playfair Display, serif' },
  { value: 'Lora, serif', label: 'Lora', fontFamily: 'Lora, serif' },
];

interface FontSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function FontSelector({ value, onChange }: FontSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px gap
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on scroll (optional, for better UX)
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const selectedOption = FONT_OPTIONS.find(opt => opt.value === value) || FONT_OPTIONS[0];

  return (
    <div className="relative flex-shrink-0">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 text-xs rounded bg-surface border border-primary/20 hover:border-primary/40 focus:border-primary focus:outline-none transition-colors cursor-pointer min-w-[130px] flex items-center justify-between gap-2"
        style={{ fontFamily: selectedOption.value ? selectedOption.fontFamily : 'inherit' }}
      >
        <span className="truncate">{selectedOption.label}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu - Rendered via Portal to escape overflow container */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-48 bg-surface border border-primary/20 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999,
          }}
        >
          {FONT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-primary/10 transition-colors ${
                value === option.value ? 'bg-primary/20 text-primary' : ''
              }`}
              style={{ fontFamily: option.fontFamily }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
