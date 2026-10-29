import { supabase } from '@/shared/lib/supabase';
import { Course, Lesson, Folder, CourseWithContent, FolderWithLessons } from '../types';
import { logger } from '@/shared/utils/logger';
import { courseUnlockSatisfied } from '@/features/gamification/config/levels';

// ==================== COURSES ====================

export async function getCourses(includeUnpublished = false) {
  let query = supabase
    .from('courses')
    .select('*')
    .order('order_position');

  if (!includeUnpublished) {
    query = query.eq('published', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Course[];
}

export async function getCourseWithContent(
  courseId: string,
  includeUnpublished = false
): Promise<CourseWithContent> {
  // Course, folders y lessons no dependen entre sí: un solo round-trip de latencia
  let foldersQuery = supabase
    .from('folders')
    .select('*')
    .eq('course_id', courseId)
    .order('order_position');

  if (!includeUnpublished) {
    foldersQuery = foldersQuery.eq('published', true);
  }

  let lessonsQuery = supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('order_position');

  if (!includeUnpublished) {
    lessonsQuery = lessonsQuery.eq('published', true);
  }

  const [
    { data: course, error: courseError },
    { data: folders, error: foldersError },
    { data: lessons, error: lessonsError },
  ] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).single(),
    foldersQuery,
    lessonsQuery,
  ]);

  if (courseError) throw courseError;
  if (foldersError) throw foldersError;
  if (lessonsError) throw lessonsError;

  // IDs de folders publicados (para filtrar lessons de folders draft)
  const publishedFolderIds = new Set((folders || []).map(f => f.id));

  // Organize lessons into folders
  const foldersWithLessons: FolderWithLessons[] = (folders || []).map(folder => ({
    ...folder,
    lessons: (lessons || []).filter(l => l.folder_id === folder.id)
  }));

  // Get standalone lessons (not in any folder)
  // También filtrar lessons que pertenecen a folders en draft
  const standaloneLessons = (lessons || []).filter(l => {
    if (!l.folder_id) return true; // standalone real
    // Si tiene folder_id pero ese folder está en draft, no mostrar
    return includeUnpublished || publishedFolderIds.has(l.folder_id);
  }).filter(l => !l.folder_id);

  return {
    ...course,
    folders: foldersWithLessons,
    standaloneLessons
  } as CourseWithContent;
}

export async function createCourse(data: {
  title: string;
  description?: string;
  thumbnail_url?: string;
  published?: boolean;
  access_type?: 'open' | 'level_unlock' | 'buy_now' | 'time_unlock' | 'private';
  unlock_level?: number | null;
  price_cents?: number | null;
  unlock_after_days?: number | null;
  tier_bypass_enabled?: boolean;
  tier_bypass_min?: 'standard' | 'vip' | null;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Usuario no autenticado');

  // Get max order position
  const { data: courses } = await supabase
    .from('courses')
    .select('order_position')
    .order('order_position', { ascending: false })
    .limit(1);

  const nextPosition = courses && courses.length > 0 ? courses[0].order_position + 1 : 0;

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      title: data.title,
      description: data.description,
      thumbnail_url: data.thumbnail_url,
      created_by: user.user.id,
      published: data.published ?? false,
      access_type: data.access_type ?? 'open',
      unlock_level: data.unlock_level,
      price_cents: data.price_cents,
      unlock_after_days: data.unlock_after_days,
      tier_bypass_enabled: data.tier_bypass_enabled ?? false,
      tier_bypass_min: data.tier_bypass_min,
      order_position: nextPosition
    })
    .select()
    .single();

  if (error) throw error;
  return course as Course;
}

export async function updateCourse(courseId: string, data: Partial<Course>) {
  const { data: course, error } = await supabase
    .from('courses')
    .update(data)
    .eq('id', courseId)
    .select()
    .single();

  if (error) throw error;
  return course as Course;
}

export async function deleteCourse(courseId: string) {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId);

  if (error) throw error;
}

export async function reorderCourses(courseIds: string[]) {
  const updates = courseIds.map((id, index) =>
    supabase
      .from('courses')
      .update({ order_position: index })
      .eq('id', id)
  );

  await Promise.all(updates);
}

// ==================== FOLDERS ====================

export async function createFolder(courseId: string, title: string, published = false) {
  // Get max order position for this course
  const { data: folders } = await supabase
    .from('folders')
    .select('order_position')
    .eq('course_id', courseId)
    .order('order_position', { ascending: false })
    .limit(1);

  const nextPosition = folders && folders.length > 0 ? folders[0].order_position + 1 : 0;

  const { data: folder, error } = await supabase
    .from('folders')
    .insert({
      course_id: courseId,
      title,
      order_position: nextPosition,
      published
    })
    .select()
    .single();

  if (error) throw error;
  return folder as Folder;
}

