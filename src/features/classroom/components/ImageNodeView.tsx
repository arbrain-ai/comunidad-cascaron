'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useFocusModeSafe } from '@/shared/contexts/FocusModeContext';

type ImageSize = 'small' | 'medium' | 'large';

const SIZE_CLASSES: Record<ImageSize, string> = {
  small: 'max-w-md',
  medium: 'max-w-2xl',
  large: 'w-full',
};

const SIZE_LABELS: Record<ImageSize, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
};

export function ImageNodeView({ node, deleteNode, selected, updateAttributes }: NodeViewProps) {
  const { src, alt, size = 'medium' } = node.attrs;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { isFocusMode } = useFocusModeSafe();

  // In focus mode, hide editing controls for clean presentation
  const showEditingControls = selected && !isFocusMode;

  if (!src) {
    return (
      <NodeViewWrapper>
        <div className="p-4 border-2 border-dashed border-primary/30 rounded-lg text-center text-muted">
          Imagen sin URL
        </div>
      </NodeViewWrapper>
    );
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxOpen(true);
  };

  const handleSizeChange = (newSize: ImageSize) => {
    updateAttributes({ size: newSize });
  };

  // Wrapper class based on size - w-fit + mx-auto for S/M so selection border fits the image
  const wrapperClass = size === 'large'
    ? 'relative group w-full'
    : 'relative group w-fit mx-auto';

  return (
    <NodeViewWrapper
      className={wrapperClass}
      data-drag-handle
      draggable="true"
      contentEditable={false}
    >
      {/* Image Container with dynamic size */}
      <div className={`relative rounded-xl overflow-hidden border border-primary/20 ${SIZE_CLASSES[size as ImageSize]}`}>
        <img
          src={src}
          alt={alt || 'Imagen'}
          className="w-full h-auto max-h-[600px] object-contain"
          style={{ userSelect: 'none' }}
        />

        {/* Expand Button - Bottom Left */}
        <button
          onClick={handleExpandClick}
          className="absolute bottom-4 left-4 w-10 h-10 bg-black/60 backdrop-blur-sm border border-primary/30 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/80 hover:border-primary/60 z-20"
          aria-label="Expandir imagen"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>

        {/* Size Selector - Bottom Right (only when selected and not in focus mode) */}
        {showEditingControls && (
          <div className="absolute bottom-4 right-4 flex gap-1 bg-black/60 backdrop-blur-sm border border-primary/30 rounded-lg p-1 z-20">
            {(Object.keys(SIZE_LABELS) as ImageSize[]).map((sizeOption) => (
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
      </div>

      {/* Delete Button (only in edit mode when selected and not in focus mode) */}
      {showEditingControls && (
        <button
          onClick={deleteNode}
          className="absolute -top-2 -right-2 w-8 h-8 bg-error text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-30"
          aria-label="Eliminar imagen"
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
              src={src}
              alt={alt || 'Imagen'}
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
          </div>
        </div>,
        document.body
      )}
    </NodeViewWrapper>
  );
}
