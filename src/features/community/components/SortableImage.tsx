'use client';

// ============================================
// SortableImage — LA ficha de la bandeja de medios del composer
// ============================================
// El nombre es histórico (nació para imágenes). Hoy pinta CUALQUIER medio del
// post con la misma piel: imagen, GIF, video embebido (video propio/YouTube/Vimeo/
// Loom) y archivo (PDF, zip, código). Todas son el mismo cuadrado de 192px con
// el mismo scrim, los mismos botones (ampliar · quitar) y el mismo arrastre.
//
// Por qué una sola ficha: antes el video y el GIF vivían FUERA de la lista
// ordenable, con su propia "×" morada de otro tamaño, y aparecían después del
// botón "+". Ahora todo se arrastra, se reordena y comparte sistema de diseño.

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from 'next/image';
import { PostAttachment } from '../types';
import { VideoEmbed } from '@/shared/components/VideoEmbed';
import { videoProviderLabel } from '@/shared/utils/videoUrl';
import { VIDEO_EMBED_TYPE } from '@/shared/utils/mediaType';

interface SortableImageProps {
  attachment: PostAttachment;
  index: number;
  onRemove: (index: number) => void;
  onExpand?: (attachment: PostAttachment) => void;
}

/** Tamaño estándar de la ficha. El botón "+" de la bandeja usa el mismo. */
export const MEDIA_TILE_CLASS = 'w-48 h-48';

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Etiqueta abajo-izquierda: GIF · video propio · YouTube · PDF… (misma pieza para todas). */
function TileBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-3xs font-semibold tracking-wide uppercase text-white pointer-events-none">
      {children}
    </div>
  );
}

/** Botón redondo de acción (ampliar / quitar): uno solo para toda la bandeja. */
function TileButton({
  onClick,
  title,
  danger = false,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      // El pointerdown no llega al sensor de arrastre: tocar el botón nunca
      // empieza un drag.
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-7 h-7 bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-colors shadow-lg ${
        danger ? 'hover:bg-error' : 'hover:bg-black/80'
      }`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

export function SortableImage({ attachment, index, onRemove, onExpand }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attachment.url });

  const style = {
    transform: transform
      ? `${CSS.Transform.toString(transform)} ${isDragging ? 'scale(1.05) rotate(2deg)' : ''}`
      : undefined,
    transition: transition || 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isDragging ? 0.5 : 1,
    filter: isDragging ? 'blur(2px)' : 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 1000 : 'auto',
    // touch-action manipulation: permite scroll/tap normal; el drag entra por
    // long-press (TouchSensor con delay) sin pelear con el scroll horizontal
    touchAction: 'manipulation' as const,
  };

  const isImage = attachment.type.startsWith('image/');
  const isGif = attachment.type === 'image/gif';
  const isVideo = attachment.type === VIDEO_EMBED_TYPE;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex-shrink-0 ${MEDIA_TILE_CLASS} bg-secondary/50 rounded-lg overflow-hidden transition-all ${
        isDragging
          ? 'shadow-[0_20px_40px_rgba(138,43,226,0.4)] border-2 border-primary'
          : 'hover:scale-[1.02] hover:shadow-lg'
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Cuerpo de la ficha. pointer-events-none: el arrastre lo captura la
          ficha entera, nunca el <img>/<iframe> de adentro. */}
      {isVideo ? (
        <div className="relative w-full h-full pointer-events-none">
          {/* disablePlay: en la bandeja el video no reproduce, solo se ve y se
              ordena. !opacity-100: la miniatura compacta del feed se atenúa a
              .72 a propósito; aquí va al 100% como las demás fichas. */}
          <VideoEmbed url={attachment.url} compact fill disablePlay className="!opacity-100" />
        </div>
      ) : isImage ? (
        <div className="relative w-full h-full pointer-events-none">
          {isGif ? (
            // GIF (Giphy): <img> plano para que el loop se vea en la ficha —
            // next/image congelaría/optimizaría el primer cuadro.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.url} alt={attachment.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Image
              src={attachment.url}
              alt={attachment.name}
              fill
              sizes="192px"
              className="object-cover"
              loading="lazy"
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-muted p-3 pointer-events-none">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {attachment.type === 'application/pdf' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            )}
          </svg>
          <p className="text-xs text-center truncate w-full px-2">
            {attachment.name.length > 15 ? attachment.name.substring(0, 12) + '...' : attachment.name}
          </p>
          <p className="text-3xs text-muted/70">
            {formatFileSize(attachment.size)}
          </p>
        </div>
      )}

      {/* Scrim + acciones — SIEMPRE visibles. Antes vivían tras opacity-0 +
          group-hover (hover no existe en touch): en móvil eran literalmente
          invisibles y no había forma de quitar/ampliar una imagen (hallazgo
          #4 del audit). */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent pointer-events-none rounded-t-lg" />
      <div className="absolute top-1.5 right-1.5 flex gap-1.5">
        {isImage && onExpand && (
          <TileButton onClick={() => onExpand(attachment)} title="Ampliar">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </TileButton>
        )}
        <TileButton onClick={() => onRemove(index)} title={isVideo ? 'Quitar video' : isGif ? 'Quitar GIF' : 'Quitar adjunto'} danger>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </TileButton>
      </div>

      {/* Etiqueta del tipo: la misma pieza para GIF y para el proveedor del video */}
      {isGif && <TileBadge>GIF</TileBadge>}
      {isVideo && <TileBadge>{videoProviderLabel(attachment.url)}</TileBadge>}

      {/* Dragging indicator overlay */}
      {isDragging && (
        <div className="absolute inset-0 border-2 border-dashed border-primary bg-primary/10 rounded-lg pointer-events-none" />
      )}
    </div>
  );
}
