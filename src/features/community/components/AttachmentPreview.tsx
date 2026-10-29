'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PostAttachment } from '../types';
import { ImageLightbox } from '@/shared/components/ImageLightbox';
import { isFileMedia } from '@/shared/utils/mediaType';

interface AttachmentPreviewProps {
  attachments: PostAttachment[];
  /**
   * Cuantas fichas se ven antes de resumir el resto en un "+N".
   *
   * En el FEED la tarjeta es una fila corta: seis PDFs apilados la estiraban
   * al triple y empujaban los demas posts fuera de la pantalla. Ahi va 1, y el
   * resto se cuenta — mismo gesto que el "+N" de las imagenes. Dentro del post
   * se omite la prop y se listan todos, que es donde el miembro los baja.
   */
  maxVisible?: number;
}

export function AttachmentPreview({ attachments, maxVisible }: AttachmentPreviewProps) {
  // NOTE: This component only shows NON-IMAGE files (PDFs, docs, etc.)
  // Images are handled separately in PostCardContent via the "Media Images" section
  // to avoid duplicate rendering of images

  if (!attachments || attachments.length === 0) return null;

  // Get file extension for display
  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  };

  // Get color based on file type (Skool style)
  const getFileColor = (type: string) => {
    if (type === 'application/pdf') return 'bg-red-500';
    if (type.includes('word') || type.includes('document')) return 'bg-blue-500';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'bg-green-500';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'bg-orange-500';
    if (type.includes('zip') || type.includes('archive')) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Solo archivos descargables: ni imagenes (rejilla) ni videos embebidos
  // (VideoEmbed) — sin este filtro una URL de YouTube salia como "archivo".
  const files = attachments.filter(isFileMedia);

  // Return null if no files to show
  if (files.length === 0) return null;

  const visibles = maxVisible && maxVisible > 0 ? files.slice(0, maxVisible) : files;
  const ocultos = files.length - visibles.length;

  return (
    <div className="space-y-3">
      {/* Files - Skool style compact cards */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibles.map((file) => (
            <a
              key={file.url}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="group flex items-center gap-3 px-3 py-2.5 bg-surface hover:bg-surface-elevated border border-border rounded-lg transition-all hover:border-primary/30 hover:shadow-sm"
            >
              {/* File icon with color */}
              <div className={`w-10 h-10 ${getFileColor(file.type)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-xs font-bold">
                  {getFileExtension(file.name)}
                </span>
              </div>

              {/* File info */}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate max-w-[180px] group-hover:text-primary transition-colors">
                  {file.name}
                </span>
                {formatFileSize(file.size) && (
                  <span className="text-xs text-muted">
                    {formatFileSize(file.size)}
                  </span>
                )}
              </div>

              {/* Download icon */}
              <svg
                className="w-4 h-4 text-muted group-hover:text-primary transition-colors flex-shrink-0 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          ))}

          {/* Resto colapsado. No es link: en el feed el click es de la tarjeta,
              que abre el post — ahi estan los archivos completos. */}
          {ocultos > 0 && (
            <span className="flex items-center gap-2 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm font-medium text-muted select-none">
              <span className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center flex-shrink-0 text-foreground text-xs font-bold">
                +{ocultos}
              </span>
              {ocultos === 1 ? 'archivo más' : 'archivos más'}
            </span>
          )}
        </div>
      )}

    </div>
  );
}
