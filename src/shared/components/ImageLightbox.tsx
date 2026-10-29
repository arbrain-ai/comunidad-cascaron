'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  // Filter out empty strings and validate
  const validImages = useMemo(() => images.filter((img) => img && img.trim() !== ''), [images]);

  // Reset index and zoom when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoom(1);
    }
  }, [isOpen, initialIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          setCurrentIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1));
          break;
        case 'ArrowRight':
          setCurrentIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0));
          break;
        case '+':
        case '=':
          setZoom((prev) => Math.min(prev + 0.25, 3));
          break;
        case '-':
        case '_':
          setZoom((prev) => Math.max(prev - 0.25, 0.5));
          break;
        case '0':
          setZoom(1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, validImages, onClose]);

  // Prevent body scroll when open
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

  // Reset zoom when changing images
  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  // Early return if not open or no valid images
  if (!isOpen || validImages.length === 0) return null;

  // Ensure currentIndex is within bounds
  const safeIndex = Math.min(Math.max(0, currentIndex), validImages.length - 1);
  const currentImage = validImages[safeIndex] || '';

  if (!currentImage) return null;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0));
  };

  const zoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#050505]/95 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Top buttons - with safe-area for mobile notch */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex items-center gap-2 pt-2">
        {/* Download button */}
        <a
          href={currentImage}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-white/80 hover:text-white bg-[#050505]/60 hover:bg-primary/30 border border-primary/20 hover:border-primary/40 rounded-full transition-colors backdrop-blur-sm"
          title="Descargar"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
        {/* Close button */}
        <button
          onClick={onClose}
          className="p-2 text-white/80 hover:text-white bg-[#050505]/60 hover:bg-primary/30 border border-primary/20 hover:border-primary/40 rounded-full transition-colors backdrop-blur-sm"
          title="Cerrar (Esc)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Zoom controls - with safe-area for mobile notch */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-10 flex flex-col items-center gap-2 pt-2">
        {/* Zoom in */}
        <button
          onClick={zoomIn}
          disabled={zoom >= 3}
          className="p-2 text-white/80 hover:text-white bg-[#050505]/60 hover:bg-primary/30 border border-primary/20 hover:border-primary/40 rounded-full transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom In (+)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>

        {/* Zoom level indicator */}
        <div className="px-2 py-1 bg-[#050505]/70 border border-primary/20 rounded-full text-white/80 text-xs backdrop-blur-sm min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </div>

        {/* Reset zoom */}
        <button
          onClick={resetZoom}
          disabled={zoom === 1}
          className="p-2 text-white/80 hover:text-white bg-[#050505]/60 hover:bg-primary/30 border border-primary/20 hover:border-primary/40 rounded-full transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reset Zoom (0)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Zoom out */}
        <button
          onClick={zoomOut}
          disabled={zoom <= 0.5}
          className="p-2 text-white/80 hover:text-white bg-[#050505]/60 hover:bg-primary/30 border border-primary/20 hover:border-primary/40 rounded-full transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom Out (-)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
      </div>

      {/* Navigation arrows */}
      {validImages.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 bottom-1/2 translate-y-1/2 z-10 p-3 text-white/80 hover:text-white bg-[#050505]/60 hover:bg-primary/30 border border-primary/20 hover:border-primary/40 rounded-full transition-colors backdrop-blur-sm"
            title="Anterior (←)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 bottom-1/2 translate-y-1/2 z-10 p-3 text-white/80 hover:text-white bg-[#050505]/60 hover:bg-primary/30 border border-primary/20 hover:border-primary/40 rounded-full transition-colors backdrop-blur-sm"
            title="Siguiente (→)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Image container with zoom */}
      <div className="relative w-[90vw] h-[90vh] flex items-center justify-center overflow-auto">
        <div
          className="relative transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
            minWidth: zoom > 1 ? '100%' : 'auto',
            minHeight: zoom > 1 ? '100%' : 'auto',
          }}
        >
          <div className="relative w-[90vw] h-[90vh]">
            <Image
              src={currentImage}
              alt={`Imagen ${safeIndex + 1}`}
              fill
              sizes="90vw"
              className="object-contain rounded-lg shadow-2xl"
              priority={true}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </div>

      {/* Image counter */}
      {validImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[#050505]/70 border border-primary/20 rounded-full text-white/80 text-sm backdrop-blur-sm">
          {safeIndex + 1} / {validImages.length}
        </div>
      )}
    </div>
  );
}
