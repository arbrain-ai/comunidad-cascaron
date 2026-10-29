'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasAdminAccess } from '@/shared/constants/roles';
import { CourseGrid } from '@/features/classroom/components/CourseGrid';
import { CourseGridSkeleton } from '@/features/classroom/components/CourseSkeletons';
import { CourseModal } from '@/features/classroom/components/CourseModal';
import { LockedCourseModal } from '@/features/classroom/components/LockedCourseModal';
import { Course } from '@/features/classroom/types';
import {
  getCourses,
  getCompletedLessonsByCourse,
  getVisibleLessonCounts,
  buildProgressMap,
  fetchAccessContext,
  resolveCoursesAccess,
  createCourse,
  updateCourse,
  deleteCourse,
  reorderCourses,
  AccessCheckResult,
  AccessContext,
} from '@/features/classroom/services/classroomService';
import { CourseAccessType, UserTier } from '@/features/classroom/types';
import { getCached, setCached } from '@/shared/lib/queryCache';
import { prefetchFull } from '@/shared/lib/prefetchFull';

interface ClassroomSnapshot {
  courses: Course[];
  progressMap: Record<string, number>;
  accessResultsMap: Record<string, AccessCheckResult>;
  lessonCountsMap: Record<string, number>;
  completedCountsMap: Record<string, number>;
}

