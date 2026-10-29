'use client';

/**
 * Skeletons del Classroom — siluetas reales (mismo patrón que PostCardSkeleton
 * de Community): el layout se pinta de inmediato y la data lo rellena después.
 * Nada de spinners que tapan la página completa.
 */

/** Silueta de CourseCard: thumbnail 16:9 + título + barra de progreso */
export function CourseCardSkeleton() {
  return (
    <div className="sup overflow-hidden animate-pulse" aria-hidden="true">
      <div className="aspect-video w-full bg-surface-elevated border-b border-border-subtle" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 bg-surface-elevated rounded" />
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface-elevated rounded-full" />
          <div className="h-3 w-7 bg-surface-elevated rounded" />
        </div>
      </div>
    </div>
  );
}

/** Grid de skeletons con las mismas columnas que CourseGrid */
export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
      role="status"
      aria-label="Cargando cursos"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Silueta del sidebar de lecciones (solo desktop; en móvil arranca colapsado) */
function CourseSidebarSkeleton() {
  return (
    <div className="hidden md:block flex-shrink-0 h-full animate-pulse" style={{ width: 340 }} aria-hidden="true">
      <div className="h-full p-4 space-y-4 border-r border-glass">
        {/* Back + título del curso */}
        <div className="h-4 w-24 bg-surface-elevated rounded" />
        <div className="h-6 w-4/5 bg-surface-elevated rounded" />
        {/* Barra de progreso */}
        <div className="h-2 w-full bg-surface-elevated rounded-full" />
        {/* Lista de lecciones */}
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5">
              <div className="w-5 h-5 rounded-full bg-surface-elevated flex-shrink-0" />
              <div className={`h-3.5 bg-surface-elevated rounded ${i % 3 === 0 ? 'w-4/5' : i % 3 === 1 ? 'w-3/5' : 'w-2/3'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Silueta de la vista de curso completa: sidebar + header de lección + contenido */
export function CourseViewSkeleton() {
  return (
    <div
      className="font-sans flex overflow-hidden relative h-[calc(100dvh-124px-var(--sat))] md:h-[calc(100vh-80px)]"
      role="status"
      aria-label="Cargando curso"
    >
      <CourseSidebarSkeleton />
      <div className="flex-1 flex flex-col overflow-hidden md:m-4 md:ml-2 md:rounded-xl bg-card md:border md:border-glass-strong animate-pulse">
        {/* Header: título de lección + botones circulares */}
        <div className="px-4 py-4 md:px-8 md:py-6 border-b border-glass flex items-center justify-between">
          <div className="h-7 w-56 max-w-[60%] bg-surface-elevated rounded" />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-surface-elevated" />
            <div className="w-10 h-10 rounded-full bg-surface-elevated" />
          </div>
        </div>
        {/* Contenido: bloque de video/embed + líneas de texto */}
        <div className="flex-1 overflow-hidden px-4 py-4 md:px-8 md:py-6 space-y-4">
          <div className="aspect-video w-full max-w-3xl bg-surface-elevated rounded-xl" />
          <div className="h-4 w-full max-w-2xl bg-surface-elevated rounded" />
          <div className="h-4 w-5/6 max-w-2xl bg-surface-elevated rounded" />
          <div className="h-4 w-2/3 max-w-2xl bg-surface-elevated rounded" />
        </div>
      </div>
    </div>
  );
}
