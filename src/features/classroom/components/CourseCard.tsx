'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { sbImage } from '@/shared/lib/sbImage';
import { prefetchFull } from '@/shared/lib/prefetchFull';
import { Course, CourseAccessType } from '../types';
import { getAccessBadgeInfo, AccessCheckResult } from '../services/classroomService';

interface CourseCardProps {
  course: Course;
  progress?: number;
  /** Lecciones publicadas que ESTE usuario ve en el curso (getVisibleLessonCounts). Real, no inventado. */
  lessonCount?: number;
  /** Lecciones que ESTE usuario ya completó en el curso (getCompletedLessonsByCourse). Real, no inventado. */
  completedCount?: number;
  isAdmin?: boolean;
  accessResult?: AccessCheckResult;
  onEdit?: (course: Course) => void;
  onDelete?: (courseId: string) => void;
  onClick?: (course: Course) => void;
  onLockedClick?: (course: Course) => void;
  isDragging?: boolean;
}

export function CourseCard({
  course,
  progress = 0,
  lessonCount,
  completedCount,
  isAdmin = false,
  accessResult,
  onEdit,
  onDelete,
  onClick,
  onLockedClick,
  isDragging = false
}: CourseCardProps) {
  // Determine if course is locked based on access result
  const hasAccess = accessResult?.hasAccess ?? true;
  const isLocked = !hasAccess && !isAdmin;

  // LEY VISUAL §1.1 — la regla del ámbar: solo es ámbar lo que YA es tuyo
  // (desbloqueado) y tiene una señal real que mostrar. Un curso bloqueado
  // nunca es ámbar (todavía no es tuyo); uno desbloqueado con 0% tampoco
  // (progreso cero no es un logro que celebrar) — ese va neutro.
  const isComplete = !isLocked && progress >= 100;
  const inProgress = !isLocked && progress > 0 && progress < 100;

  // La tarjeta es un <div onClick> (lo pide el drag&drop y el menú de admin),
  // así que Next nunca prefetcheó la ruta del curso: cada clic pagaba la carga
  // fría completa. Con el prefetch al pasar el mouse, la ruta ya está en el
  // caché del router cuando el dedo baja. Una sola vez por tarjeta.
  const router = useRouter();
  const prefetchedRef = useRef(false);

  const prefetchCourse = () => {
    if (prefetchedRef.current || isLocked) return;
    prefetchedRef.current = true;
    prefetchFull(router, `/classroom/${course.id}`);
  };

  const handleCardClick = () => {
    if (isLocked && onLockedClick) {
      onLockedClick(course);
    } else if (onClick) {
      onClick(course);
    }
  };
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit?.(course);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirm('¿Estás seguro de que quieres eliminar este curso?')) {
      onDelete?.(course.id);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={prefetchCourse}
      onFocus={prefetchCourse}
      className={`
        group relative sup sup-i cursor-pointer overflow-hidden
        ${isComplete ? 'es-tuyo-filo' : ''}
        ${isDragging ? 'opacity-50 scale-105' : ''}
        ${!course.published ? 'opacity-75' : ''}
      `}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden border-b border-border-subtle bg-surface-elevated">
        {course.thumbnail_url ? (
          <Image
            /* Transformación en el CDN de Supabase: el original pesa hasta
               1.8 MB; aquí baja ~26x antes de tocar el optimizador de Next.
               1200 y no 800 porque la tarjeta mide ~381 px CSS y en retina
               pide 762 reales (más en pantallas anchas): con 800 de techo el
               optimizador nunca podía servir nítido. Medido: 1200 en contain
               pesa 69.8 KB, lo mismo que los 65.7 KB del 800 recortado. */
            src={sbImage(course.thumbnail_url, { width: 1200, quality: 78 })}
            alt={course.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            priority={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <span className="text-4xl">📚</span>
          </div>
        )}


        {/* Locked overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <svg className="w-10 h-10 text-primary mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            {/* Show specific lock reason */}
            <span className="text-white text-sm font-medium text-center px-2">
              {accessResult?.reason === 'level_too_low' && `Level ${accessResult.requiredLevel} Required`}
              {accessResult?.reason === 'time_not_reached' && accessResult.requiredDays !== undefined && accessResult.currentDays !== undefined &&
                `Se desbloquea en ${accessResult.requiredDays - accessResult.currentDays} días`}
              {accessResult?.reason === 'level_and_time_required' && accessResult.requiredDays !== undefined && accessResult.currentDays !== undefined &&
                `Se desbloquea en ${accessResult.requiredDays - accessResult.currentDays} días`}
              {accessResult?.reason === 'not_purchased' && `$${((accessResult.priceCents || 0) / 100).toFixed(2)}`}
              {accessResult?.reason === 'private' && 'VIP Exclusive'}
              {!accessResult?.reason && 'Locked'}
            </span>
          </div>
        )}

        {/* Access Badge - show for non-open courses */}
        {(() => {
          const badgeInfo = getAccessBadgeInfo(course);
          if (!course.published) {
            return (
              <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-warning text-warning-foreground rounded">
                Draft
              </span>
            );
          }

          // Hide Requirement/Premium/Private badges when already unlocked (as requested by user)
          const isPremiumMonthBadge = badgeInfo?.label?.includes('Premium Mes');
          const isLevelBadge = badgeInfo?.label?.includes('Level');
          const isPrivateBadge = badgeInfo?.label === 'Private';

          if (badgeInfo && !isLocked && !isPremiumMonthBadge && !isLevelBadge && !isPrivateBadge) {
            const colorClasses = {
              primary: 'bg-primary/20 text-primary',
              warning: 'bg-warning/20 text-warning',
              error: 'bg-error/20 text-error',
              success: 'bg-success/20 text-success'
            };
            return (
              <span className={`absolute top-3 left-3 px-2 py-1 text-xs font-medium rounded-lg flex items-center gap-1 shadow-elevation-xs ${colorClasses[badgeInfo.color]}`}>
                <span>{badgeInfo.icon}</span>
                <span>{badgeInfo.label}</span>
              </span>
            );
          }
          return null;
        })()}

        {/* Admin menu button */}
        {isAdmin && (
          <div ref={menuRef} className="absolute top-3 right-3">
            <button
              onClick={handleMenuClick}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="18" r="2" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 sup-2 py-1 z-50">
                <button
                  onClick={handleEdit}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 transition-colors"
                >
                  Editar curso
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 transition-colors"
                >
                  Eliminar curso
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="text-base font-semibold text-foreground line-clamp-2">
          {course.title}
        </h3>

        {/* Descripción real del curso (columna `courses.description`). Si no
            existe, no se muestra nada — nunca se inventa un resumen. */}
        {course.description && (
          <p className="text-sm text-muted line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Cuántas lecciones tiene, dato real de getVisibleLessonCounts.
            No hay campo de duración en courses/lessons — no se inventa. */}
        {!!lessonCount && (
          <p className="text-2xs text-muted">
            {lessonCount} {lessonCount === 1 ? 'lección' : 'lecciones'}
          </p>
        )}

        {/* LEY VISUAL §1.1/§5 — la regla del ámbar:
            - Bloqueado → nada aquí (el candado de arriba ya dice por qué).
            - Desbloqueado sin empezar → nada aquí (0% no es un logro).
            - En curso → .es-vivo pleno, es lo que está pasando ahora.
            - Completado → .es-tuyo atenuado + el filo de la tarjeta (arriba). */}
        {isComplete ? (
          <div className="flex items-center gap-1.5 pt-0.5">
            <svg className="w-3.5 h-3.5 es-tuyo flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-2xs es-tuyo font-medium">Completado</span>
          </div>
        ) : inProgress ? (
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--gold)' }}
              />
            </div>
            <span className="text-2xs es-vivo font-medium">
              {typeof completedCount === 'number' && lessonCount
                ? `${completedCount}/${lessonCount}`
                : `${progress}%`}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
