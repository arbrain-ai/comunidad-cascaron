import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Cohort Analytics Service - Skool-style metrics
 *
 * Provides:
 * - Member growth by month (new, churned, net)
 * - Cohort retention analysis (heatmap data)
 * - Active members (DAU/MAU) metrics
 */

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

// Perezoso a proposito: creado al importar, esto corre durante el BUILD y
// tumba la compilacion en cualquier entorno sin las variables de Supabase.
const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const supabaseAdmin = () => (_supabaseAdmin ??= crearSupabaseAdmin());

// ============================================================================
// TYPES
// ============================================================================

export interface MemberGrowthData {
  month: string; // 'YYYY-MM'
  newMembers: number;
  churnedMembers: number;
  netGrowth: number;
  totalMembers: number;
}

export interface CohortRow {
  cohortMonth: string; // 'YYYY-MM'
  cohortLabel: string; // 'DEC 2024'
  cohortSize: number;
  retention: (number | null)[]; // [mo1%, mo2%, mo3%...] - null if future
}

export interface ActiveMembersData {
  totalMembers: number;
  activeMembers: number;
  activePct: number;
  change: number; // change from previous period
  changePct: number;
  history: { date: string; total: number; active: number }[];
}

export interface CohortAnalytics {
  memberGrowth: MemberGrowthData[];
  cohortRetention: CohortRow[];
  activeMembers: ActiveMembersData;
  summary: {
    totalMembers: number;
    activeMembers: number;
    activePct: number;
    changeText: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Valid tiers to include in analytics (exclude 'no-paid')
const VALID_TIERS = ['free', 'standard', 'vip'];

// ============================================================================
// HELPERS
// ============================================================================

function getMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

function getMonthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================================================
// MEMBER GROWTH DATA
// ============================================================================

export async function getMemberGrowthData(): Promise<MemberGrowthData[]> {
  try {
    const monthsToFetch = 12;
    const results: MemberGrowthData[] = [];

    // Get all profiles with created_at (only valid tiers)
    const { data: profiles } = await supabaseAdmin()
      .from('profiles')
      .select('id, created_at, tier')
      .in('tier', VALID_TIERS)
      .not('created_at', 'is', null);

    // Group profiles by month of creation
    const profilesByMonth: Record<string, number> = {};
    (profiles || []).forEach((p) => {
      if (p.created_at) {
        const month = p.created_at.substring(0, 7); // 'YYYY-MM'
        profilesByMonth[month] = (profilesByMonth[month] || 0) + 1;
      }
    });

    // Sin sistema de pagos no hay bajas que medir: churn = 0 por mes.
    const churnedByMonth: Record<string, number> = {};

    // Calculate running total
    let runningTotal = 0;
    const allMonths = new Set([...Object.keys(profilesByMonth), ...Object.keys(churnedByMonth)]);
    const sortedMonths = Array.from(allMonths).sort();

    // Pre-calculate totals for all months
    const monthTotals: Record<string, { new: number; churned: number; total: number }> = {};
    sortedMonths.forEach((month) => {
      const newMembers = profilesByMonth[month] || 0;
      const churnedMembers = churnedByMonth[month] || 0;
      runningTotal += newMembers;
      monthTotals[month] = {
        new: newMembers,
        churned: churnedMembers,
        total: runningTotal,
      };
    });

    // Get last 12 months
    for (let i = monthsToFetch - 1; i >= 0; i--) {
      const date = getMonthsAgo(i);
      const month = formatMonth(date);

      const data = monthTotals[month] || { new: 0, churned: 0, total: 0 };

      // Find the latest total up to this month
      let totalForMonth = 0;
      for (const m of sortedMonths) {
        if (m <= month) {
          totalForMonth = monthTotals[m]?.total || 0;
        }
      }

      results.push({
        month,
        newMembers: data.new,
        churnedMembers: data.churned,
        netGrowth: data.new - data.churned,
        totalMembers: totalForMonth || data.total,
      });
    }

    return results;
  } catch (error) {
    console.error('[Cohort Analytics] Error getting member growth:', error);
    return [];
  }
}

// ============================================================================
// COHORT RETENTION DATA
// ============================================================================

export async function getCohortRetentionData(): Promise<CohortRow[]> {
  try {
    const now = new Date();
    const currentMonth = formatMonth(now);

    // Get all profiles with activity data (only valid tiers)
    const { data: profiles } = await supabaseAdmin()
      .from('profiles')
      .select('id, created_at, last_seen, tier')
      .in('tier', VALID_TIERS)
      .not('created_at', 'is', null)
      .order('created_at', { ascending: true });

    if (!profiles || profiles.length === 0) {
      return [];
    }

    // Only fetch activity from the last 24 months (cohorts use 12 months + 11 months followup)
    const activityCutoff = getMonthsAgo(24).toISOString();

    // Get post activity per user per month
    const { data: posts } = await supabaseAdmin()
      .from('posts')
      .select('author_id, created_at')
      .gte('created_at', activityCutoff);

    // Get comment activity per user per month
    const { data: comments } = await supabaseAdmin()
      .from('comments')
      .select('author_id, created_at')
      .gte('created_at', activityCutoff);

    // Get lesson completion activity per user per month
    const { data: lessons } = await supabaseAdmin()
      .from('lesson_progress')
      .select('user_id, completed_at')
      .eq('completed', true)
      .gte('completed_at', activityCutoff);

    // Build activity map: userId -> Set of active months
    const userActivityMonths: Record<string, Set<string>> = {};

    // Process last_seen
    profiles.forEach((p) => {
      if (!userActivityMonths[p.id]) {
        userActivityMonths[p.id] = new Set();
      }
      if (p.last_seen) {
        const month = p.last_seen.substring(0, 7);
        userActivityMonths[p.id].add(month);
      }
    });

    // Process posts
    (posts || []).forEach((post) => {
      if (post.author_id && post.created_at) {
        if (!userActivityMonths[post.author_id]) {
          userActivityMonths[post.author_id] = new Set();
        }
        const month = post.created_at.substring(0, 7);
        userActivityMonths[post.author_id].add(month);
      }
    });

    // Process comments
    (comments || []).forEach((comment) => {
      if (comment.author_id && comment.created_at) {
        if (!userActivityMonths[comment.author_id]) {
          userActivityMonths[comment.author_id] = new Set();
        }
        const month = comment.created_at.substring(0, 7);
        userActivityMonths[comment.author_id].add(month);
      }
    });

    // Process lessons
    (lessons || []).forEach((lesson) => {
      if (lesson.user_id && lesson.completed_at) {
        if (!userActivityMonths[lesson.user_id]) {
          userActivityMonths[lesson.user_id] = new Set();
        }
        const month = lesson.completed_at.substring(0, 7);
        userActivityMonths[lesson.user_id].add(month);
      }
    });

    // Group profiles by cohort (month of registration)
    const cohorts: Record<string, string[]> = {}; // month -> userIds
    profiles.forEach((p) => {
      const cohortMonth = p.created_at.substring(0, 7);
      if (!cohorts[cohortMonth]) {
        cohorts[cohortMonth] = [];
      }
      cohorts[cohortMonth].push(p.id);
    });

    // Calculate retention for each cohort
    const cohortMonths = Object.keys(cohorts).sort().slice(-12); // Last 12 months
    const maxMonthsToShow = 11; // MO 1 through MO 11

    const results: CohortRow[] = cohortMonths.map((cohortMonth) => {
      const userIds = cohorts[cohortMonth];
      const cohortSize = userIds.length;

      // Calculate retention for each subsequent month
      const retention: (number | null)[] = [];

      for (let monthOffset = 1; monthOffset <= maxMonthsToShow; monthOffset++) {
        // Calculate target month
        const [year, month] = cohortMonth.split('-').map(Number);
        const targetDate = new Date(year, month - 1 + monthOffset, 1);
        const targetMonth = formatMonth(targetDate);

        // If target month is in the future, set null
        if (targetMonth > currentMonth) {
          retention.push(null);
          continue;
        }

        // Count users active in target month
        let activeCount = 0;
        userIds.forEach((userId) => {
          const activityMonths = userActivityMonths[userId];
          if (activityMonths && activityMonths.has(targetMonth)) {
            activeCount++;
          }
        });

        const retentionPct = cohortSize > 0 ? Math.round((activeCount / cohortSize) * 100 * 10) / 10 : 0;
        retention.push(retentionPct);
      }

      return {
        cohortMonth,
        cohortLabel: getMonthLabel(cohortMonth),
        cohortSize,
        retention,
      };
    });

    return results;
  } catch (error) {
    console.error('[Cohort Analytics] Error getting cohort retention:', error);
    return [];
  }
}

// ============================================================================
// ACTIVE MEMBERS DATA
// ============================================================================

export async function getActiveMembers(): Promise<ActiveMembersData> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get total members (only valid tiers)
    const { count: totalMembers } = await supabaseAdmin()
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('tier', VALID_TIERS);

    // Get active members (last_seen in last 30 days, only valid tiers)
    const { data: activeProfiles } = await supabaseAdmin()
      .from('profiles')
      .select('id, last_seen')
      .in('tier', VALID_TIERS)
      .gte('last_seen', thirtyDaysAgo.toISOString());

    const activeMembers = activeProfiles?.length || 0;

    // Get previous period active members (30-60 days ago, only valid tiers)
    const { data: prevActiveProfiles } = await supabaseAdmin()
      .from('profiles')
      .select('id')
      .in('tier', VALID_TIERS)
      .gte('last_seen', sixtyDaysAgo.toISOString())
      .lt('last_seen', thirtyDaysAgo.toISOString());

    const prevActiveMembers = prevActiveProfiles?.length || 0;

    // Get activity by adding posts, comments, lessons for users not captured by last_seen
    const { data: recentPosts } = await supabaseAdmin()
      .from('posts')
      .select('author_id')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: recentComments } = await supabaseAdmin()
      .from('comments')
      .select('author_id')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: recentLessons } = await supabaseAdmin()
      .from('lesson_progress')
      .select('user_id')
      .eq('completed', true)
      .gte('completed_at', thirtyDaysAgo.toISOString());

    // Combine all active user IDs
    const activeUserIds = new Set<string>();
    (activeProfiles || []).forEach((p) => activeUserIds.add(p.id));
    (recentPosts || []).forEach((p) => p.author_id && activeUserIds.add(p.author_id));
    (recentComments || []).forEach((c) => c.author_id && activeUserIds.add(c.author_id));
    (recentLessons || []).forEach((l) => l.user_id && activeUserIds.add(l.user_id));

    const combinedActiveMembers = activeUserIds.size;

    // Calculate history (last 30 days)
    const history: { date: string; total: number; active: number }[] = [];

    // Get all profiles with created_at for history calculation (only valid tiers)
    const { data: allProfiles } = await supabaseAdmin()
      .from('profiles')
      .select('id, created_at, last_seen, tier')
      .in('tier', VALID_TIERS)
      .order('created_at', { ascending: true });

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      // Count total members up to this date
      const totalOnDate = (allProfiles || []).filter((p) => {
        return p.created_at && p.created_at.split('T')[0] <= dateStr;
      }).length;

      // Count active on this date (had activity within 30 days before this date)
      const thirtyDaysBefore = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);
      const activeOnDate = (allProfiles || []).filter((p) => {
        if (!p.last_seen) return false;
        const lastSeen = new Date(p.last_seen);
        return lastSeen >= thirtyDaysBefore && lastSeen <= date;
      }).length;

      history.push({
        date: dateStr,
        total: totalOnDate,
        active: activeOnDate,
      });
    }

    const activePct = totalMembers ? Math.round((combinedActiveMembers / totalMembers) * 100) : 0;
    const change = combinedActiveMembers - prevActiveMembers;
    const changePct = prevActiveMembers > 0 ? Math.round((change / prevActiveMembers) * 100) : 0;

    return {
      totalMembers: totalMembers || 0,
      activeMembers: combinedActiveMembers,
      activePct,
      change,
      changePct,
      history,
    };
  } catch (error) {
    console.error('[Cohort Analytics] Error getting active members:', error);
    return {
      totalMembers: 0,
      activeMembers: 0,
      activePct: 0,
      change: 0,
      changePct: 0,
      history: [],
    };
  }
}

// ============================================================================
// UNIFIED COHORT ANALYTICS
// ============================================================================

export async function getCohortAnalytics(): Promise<CohortAnalytics> {
  const [memberGrowth, cohortRetention, activeMembers] = await Promise.all([
    getMemberGrowthData(),
    getCohortRetentionData(),
    getActiveMembers(),
  ]);

  // Generate summary text
  const change = activeMembers.change;
  const changeText =
    change > 0
      ? `grew to ${activeMembers.totalMembers} members (+${change})`
      : change < 0
        ? `shrank to ${activeMembers.totalMembers} members (${change})`
        : `stayed at ${activeMembers.totalMembers} members`;

  return {
    memberGrowth,
    cohortRetention,
    activeMembers,
    summary: {
      totalMembers: activeMembers.totalMembers,
      activeMembers: activeMembers.activeMembers,
      activePct: activeMembers.activePct,
      changeText,
    },
  };
}