export async function updateFolder(folderId: string, data: Partial<Folder>) {
  const { data: folder, error } = await supabase
    .from('folders')
    .update(data)
    .eq('id', folderId)
    .select()
    .single();

  if (error) throw error;
  return folder as Folder;
}

export async function deleteFolder(folderId: string) {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (error) throw error;
}

export async function reorderFolders(courseId: string, folderIds: string[]) {
  const updates = folderIds.map((id, index) =>
    supabase
      .from('folders')
      .update({ order_position: index })
      .eq('id', id)
      .eq('course_id', courseId)
  );

  await Promise.all(updates);
}

// ==================== LESSONS/PAGES ====================

export async function createLesson(courseId: string, data: {
  title: string;
  content?: string;
  folder_id?: string;
  published?: boolean;
}) {
  // Get max order position
  const { data: lessons } = await supabase
    .from('lessons')
    .select('order_position')
    .eq('course_id', courseId)
    .order('order_position', { ascending: false })
    .limit(1);

  const nextPosition = lessons && lessons.length > 0 ? lessons[0].order_position + 1 : 0;

  const { data: lesson, error } = await supabase
    .from('lessons')
    .insert({
      ...data,
      course_id: courseId,
      order_position: nextPosition,
      published: data.published ?? false  // Default: draft
    })
    .select()
    .single();

  if (error) throw error;
  return lesson as Lesson;
}

export async function updateLesson(lessonId: string, data: Partial<Lesson>) {
  const { data: lesson, error } = await supabase
    .from('lessons')
    .update(data)
    .eq('id', lessonId)
    .select()
    .single();

  if (error) throw error;

  return lesson as Lesson;
}

export async function deleteLesson(lessonId: string) {
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId);

  if (error) throw error;
}

export async function moveLesson(lessonId: string, targetFolderId: string | null) {
  const { data: lesson, error } = await supabase
    .from('lessons')
    .update({ folder_id: targetFolderId })
    .eq('id', lessonId)
    .select()
    .single();

  if (error) throw error;
  return lesson as Lesson;
}

export async function reorderLessons(lessonIds: string[]) {
  const updates = lessonIds.map((id, index) =>
    supabase
      .from('lessons')
      .update({ order_position: index })
      .eq('id', id)
  );

  await Promise.all(updates);
}

export async function reorderCourseItems(
  courseId: string,
  items: Array<{ id: string; type: 'folder' | 'lesson'; order: number }>
) {
  const folderUpdates = items
    .filter(item => item.type === 'folder')
    .map(item =>
      supabase
        .from('folders')
        .update({ order_position: item.order })
        .eq('id', item.id)
        .eq('course_id', courseId)
    );

  const lessonUpdates = items
    .filter(item => item.type === 'lesson')
    .map(item =>
      supabase
        .from('lessons')
        .update({ order_position: item.order })
        .eq('id', item.id)
    );

  await Promise.all([...folderUpdates, ...lessonUpdates]);
}

// ==================== PROGRESS ====================

export async function markLessonComplete(userId: string, lessonId: string) {
  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' }
  );
  if (error) throw error;
}

export async function getCourseProgress(userId: string, courseId: string) {
  // Solo lecciones publicadas: el % de la tarjeta debe medir contra lo que el
  // miembro realmente ve. Contar borradores/drip en el denominador hacía que un
  // curso 100% visto se mostrara en 88-91% en el grid (mismatch con la vista interna).
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .eq('published', true);

  if (!lessons || lessons.length === 0) return 0;

  const lessonIds = lessons.map(l => l.id);

  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds)
    .eq('completed', true);

  return Math.round(((progress?.length || 0) / lessons.length) * 100);
}

/**
 * Progreso de N cursos en 2 queries totales (antes: 2 queries POR curso).
 * Misma semántica que getCourseProgress: completadas / total lessons del curso.
 */
