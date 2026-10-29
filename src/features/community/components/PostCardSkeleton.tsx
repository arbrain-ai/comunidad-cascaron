'use client';

/**
 * Skeleton con la MISMA silueta que PostCard (avatar + 2 líneas de meta,
 * título, 2 líneas de contenido, thumbnail, fila de acciones).
 * Reemplaza al spinner único que borraba todo el feed (hallazgo #8 del audit):
 * el layout no salta cuando llegan los posts reales.
 */
export function PostCardSkeleton() {
  return (
    <div className="sup p-3 md:p-5 space-y-2.5 md:space-y-4 animate-pulse">
      {/* Header: avatar + nombre/meta */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-surface-elevated flex-shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="h-3.5 w-32 bg-surface-elevated rounded" />
          <div className="h-2.5 w-24 bg-surface-elevated rounded" />
        </div>
      </div>
      {/* Título + contenido + thumbnail */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-5 w-3/4 bg-surface-elevated rounded" />
          <div className="h-3.5 w-full bg-surface-elevated rounded" />
          <div className="h-3.5 w-5/6 bg-surface-elevated rounded" />
        </div>
        <div className="w-[76px] h-[43px] rounded-lg bg-surface-elevated flex-shrink-0" />
      </div>
      {/* Acciones */}
      <div className="flex items-center gap-4 pt-0.5">
        <div className="h-4 w-10 bg-surface-elevated rounded" />
        <div className="h-4 w-10 bg-surface-elevated rounded" />
        <div className="h-4 w-6 bg-surface-elevated rounded" />
      </div>
    </div>
  );
}
