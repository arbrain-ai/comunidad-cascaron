import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Analytics Service - métricas de comunidad desde Supabase
 *
 * - Miembros: total, con acceso, nuevos 7d/30d
 * - Engagement: posts, comentarios, lecciones completadas, top contributors
 */

// Admin client con service_role para saltar RLS en analytics.
// Perezoso a propósito: creado al importar, esto correría durante el BUILD y
// tumbaría la compilación en cualquier entorno sin las variables de Supabase.
const crearSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabase: ReturnType<typeof crearSupabase> | null = null;
const supabase = () => (_supabase ??= crearSupabase());

// ============================================================================
// TYPES
// ============================================================================

export interface UserMetrics {
  total: number;
  withAccess: number;
  newLast7d: number;
  newLast30d: number;
  accessRate: number;             // % del total con acceso a la comunidad
}

export interface EngagementMetrics {
  postsLast30d: number;
  commentsLast30d: number;
  lessonsCompletedLast30d: number;
  totalLessonProgress: number;
  topContributors: Contributor[];
}

export interface Contributor {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  postCount: number;
  commentCount: number;
  totalActivity: number;
}

export interface UnifiedAnalytics {
  users: UserMetrics;
  engagement: EngagementMetrics;
  lastUpdated: string;
}

// ============================================================================
// USER METRICS
// ============================================================================

export async function getUserMetrics(): Promise<UserMetrics> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ count: totalCount }, { count: withAccessCount }, { count: newLast7d }, { count: newLast30d }] =
    await Promise.all([
      supabase().from('profiles').select('*', { count: 'exact', head: true }),
      supabase().from('profiles').select('*', { count: 'exact', head: true }).eq('has_community_access', true),
      supabase().from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString()),
      supabase().from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
    ]);

  const total = totalCount || 0;
  const withAccess = withAccessCount || 0;

  return {
    total,
    withAccess,
    newLast7d: newLast7d || 0,
    newLast30d: newLast30d || 0,
    accessRate: total > 0 ? Math.round((withAccess / total) * 100 * 10) / 10 : 0,
  };
}

// ============================================================================
// ENGAGEMENT METRICS
// ============================================================================

export async function getEngagementMetrics(): Promise<EngagementMetrics> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Posts last 30 days
  const { count: postsLast30d } = await supabase()
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Comments last 30 days
  const { count: commentsLast30d } = await supabase()
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Lessons completed last 30 days
  const { count: lessonsCompletedLast30d } = await supabase()
    .from('lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('completed', true)
    .gte('completed_at', thirtyDaysAgo.toISOString());

  // Total lesson progress
  const { count: totalLessonProgress } = await supabase()
    .from('lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('completed', true);

  // Top contributors (posts + comments in last 30 days)
  const { data: postsData } = await supabase()
    .from('posts')
    .select('author_id')
    .gte('created_at', thirtyDaysAgo.toISOString());

  const { data: commentsData } = await supabase()
    .from('comments')
    .select('author_id')
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Aggregate activity by user
  const activityMap: Record<string, { posts: number; comments: number }> = {};

  (postsData || []).forEach((p) => {
    if (!activityMap[p.author_id]) {
      activityMap[p.author_id] = { posts: 0, comments: 0 };
    }
    activityMap[p.author_id].posts++;
  });

  (commentsData || []).forEach((c) => {
    if (!activityMap[c.author_id]) {
      activityMap[c.author_id] = { posts: 0, comments: 0 };
    }
    activityMap[c.author_id].comments++;
  });

  // Get top 10 contributors
  const topUserIds = Object.entries(activityMap)
    .map(([userId, activity]) => ({
      userId,
      totalActivity: activity.posts + activity.comments,
      ...activity,
    }))
    .sort((a, b) => b.totalActivity - a.totalActivity)
    .slice(0, 10);

  // Fetch profiles for top contributors
  const { data: profiles } = await supabase()
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', topUserIds.map((u) => u.userId));

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const topContributors: Contributor[] = topUserIds.map((u) => {
    const profile = profileMap.get(u.userId);
    return {
      userId: u.userId,
      fullName: profile?.full_name || 'Usuario',
      avatarUrl: profile?.avatar_url || null,
      postCount: u.posts,
      commentCount: u.comments,
      totalActivity: u.totalActivity,
    };
  });

  return {
    postsLast30d: postsLast30d || 0,
    commentsLast30d: commentsLast30d || 0,
    lessonsCompletedLast30d: lessonsCompletedLast30d || 0,
    totalLessonProgress: totalLessonProgress || 0,
    topContributors,
  };
}

// ============================================================================
// UNIFIED ANALYTICS
// ============================================================================

export async function getUnifiedAnalytics(): Promise<UnifiedAnalytics> {
  const [users, engagement] = await Promise.all([
    getUserMetrics(),
    getEngagementMetrics(),
  ]);

  return {
    users,
    engagement,
    lastUpdated: new Date().toISOString(),
  };
}
