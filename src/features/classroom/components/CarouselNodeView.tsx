'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { uploadPostAttachment } from '@/shared/lib/supabaseStorage';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useFocusModeSafe } from '@/shared/contexts/FocusModeContext';

type CarouselSize = 'small' | 'medium' | 'large';

const SIZE_CLASSES: Record<CarouselSize, string> = {
  small: 'max-w-md',
  medium: 'max-w-2xl',
  large: 'w-full',
};

const SIZE_LABELS: Record<CarouselSize, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
};

export function CarouselNodeView({ node, deleteNode, selected, updateAttributes }: NodeViewProps) {
  const { images, size = 'medium' } = node.attrs;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userProfile } = useUserProfile();
  const { isFocusMode } = useFocusModeSafe();

  // In focus mode, hide editing controls for clean presentation
  const showEditingControls = selected && !isFocusMode;

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: arrows to navigate, ESC to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!lightboxOpen) return;

    // Don't intercept when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setLightboxOpen(false);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
    }
  }, [lightboxOpen, images?.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!images || images.length === 0) {
    return (
      <NodeViewWrapper>
        <div className="p-4 border-2 border-dashed border-primary/30 rounded-lg text-center text-muted">
          Carrousel sin imágenes
        </div>
      </NodeViewWrapper>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxOpen(true);
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    setIsUploading(true);
    try {
      const result = await uploadPostAttachment(userProfile.id, file);
      if (result.url) {
        updateAttributes({ images: [...images, result.url] });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSizeChange = (newSize: CarouselSize) => {
    updateAttributes({ size: newSize });
  };

  // Wrapper class based on size - w-fit + mx-auto for S/M so selection border fits the carousel
  const wrapperClass = size === 'large'
    ? 'relative group w-full'
    : 'relative group w-fit mx-auto';

  return (
    <NodeViewWrapper
      ref={containerRef}
      className={wrapperClass}
      data-drag-handle
      data-carousel-kb
      draggable="true"
      contentEditable={false}
    >
      {/* Main Carousel Container with dynamic size */}
      <div className={`relative rounded-xl overflow-hidden border border-primary/20 ${SIZE_CLASSES[size as CarouselSize]}`}>
        {/* Image Container - Dynamic Height */}
        <div className="relative w-full">
          <img
            src={images[currentIndex]}
            alt={`Imagen ${currentIndex + 1} de ${images.length}`}
            className="w-full h-auto max-h-[600px] object-contain"
            style={{ userSelect: 'none' }}
          />

          {/* Expand Button - Bottom Left (gallery icon for carousel) */}
          <button
            onClick={handleExpandClick}
            className="absolute bottom-4 left-4 w-10 h-10 bg-black/60 backdrop-blur-sm border border-primary/30 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/80 hover:border-primary/60 z-20"
            aria-label="Expandir galería"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>

          {/* Size Selector - Top Right (only when selected and not in focus mode) */}
          {showEditingControls && (
            <div className="absolute top-4 right-4 flex gap-1 bg-black/60 backdrop-blur-sm border border-primary/30 rounded-lg p-1 z-20">
              {(Object.keys(SIZE_LABELS) as CarouselSize[]).map((sizeOption) => (
                <button
                  key={sizeOption}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSizeChange(sizeOption);
                  }}
                  className={`
                    w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all
                    ${size === sizeOption
                      ? 'bg-primary text-white'
                      : 'text-white/70 hover:bg-white/20 hover:text-white'
                    }
                  `}
                  title={`Tamaño ${sizeOption === 'small' ? 'pequeño' : sizeOption === 'medium' ? 'mediano' : 'grande'}`}
                >
                  {SIZE_LABELS[sizeOption]}
                </button>
              ))}
            </div>
          )}

          {/* Add Image Button - Bottom Right (only when selected/editing and not in focus mode) */}
          {showEditingControls && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAddImage}
                className="hidden"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={isUploading}
                className="absolute bottom-4 right-4 w-10 h-10 bg-primary/90 backdrop-blur-sm border border-primary/50 rounded-lg flex items-center justify-center transition-all hover:bg-primary hover:scale-110 z-20"
                aria-label="Añadir imagen al carrousel"
              >
                {isUploading ? (
                  <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
            </>
          )}

          {/* Navigation Buttons - Only show if more than 1 image */}
          {images.length > 1 && (
            <>
              {/* Previous Button */}
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/70 backdrop-blur-sm border border-primary/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/90 hover:border-primary/80 hover:scale-110 z-10"
                aria-label="Imagen anterior"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Next Button */}
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/70 backdrop-blur-sm border border-primary/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/90 hover:border-primary/80 hover:scale-110 z-10"
                aria-label="Siguiente imagen"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/30 text-white text-sm font-medium z-10">
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Button (only in edit mode when selected and not in focus mode) */}
      {showEditingControls && (
        <button
          onClick={deleteNode}
          className="absolute -top-2 -right-2 w-8 h-8 bg-error text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-30"
          aria-label="Eliminar carrousel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Lightbox Modal - Rendered via Portal to escape NodeViewWrapper */}
      {lightboxOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <img
              src={images[currentIndex]}
              alt={`Imagen ${currentIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-primary/80 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {images.length > 1 && (
              <>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-primary/80 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-primary/80 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </NodeViewWrapper>
  );
}
