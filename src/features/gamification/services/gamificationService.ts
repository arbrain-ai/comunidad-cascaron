// ============================================
// Gamification Service
// ============================================
// Handles all gamification-related queries

import { supabase } from '@/shared/lib/supabase';
import { LeaderboardEntry, LeaderboardPeriod, PointTransaction, UserPoints } from '../types';

/**
 * Get current user's points and level
 */
export async function getUserPoints(userId: string): Promise<UserPoints | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, total_points, current_level, full_name, avatar_url, role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user points:', error);
    return null;
  }

  return {
    id: data.id,
    total_points: data.total_points || 0,
    current_level: data.current_level || 1,
    full_name: data.full_name || 'Usuario',
    avatar_url: data.avatar_url,
    role: data.role,
  };
}

/**
 * Get leaderboard for a specific period
 * Uses server-side aggregation via RPC to avoid Supabase's 1000 row limit
 * Default limit is 10 (Top 10)
 */
export async function getLeaderboard(
  period: LeaderboardPeriod,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard_by_period', {
    period_type: period,
    result_limit: limit,
  });

  if (error) {
    console.error(`Error fetching ${period} leaderboard:`, error);
    return [];
  }

  return (data || []).map((row: {
    rank: number;
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    total_points: number;
    current_level: number;
    points_in_period: number;
    is_annual: boolean;
  }) => ({
    rank: row.rank,
    user_id: row.user_id,
    full_name: row.full_name || 'Usuario',
    avatar_url: row.avatar_url,
    total_points: row.total_points || 0,
    current_level: row.current_level || 1,
    points_in_period: row.points_in_period || 0,
    is_annual: row.is_annual || false,
  }));
}

/**
 * Get user's point transaction history
 */
export async function getUserTransactions(
  userId: string,
  limit: number = 50
): Promise<PointTransaction[]> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get user's rank in overall leaderboard
 * Excludes owners and admins from ranking calculation
 */
export async function getUserRank(
  userId: string,
  known?: { total_points?: number | null; role?: string | null } | null
): Promise<number | null> {
  // El ranking necesita dos cosas del perfil (puntos y rol) que quien llama
  // YA tiene cargadas: el UserProfileContext hace `select('*')` de esta misma
  // fila al abrir la app. Pedirlas otra vez era un round-trip EN SERIE antes
  // de poder contar — la cuenta no puede salir hasta saber contra qué contar.
  // Con `known` la única query que queda es la que de verdad toca la red.
  let user = known ?? null;

  if (!user) {
    const { data, error: userError } = await supabase
      .from('profiles')
      .select('total_points, role')
      .eq('id', userId)
      .single();

    if (userError || !data) return null;
    user = data;
  }

  // Owners/admins don't have a rank
  if (user.role === 'owner' || user.role === 'admin') return null;

  const { count, error: countError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gt('total_points', user.total_points || 0)
    .in('tier', ['free', 'standard', 'vip', 'premium'])
    .not('role', 'in', '("owner","admin")');

  if (countError) return null;

  return (count || 0) + 1;
}

/**
 * Get members count per level
 * Cuenta profiles.current_level de miembros con acceso (una sola fuente de
 * verdad): la distribución muestra EXACTAMENTE lo que los badges muestran,
 * incluidos los anuales con Nivel 6. Migración 20260816_get_level_distribution.
 */
export async function getMembersPerLevel(): Promise<Map<number, number>> {
  const { data, error } = await supabase.rpc('get_level_distribution');

  if (error) {
    console.error('Error fetching level distribution:', error);
    return new Map();
  }

  const counts = new Map<number, number>();
  for (const row of data || []) {
    counts.set(row.level, row.member_count);
  }

  return counts;
}

/**
 * Get total member count
 * Uses the same RPC as getMembersPerLevel to ensure totals match.
 */
export async function getTotalMembersCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_level_distribution');

  if (error) return 0;
  return (data || []).reduce((sum: number, row: { member_count: number }) => sum + row.member_count, 0);
}
