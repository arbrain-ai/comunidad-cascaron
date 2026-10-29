'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sbAvatar } from '@/shared/lib/sbImage';

interface Props {
  src: string | null;
  alt: string;
  fallbackInitial?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showRing?: boolean;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6',
  sm: 'w-7 h-7',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40'
};

const INITIAL_TEXT_SIZES = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-4xl',
  lg: 'text-5xl',
  xl: 'text-6xl'
};

/**
 * Converts Google avatar URLs to high resolution (512px)
 * Google serves low-res (96px) by default via =s96-c parameter
 */
function getHighResGoogleAvatar(url: string | null): string | null {
  if (!url) return null;

  // Detect Google avatar URLs and upgrade resolution
  if (url.includes('googleusercontent.com')) {
    // Replace =s96-c or similar with =s512-c for high resolution
    return url.replace(/=s\d+-c/, '=s512-c');
  }

  return url;
}

/**
 * Avatar image that opens in a centered lightbox with golden glow on click (Skool style)
 */
export function ExpandableAvatar({ src, alt, fallbackInitial, size = 'lg', className = '', showRing = true }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Only render portal after mounting (client-side)
  useEffect(() => {
    setMounted(true);
  }, []);

  const initial = fallbackInitial || alt?.charAt(0).toUpperCase() || '?';
  const highResSrc = getHighResGoogleAvatar(src);
  const sizeClass = SIZE_CLASSES[size];

  const handleOpen = () => {
    if (src) {
      setImageError(false);
      setIsLoading(true);
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Handle Escape key to close lightbox
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Thumbnail */}
      <div
        onClick={handleOpen}
        className={`relative flex-shrink-0 ${src ? 'cursor-pointer' : ''} ${className}`}
      >
        {src ? (
          <img
            /* Thumbnail chico via CDN transform; el lightbox de abajo sigue full-res */
            src={sbAvatar(src, 96)}
            alt={alt}
            loading="lazy"
            className={`${sizeClass} rounded-full object-cover aspect-square flex-shrink-0 ${showRing ? 'ring-4 ring-primary/30 hover:ring-[#FBAC1B]/50' : ''} transition-all`}
          />
        ) : (
          <div className={`${sizeClass} rounded-full bg-primary/20 flex items-center justify-center aspect-square flex-shrink-0 ${showRing ? 'ring-4 ring-primary/30' : ''}`}>
            <span className={`${INITIAL_TEXT_SIZES[size]} font-bold text-primary`}>{initial}</span>
          </div>
        )}
      </div>

      {/* Lightbox Modal - Rendered via Portal to escape containing block issues */}
      {mounted && isOpen && highResSrc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Dark overlay - onClick directly on overlay for reliable closing */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={handleClose}
          />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-20 p-2 text-white/80 hover:text-white bg-black/60 hover:bg-black/80 rounded-full transition-colors backdrop-blur-sm"
            title="Cerrar (Esc)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Centered image with golden glow */}
          <div
            className="relative z-10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading placeholder */}
            {isLoading && (
              <div
                className="absolute inset-0 w-72 h-72 md:w-96 md:h-96 rounded-full bg-gray-800 flex items-center justify-center"
                style={{
                  boxShadow: '0 0 60px #FBAC1B, 0 0 100px rgba(251, 172, 27, 0.5)',
                  border: '4px solid #FBAC1B'
                }}
              >
                <div className="w-8 h-8 border-2 border-[#FBAC1B] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {imageError ? (
              // Fallback: show original low-res image if high-res fails
              <img
                src={src!}
                alt={alt}
                onLoad={handleImageLoad}
                className={`w-72 h-72 md:w-96 md:h-96 rounded-full object-cover ${isLoading ? 'invisible' : ''}`}
                style={{
                  boxShadow: '0 0 60px #FBAC1B, 0 0 100px rgba(251, 172, 27, 0.5)',
                  border: '4px solid #FBAC1B'
                }}
              />
            ) : (
              <img
                src={highResSrc}
                alt={alt}
                onError={handleImageError}
                onLoad={handleImageLoad}
                className={`w-72 h-72 md:w-96 md:h-96 rounded-full object-cover ${isLoading ? 'invisible' : ''}`}
                style={{
                  boxShadow: '0 0 60px #FBAC1B, 0 0 100px rgba(251, 172, 27, 0.5)',
                  border: '4px solid #FBAC1B'
                }}
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