export default function ClassroomPage() {
  const router = useRouter();
  const { userProfile } = useUserProfile();

  const isAdmin = hasAdminAccess(userProfile?.role || '');
  const cacheKey = `classroom:${isAdmin}:u${userProfile?.id || 'anon'}`;

  // Paint-first: al volver al classroom los cursos pintan al instante desde
  // el caché de módulo y se revalidan en silencio detrás (cero holo-carga).
  const initialCache = getCached<ClassroomSnapshot>(userProfile?.id ? cacheKey : null);
  const [courses, setCourses] = useState<Course[]>(initialCache?.data.courses ?? []);
  const [progressMap, setProgressMap] = useState<Record<string, number>>(initialCache?.data.progressMap ?? {});
  const [accessResultsMap, setAccessResultsMap] = useState<Record<string, AccessCheckResult>>(
    initialCache?.data.accessResultsMap ?? {}
  );
  const [lessonCountsMap, setLessonCountsMap] = useState<Record<string, number>>(
    initialCache?.data.lessonCountsMap ?? {}
  );
  const [completedCountsMap, setCompletedCountsMap] = useState<Record<string, number>>(
    initialCache?.data.completedCountsMap ?? {}
  );
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [lockedCourse, setLockedCourse] = useState<Course | null>(null);

  // ── La carga del Classroom, en paralelo de verdad ──────────────────────
  //
  // Antes esto era una cascada de tres round-trips EN SERIE que ni siquiera
  // arrancaba hasta que el UserProfileContext terminaba el suyo:
  //   perfil → cursos → lecciones → progreso   (los cursos pintaban a ~1.7s)
  //
  // Ahora son dos frentes que corren a la vez y se juntan al final:
  //
  //   [al montar]        cursos      → qué cursos hay (publicados)
  //   [al saber quién]   lecciones   → cuántas VE ESTE usuario, por curso
  //                      progreso    → cuáles completó
  //                      acceso      → su contexto de compras/grants
  //
  // La lista de cursos NO espera al perfil: pedir los publicados no depende de
  // quién seas. Solo un admin necesita una segunda pasada para ver borradores,
  // y son dos personas.
  //
  // ⚠️ Esto se intentó primero como ruta de servidor cacheada (/api/classroom/
  // catalog) y se MIDIÓ PEOR: 590ms contra 147ms. El culpable era el portero,
  // no la consulta — validar el JWT server-side (auth.getUser) es un viaje de
  // red a Supabase Auth que cuesta más que traer los cursos. Una foto cacheada
  // no sirve si el portero tarda más que la consulta. Se descartó.
  const [catalogCourses, setCatalogCourses] = useState<Course[] | null>(null);
  const [userBits, setUserBits] = useState<{
    userId: string;
    lessonCounts: Record<string, number>;
    completedByCourse: Record<string, number>;
    accessContext: AccessContext | null;
  } | null>(null);

  // Frente 1 — los cursos, sin esperar a nadie.
  //
  // Las dos pasadas (publicados / +borradores) salen casi al mismo tiempo y
  // no hay garantía de cuál contesta primero: sin este candado, la de
  // publicados podía aterrizar DESPUÉS y borrarle los borradores al admin
  // (medido: 13 tarjetas donde debían salir 17). La pasada de admin manda
  // siempre, resuelva cuando resuelva.
  const adminListWonRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getCourses(false)
      .then(data => {
        if (!cancelled && !adminListWonRef.current) setCatalogCourses(data);
      })
      .catch(error => {
        console.error('Error fetching courses:', error);
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Segunda pasada SOLO para admins: agrega los borradores. Un miembro nunca
  // paga esta query.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    getCourses(true)
      .then(data => {
        if (cancelled) return;
        adminListWonRef.current = true;
        setCatalogCourses(data);
      })
      .catch(error => console.error('Error fetching draft courses:', error));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Frente 2 — lo que depende de QUIÉN eres, en cuanto se sabe.
  useEffect(() => {
    const userId = userProfile?.id;
    if (!userId) return;

    let cancelled = false;
    const needsAccessContext = !hasAdminAccess(userProfile?.role || '');

    Promise.all([
      getVisibleLessonCounts().catch(() => ({} as Record<string, number>)),
      getCompletedLessonsByCourse(userId).catch(() => ({} as Record<string, number>)),
      needsAccessContext
        ? fetchAccessContext(userId, userProfile).catch(() => null)
        : Promise.resolve<AccessContext | null>(null),
    ])
      .then(([lessonCounts, completedByCourse, accessContext]) => {
        if (!cancelled) setUserBits({ userId, lessonCounts, completedByCourse, accessContext });
      })
      .catch(error => {
        console.error('Error fetching classroom user data:', error);
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  // El encuentro: puro cálculo, cero red.
  useEffect(() => {
    if (!catalogCourses || !userBits) return;

    const progressObj = buildProgressMap(
      userBits.lessonCounts,
      userBits.completedByCourse,
      catalogCourses.map(c => c.id)
    );
    const accessObj = resolveCoursesAccess(catalogCourses, userProfile, userBits.accessContext);

    setCourses(catalogCourses);
    setProgressMap(progressObj);
    setAccessResultsMap(accessObj);
    setLessonCountsMap(userBits.lessonCounts);
    setCompletedCountsMap(userBits.completedByCourse);
    setIsLoading(false);
    setCached(`classroom:${isAdmin}:u${userBits.userId}`, {
      courses: catalogCourses,
      progressMap: progressObj,
      accessResultsMap: accessObj,
      lessonCountsMap: userBits.lessonCounts,
      completedCountsMap: userBits.completedByCourse,
    });

    // Los cursos que el usuario SÍ puede abrir se prefetchean en cuanto el
    // browser está ocioso: al hacer clic, la ruta ya está en el caché del
    // router. (El hover de cada tarjeta cubre el resto.)
    const openCourses = catalogCourses
      .filter(c => accessObj[c.id]?.hasAccess !== false)
      .slice(0, 6);
    const prefetchIdle = () => {
      openCourses.forEach(c => prefetchFull(router, `/classroom/${c.id}`));
    };
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void })
        .requestIdleCallback(prefetchIdle);
    } else {
      setTimeout(prefetchIdle, 1200);
    }
  }, [catalogCourses, userBits, userProfile, isAdmin, router]);

  const handleCreateCourse = () => {
    setEditingCourse(null);
    setShowModal(true);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setShowModal(true);
  };

  const handleSaveCourse = async (data: {
    title: string;
    description?: string;
    thumbnail_url?: string;
    published?: boolean;
    access_type?: CourseAccessType;
    unlock_level?: number | null;
    price_cents?: number | null;
    unlock_after_days?: number | null;
    tier_bypass_enabled?: boolean;
    tier_bypass_min?: 'standard' | 'vip' | null;
  }) => {
    if (editingCourse) {
      // Update existing course
      const updated = await updateCourse(editingCourse.id, data);
      setCourses((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    } else {
      // Create new course
      const created = await createCourse(data);
      setCourses((prev) => [...prev, created]);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    await deleteCourse(courseId);
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  const handleReorderCourses = async (courseIds: string[]) => {
    try {
      await reorderCourses(courseIds);
      // Update local state to match new order
      const reorderedCourses = courseIds
        .map((id) => courses.find((c) => c.id === id))
        .filter((c): c is Course => c !== undefined);
      setCourses(reorderedCourses);
    } catch (error) {
      console.error('Error reordering courses:', error);
    }
  };

  const handleCourseClick = (course: Course) => {
    router.push(`/classroom/${course.id}`);
  };

  const handleLockedClick = (course: Course) => {
    setLockedCourse(course);
  };

  return (
    <div className="font-sans">
      {isLoading ? (
        <CourseGridSkeleton />
      ) : (
        <CourseGrid
          courses={courses}
          progressMap={progressMap}
          lessonCountsMap={lessonCountsMap}
          completedCountsMap={completedCountsMap}
          accessResultsMap={accessResultsMap}
          isAdmin={isAdmin}
          onEdit={handleEditCourse}
          onDelete={handleDeleteCourse}
          onClick={handleCourseClick}
          onLockedClick={handleLockedClick}
          onReorder={handleReorderCourses}
          onCreate={handleCreateCourse}
        />
      )}

      {/* Course Modal */}
      <CourseModal
        course={editingCourse}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveCourse}
      />

      {/* Locked Course Modal */}
      {lockedCourse && (
        <LockedCourseModal
          course={lockedCourse}
          accessResult={accessResultsMap[lockedCourse.id]}
          userId={userProfile?.id}
          userEmail={userProfile?.email ?? undefined}
          onClose={() => setLockedCourse(null)}
        />
      )}
    </div>
  );
}