export async function getCoursesProgressBatch(
  userId: string,
  courseIds: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (courseIds.length === 0) return result;
  courseIds.forEach(id => { result[id] = 0; });

  // Solo publicadas (ver getCourseProgress): alinea el denominador del grid con
  // la vista interna del curso, que ya cuenta únicamente lecciones publicadas.
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, course_id')
    .in('course_id', courseIds)
    .eq('published', true);

  if (!lessons || lessons.length === 0) return result;

  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId)
    .in('lesson_id', lessons.map(l => l.id))
    .eq('completed', true);

  const completedIds = new Set((progress || []).map(p => p.lesson_id));
  const byCourse = new Map<string, { total: number; done: number }>();
  for (const lesson of lessons) {
    const entry = byCourse.get(lesson.course_id) || { total: 0, done: 0 };
    entry.total++;
    if (completedIds.has(lesson.id)) entry.done++;
    byCourse.set(lesson.course_id, entry);
  }
  for (const [courseId, { total, done }] of byCourse) {
    result[courseId] = total > 0 ? Math.round((done / total) * 100) : 0;
  }
  return result;
}

/**
 * Las lecciones que ESTE usuario ya completó, con el curso al que pertenecen
 * pegado en el mismo viaje.
 *
 * Antes hacían falta dos queries en serie (lessons de los cursos → progreso
 * de esas lecciones). Al traer `course_id` embebido, esta query no depende de
 * nada: sale en paralelo con el catálogo y con el chequeo de acceso.
 *
 * El filtro `lessons.published` mantiene el mismo numerador que el
 * denominador del catálogo (solo publicadas), igual que getCoursesProgressBatch.
 */
export async function getCompletedLessonsByCourse(
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('lesson_id, lessons!inner(course_id, published)')
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('lessons.published', true);

  if (error) throw error;

  const byCourse: Record<string, number> = {};
  for (const row of (data || []) as unknown as { lessons: { course_id: string } | { course_id: string }[] }[]) {
    const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    const courseId = lesson?.course_id;
    if (!courseId) continue;
    byCourse[courseId] = (byCourse[courseId] || 0) + 1;
  }
  return byCourse;
}

/**
 * Cuántas lecciones publicadas VE ESTE USUARIO, por curso.
 *
 * ⚠️ Esto NO se puede calcular en el server con el service role, y la lección
 * costó un 10% que se volvió 9%: el service role ve las 241 lecciones
 * publicadas, pero el miembro ve las que su RLS le deja ver. Si el
 * denominador sale del server y el numerador del cliente, el porcentaje mide
 * dos realidades distintas y siempre queda por debajo.
 *
 * Numerador y denominador tienen que mirar por el MISMO lente. Por eso esta
 * query va del lado del cliente igual que el progreso, y no depende del
 * catálogo: sale en paralelo con todo lo demás.
 */
export async function getVisibleLessonCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('lessons')
    .select('course_id')
    .eq('published', true)
    .limit(5000);

  if (error) throw error;

  const rows = data || [];
  // Red de seguridad: si algún día el tope de filas de PostgREST corta la
  // lista, el denominador se quedaría corto EN SILENCIO y todos los
  // porcentajes subirían solos. Preferimos un aviso ruidoso.
  if (rows.length >= 1000 && rows.length % 1000 === 0) {
    logger.warn('[getVisibleLessonCounts] posible truncado de filas:', rows.length);
  }

  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.course_id) continue;
    counts[row.course_id] = (counts[row.course_id] || 0) + 1;
  }
  return counts;
}

/** Porcentajes por curso a partir del catálogo + lo completado. Sin I/O. */
export function buildProgressMap(
  lessonCounts: Record<string, number>,
  completedByCourse: Record<string, number>,
  courseIds: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const courseId of courseIds) {
    const total = lessonCounts[courseId] || 0;
    const done = completedByCourse[courseId] || 0;
    result[courseId] = total > 0 ? Math.round((done / total) * 100) : 0;
  }
  return result;
}

// ==================== ACCESS CONTROL ====================

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?:
    | 'open'
    | 'permanent_grant'           // Has lifetime access via grant
    | 'vip_access'                // VIP tier gets immediate access
    | 'level_too_low'
    | 'time_not_reached'          // 🆕 Has level but hasn't waited enough days
    | 'level_and_time_required'   // 🆕 Missing both level AND time
    | 'not_purchased'
    | 'private'
    | 'tier_bypass';              // VIP tier bypass for exclusive content
  requiredLevel?: number;
  currentLevel?: number;
  requiredDays?: number;          // 🆕 Days required to unlock
  currentDays?: number;           // 🆕 Days since subscription
  priceCents?: number;
  requiredTier?: string;
}

type AccessUserProfile = { current_level?: number | null; tier?: string | null; created_at?: string | null; role?: string | null } | null;

/**
 * Datos de acceso a nivel USUARIO (idénticos para todos los cursos).
 * Se cargan UNA vez y se reusan por curso.
 */
export interface AccessContext {
  grantedCourseIds: Set<string>;      // course_access_grants permanentes (expires_at null)
  memberSinceDate: string | null | undefined;
}

