'use client';

import { useRef, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { PostAttachment } from '../types';
import { uploadPostAttachment } from '@/shared/lib/supabaseStorage';
import { ImageLightbox } from '@/shared/components/ImageLightbox';
import { SortableImage, MEDIA_TILE_CLASS } from './SortableImage';

// La BANDEJA DE MEDIOS del composer: una sola lista ordenable donde imagenes,
// GIFs, videos embebidos y archivos son fichas iguales (SortableImage). El
// video y el GIF entran a `attachments` desde los botones del composer
// (VideoUrlModal / GifPicker); aqui solo se suben archivos y se ordena todo.
interface AttachmentUploaderProps {
  userId: string;
  attachments: PostAttachment[];
  onAttachmentsChange: (attachments: PostAttachment[]) => void;
  maxFiles?: number;
  inline?: boolean; // Render without container, for unified media row
}

export function AttachmentUploader({
  userId,
  attachments,
  onAttachmentsChange,
  maxFiles = 10,
  inline = false,
}: AttachmentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sensores separados por dispositivo (hallazgo #4 del audit):
  // - Mouse: 8px de distancia antes de activar drag (evita drags accidentales)
  // - Touch: LONG-PRESS de 250ms para arrastrar. Antes PointerSensor con
  //   distance activaba el drag con cualquier swipe y peleaba con el scroll
  //   horizontal del carrusel de imágenes; ahora scroll = swipe normal,
  //   reordenar = mantener presionado y arrastrar (patrón estándar móvil).
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    })
  );

  // Handle drag end - reorder attachments
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = attachments.findIndex(a => a.url === active.id);
      const newIndex = attachments.findIndex(a => a.url === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedAttachments = arrayMove(attachments, oldIndex, newIndex);
        onAttachmentsChange(reorderedAttachments);
      }
    }
  }, [attachments, onAttachmentsChange]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // Check max files limit
    if (attachments.length + fileArray.length > maxFiles) {
      setError(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const newAttachments: PostAttachment[] = [];
      const total = fileArray.length;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const label = total > 1 ? ` (${i + 1}/${total})` : '';
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        const isLarge = file.size > 3 * 1024 * 1024; // >3MB

        if (isLarge) {
          setUploadStatus(`Comprimiendo${label} ${sizeMB}MB...`);
        } else {
          setUploadStatus(`Subiendo${label}...`);
        }

        const result = await uploadPostAttachment(userId, file, (status) => {
          setUploadStatus(status);
        });
        newAttachments.push(result);
      }

      setUploadStatus('');
      onAttachmentsChange([...attachments, ...newAttachments]);
    } catch (err) {
      setUploadStatus('');
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
    } finally {
      setIsUploading(false);
    }
  }, [userId, attachments, onAttachmentsChange, maxFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input
      e.target.value = '';
    }
  }, [handleFiles]);

  const handleRemove = useCallback((index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  }, [attachments, onAttachmentsChange]);

  // Get images for lightbox
  const images = attachments.filter(a => a.type.startsWith('image/'));

  // Handle image lightbox
  const handleImageClick = (attachment: PostAttachment) => {
    const imageIndex = images.findIndex(img => img.url === attachment.url);
    if (imageIndex !== -1) {
      setLightboxIndex(imageIndex);
      setLightboxOpen(true);
    }
  };

  // Render add button
  const renderAddButton = () => (
    attachments.length < maxFiles ? (
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`flex-shrink-0 ${MEDIA_TILE_CLASS} flex flex-col items-center justify-center bg-secondary/20 hover:bg-secondary/40 border-2 border-dashed border-border/50 hover:border-primary/50 rounded-lg transition-colors`}
        title="Agregar archivos"
        aria-label="Agregar archivos"
      >
        <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    ) : null
  );

  // Inline mode - render just the elements without container
  if (inline) {
    return (
      <>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          className="hidden"
          accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.gif,.webp,.pdf,.epub,.json,.txt,.js,.ts,.css,.html,.md,.zip"
        />

        {/* Sortable Attachments with DndContext */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={attachments.map(a => a.url)}
            strategy={rectSortingStrategy}
          >
            {attachments.map((attachment, index) => (
              <SortableImage
                key={attachment.url}
                attachment={attachment}
                index={index}
                onRemove={handleRemove}
                onExpand={handleImageClick}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add button */}
        {renderAddButton()}

        {/* Status / error feedback (visible en inline: antes se tragaba el error) */}
        {(isUploading || error) && (
          <p className={`flex-shrink-0 self-center whitespace-nowrap text-sm ${error ? 'text-red-500' : 'text-muted'}`}>
            {error || uploadStatus || 'Subiendo...'}
          </p>
        )}

        {/* Image Lightbox */}
        <ImageLightbox
          images={images.map(img => img.url)}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // Standard mode with full container
  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChange}
        className="hidden"
        accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.gif,.webp,.pdf,.epub,.json,.txt,.js,.ts,.css,.html,.md,.zip"
      />

      {/* Drop zone - only show when no attachments */}
      {attachments.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border/50 hover:border-primary/50 hover:bg-secondary/20'
            }
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-sm text-muted">
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {uploadStatus || 'Subiendo...'}
                </span>
              ) : (
                <>
                  <span className="font-medium text-foreground">Click o arrastra</span>
                  {' '}para subir archivos
                </>
              )}
            </div>
            <p className="text-xs text-muted">
              Imágenes, PDFs, JSON, código (máx. 10MB)
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Attachments - horizontal scroll with square thumbnails */}
      {attachments.length > 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex gap-3 overflow-x-auto pb-2 ${isDragging ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}`}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={attachments.map(a => a.url)}
              strategy={rectSortingStrategy}
            >
              {attachments.map((attachment, index) => (
                <SortableImage
                  key={attachment.url}
                  attachment={attachment}
                  index={index}
                  onRemove={handleRemove}
                  onExpand={handleImageClick}
                />
              ))}
            </SortableContext>
          </DndContext>
          {renderAddButton()}
        </div>
      )}

      {/* Uploading indicator when adding to existing */}
      {isUploading && attachments.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Subiendo...
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        images={images.map(img => img.url)}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
