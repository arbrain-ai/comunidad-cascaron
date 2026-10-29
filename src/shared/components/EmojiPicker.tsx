'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = {
  'Frecuentes': ['😀', '😂', '🥰', '😍', '🤩', '😊', '🙌', '👍', '❤️', '🔥', '✨', '🎉'],
  'Caras': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
  'Gestos': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝', '🙏', '💪', '🦾'],
  'Corazones': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💝'],
  'Objetos': ['🎉', '🎊', '🎁', '🎈', '✨', '⭐', '🌟', '💫', '🔥', '💥', '💯', '🏆', '🥇', '🎯', '🎮', '🎲', '🎸', '🎹', '📱', '💻', '⌨️', '🖥️', '📷', '📸', '🎬', '🎤', '🎧', '📚', '📝', '✏️'],
};

const PICKER_WIDTH = 340;
const GAP = 8;
const MARGIN = 10;

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Frecuentes');
  // null = aun sin medir: el picker se renderiza invisible para no parpadear en (0,0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Posiciona con la altura REAL del picker y lo mantiene siempre dentro del viewport
  const updatePosition = useCallback(() => {
    if (!buttonRef.current || !pickerRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const height = pickerRef.current.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Preferido: arriba del boton. Si no cabe, abajo. Si tampoco, donde haya mas espacio.
    const spaceAbove = rect.top - GAP - MARGIN;
    const spaceBelow = viewportHeight - rect.bottom - GAP - MARGIN;
    let top: number;
    if (spaceAbove >= height) {
      top = rect.top - GAP - height;
    } else if (spaceBelow >= height) {
      top = rect.bottom + GAP;
    } else {
      top = spaceAbove >= spaceBelow ? rect.top - GAP - height : rect.bottom + GAP;
    }
    top = Math.min(Math.max(top, MARGIN), viewportHeight - height - MARGIN);

    let left = rect.right - PICKER_WIDTH;
    left = Math.min(Math.max(left, MARGIN), viewportWidth - PICKER_WIDTH - MARGIN);

    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [isOpen, activeCategory, updatePosition]);

  // Reposicionar si la ventana cambia o algo hace scroll (el modal, el feed)
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleEmojiClick = (e: React.MouseEvent, emoji: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(emoji);
    setIsOpen(false);
  };

  const handleCategoryClick = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCategory(category);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Añadir emoji"
      >
        <Smile className="w-5 h-5" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={pickerRef}
          className="fixed bg-background border border-border rounded-xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 z-[9999]"
          style={{
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            width: PICKER_WIDTH,
            maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
            visibility: position ? 'visible' : 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Category tabs */}
          <div className="flex justify-center border-b border-border p-2 gap-1.5">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <button
                key={category}
                type="button"
                onClick={(e) => handleCategoryClick(e, category)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Emojis grid */}
          <div className="p-2 max-h-52 overflow-y-auto">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  type="button"
                  onClick={(e) => handleEmojiClick(e, emoji)}
                  className="w-9 h-9 flex items-center justify-center text-xl hover:bg-accent rounded-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