export async function fetchAccessContext(
  userId: string,
  userProfile: AccessUserProfile
): Promise<AccessContext> {
  const grantsRes = await supabase
    .from('course_access_grants')
    .select('course_id')
    .eq('user_id', userId)
    .is('expires_at', null); // Solo grants permanentes

  return {
    grantedCourseIds: new Set((grantsRes.data || []).map(g => g.course_id)),
    memberSinceDate: userProfile?.created_at,
  };
}

/**
 * Decisión de acceso PURA (sin I/O). Mismo orden de checks y mismos resultados
 * que la versión histórica de checkCourseAccess — solo se separó el fetch.
 */
function resolveCourseAccess(
  course: Course,
  userProfile: AccessUserProfile,
  ctx: AccessContext
): AccessCheckResult {
  const accessType = course.access_type || 'open';

  // 🆕 STEP 1: Check for permanent access grant (FAST PATH)
  if (ctx.grantedCourseIds.has(course.id)) {
    return { hasAccess: true, reason: 'permanent_grant' };
  }

  // VIP: acceso completo a TODO, siempre.
  if (userProfile?.tier === 'vip') {
    return { hasAccess: true, reason: 'tier_bypass' };
  }

  // Private courses - only admins, VIP or explicit grants (checked above)
  if (accessType === 'private') {
    return { hasAccess: false, reason: 'private' };
  }

  const daysSinceMemberStart = (): number => {
    if (!ctx.memberSinceDate) return 0;
    const startDate = new Date(ctx.memberSinceDate);
    const now = new Date();
    return Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Level unlock (with optional time requirement)
  if (accessType === 'level_unlock') {
    const requiredLevel = course.unlock_level || 1;
    const currentLevel = userProfile?.current_level || 1;
    const requiredDays = course.unlock_after_days || 0;
    const currentDays = daysSinceMemberStart();

    const hasLevel = courseUnlockSatisfied(requiredLevel, currentLevel);
    const hasTime = requiredDays === 0 || currentDays >= requiredDays;

    if (hasLevel && hasTime) {
      return { hasAccess: true };
    }
    if (!hasLevel && hasTime) {
      return { hasAccess: false, reason: 'level_too_low', requiredLevel, currentLevel };
    }
    if (hasLevel && !hasTime) {
      return { hasAccess: false, reason: 'time_not_reached', requiredLevel, currentLevel, requiredDays, currentDays };
    }
    return { hasAccess: false, reason: 'level_and_time_required', requiredLevel, currentLevel, requiredDays, currentDays };
  }

  // Buy now - sin pasarela integrada: se abre con un grant (course_access_grants)
  if (accessType === 'buy_now') {
    return { hasAccess: false, reason: 'not_purchased', priceCents: course.price_cents || 0 };
  }

  // Time unlock courses - unlocks after X days of membership
  if (accessType === 'time_unlock') {
    // VIP gets immediate access
    if (userProfile?.tier === 'vip') {
      return { hasAccess: true, reason: 'vip_access' };
    }

    const requiredDays = course.unlock_after_days || 0;
    const currentDays = daysSinceMemberStart();
    const hasTime = requiredDays === 0 || currentDays >= requiredDays;

    if (hasTime) {
      return { hasAccess: true };
    }
    return { hasAccess: false, reason: 'time_not_reached', requiredDays, currentDays };
  }

  // Default: no access
  return { hasAccess: false };
}

export async function checkCourseAccess(
  userId: string,
  course: Course,
  userProfile: AccessUserProfile
): Promise<AccessCheckResult> {
  // Admins/owners always have access
  if (userProfile?.role === 'admin' || userProfile?.role === 'owner') {
    return { hasAccess: true };
  }

  // Open courses - everyone has access (sin tocar la red)
  if ((course.access_type || 'open') === 'open') {
    return { hasAccess: true, reason: 'open' };
  }

  const ctx = await fetchAccessContext(userId, userProfile);
  const result = resolveCourseAccess(course, userProfile, ctx);
  logger.debug('[checkCourseAccess]', course.id, result.reason || result.hasAccess);
  return result;
}

/**
 * Acceso de N cursos con UN solo fetch de contexto de usuario (4 queries
 * paralelas en total, antes 3-5 secuenciales POR curso). Mismas decisiones.
 */
export async function checkCoursesAccessBatch(
  userId: string,
  courses: Course[],
  userProfile: AccessUserProfile
): Promise<Record<string, AccessCheckResult>> {
  if (userProfile?.role === 'admin' || userProfile?.role === 'owner') {
    return resolveCoursesAccess(courses, userProfile, null);
  }

  const restricted = courses.filter(c => (c.access_type || 'open') !== 'open');
  const ctx = restricted.length > 0 ? await fetchAccessContext(userId, userProfile) : null;
  return resolveCoursesAccess(courses, userProfile, ctx);
}

/**
 * El VEREDICTO de acceso de N cursos, sin I/O. Mismas decisiones y mismo orden
 * que checkCoursesAccessBatch — solo se separó el fetch del contexto para que
 * el Classroom pueda pedir ese contexto EN PARALELO con el catálogo, en vez de
 * esperar a tener la lista de cursos para recién entonces salir a la red.
 *
 * `ctx === null` significa una de dos cosas, y las dos son correctas aquí:
 * el usuario es admin/owner (acceso total, no hace falta contexto), o ningún
 * curso es restringido (no hay nada que resolver).
 */
export function resolveCoursesAccess(
  courses: Course[],
  userProfile: AccessUserProfile,
  ctx: AccessContext | null
): Record<string, AccessCheckResult> {
  const results: Record<string, AccessCheckResult> = {};

  if (userProfile?.role === 'admin' || userProfile?.role === 'owner') {
    courses.forEach(c => { results[c.id] = { hasAccess: true }; });
    return results;
  }

  courses.forEach(c => {
    if ((c.access_type || 'open') === 'open') {
      results[c.id] = { hasAccess: true, reason: 'open' };
    }
  });

  const restricted = courses.filter(c => (c.access_type || 'open') !== 'open');
  if (restricted.length === 0) return results;

  // Sin contexto no se puede juzgar un curso restringido: se mantiene CERRADO.
  // Nunca al revés — un fallo de red no debe abrir contenido de paga.
  if (!ctx) {
    restricted.forEach(c => {
      results[c.id] = { hasAccess: false, reason: 'not_purchased' };
    });
    return results;
  }

  restricted.forEach(c => {
    results[c.id] = resolveCourseAccess(c, userProfile, ctx);
  });
  return results;
}

// Get access badge info for a course
export function getAccessBadgeInfo(course: Course): {
  label: string;
  icon: string;
  color: 'primary' | 'warning' | 'error' | 'success';
  sublabel?: string;
} | null {
  const accessType = course.access_type || 'open';

  if (accessType === 'open') {
    return null; // No badge for open courses
  }

  if (accessType === 'level_unlock') {
    return {
      label: `Level ${course.unlock_level || 1}`,
      icon: '⬆️',
      color: 'warning',
      sublabel: 'Required'
    };
  }

  if (accessType === 'buy_now') {
    const price = ((course.price_cents || 0) / 100).toFixed(2);
    return {
      label: `$${price}`,
      icon: '💰',
      color: 'success'
    };
  }

  if (accessType === 'time_unlock') {
    const days = course.unlock_after_days || 7;

    // Premium course tiers (escalera de valor)
    if (days === 1) {
      return {
        label: 'Premium Mes 1',
        icon: '✨',
        color: 'primary',
        sublabel: 'Acceso inmediato'
      };
    }
    if (days === 30) {
      return {
        label: 'Premium Mes 2',
        icon: '⏰',
        color: 'warning',
        sublabel: 'Desbloqueo 30 días'
      };
    }
    if (days === 60) {
      return {
        label: 'Premium Mes 3',
        icon: '🔥',
        color: 'success',
        sublabel: 'Desbloqueo 60 días'
      };
    }

    // Fallback para otros casos
    return {
      label: `${days} días`,
      icon: '⏰',
      color: 'primary',
      sublabel: 'Después de inscribirte'
    };
  }

  if (accessType === 'private') {
    return {
      label: 'Private',
      icon: '🔒',
      color: 'error'
    };
  }

  return null;
}

// ==================== DRAFT/PUBLISH TOGGLE ====================

export async function toggleFolderPublished(folderId: string, published: boolean) {
  const { data, error } = await supabase
    .from('folders')
    .update({ published })
    .eq('id', folderId)
    .select()
    .single();
  if (error) throw error;
  return data as Folder;
}

export async function toggleLessonPublished(lessonId: string, published: boolean) {
  const { data, error } = await supabase
    .from('lessons')
    .update({ published })
    .eq('id', lessonId)
    .select()
    .single();
  if (error) throw error;
  return data as Lesson;
}

// ==================== STORAGE ====================

export async function uploadCourseThumbnail(file: File, courseId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('courseId', courseId);

  const response = await fetch('/api/admin/upload-course-thumbnail', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error || 'Upload failed');
  }

  const { url } = await response.json();
  return url as string;
}
