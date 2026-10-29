// ============================================
// Gamification Types
// ============================================

export interface UserPoints {
  id: string;
  total_points: number;
  current_level: number;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_points: number;
  current_level: number;
  points_in_period?: number; // For time-based leaderboards
  is_annual?: boolean; // Annual subscriber badge
}

export interface PointTransaction {
  id: string;
  user_id: string;
  points: number;
  action: PointAction;
  source_id: string | null;
  source_type: 'post' | 'comment' | null;
  created_at: string;
}

// Skool Pure: Points only from likes received
// Reference: https://help.skool.com/article/31-how-do-points-and-levels-work
export type PointAction =
  | 'like_received_post'
  | 'like_received_comment'
  | 'like_removed_post'
  | 'like_removed_comment';

export type LeaderboardPeriod = '7d' | '30d' | 'all';

export interface LevelInfo {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  icon: string;
}

// ============================================
// Level Rewards System
// ============================================
// OWNER: Edita esta sección para definir premios por nivel
// Los premios son configurables y se muestran en el modal de premios

/**
 * Recompensa individual (puede haber múltiples por nivel)
 */
export interface RewardItem {
  title: string;        // Título corto del premio
  description: string;  // Descripción detallada
  icon: string;         // Emoji o icono
}

export interface LevelReward {
  level: number;
  title: string;        // Título principal del nivel (legado)
  description: string;  // Descripción principal (legado)
  icon: string;         // Emoji principal (legado)
  unlocked?: boolean;   // Se calcula dinámicamente
  rewards?: RewardItem[]; // Múltiples recompensas para este nivel (opcional)
}

// Umbrales de nivel: deben ser ESPEJO EXACTO de calculate_level() en la BD.
export const MAX_LEVEL = 9;

export const LEVEL_THRESHOLDS: LevelInfo[] = [
  { level: 1, name: 'Nuevo', minPoints: 0, maxPoints: 4, icon: '1' },
  { level: 2, name: 'Explorador', minPoints: 5, maxPoints: 19, icon: '2' },
  { level: 3, name: 'Participante', minPoints: 20, maxPoints: 64, icon: '3' },
  { level: 4, name: 'Colaborador', minPoints: 65, maxPoints: 154, icon: '4' },
  { level: 5, name: 'Constante', minPoints: 155, maxPoints: 514, icon: '5' },
  { level: 6, name: 'Referente', minPoints: 515, maxPoints: 2014, icon: '6' },
  { level: 7, name: 'Experto', minPoints: 2015, maxPoints: 8014, icon: '7' },
  { level: 8, name: 'Mentor', minPoints: 8015, maxPoints: 33014, icon: '8' },
  { level: 9, name: 'Leyenda', minPoints: 33015, maxPoints: Infinity, icon: '9' },
];

export function getLevelInfo(level: number): LevelInfo {
  // clamp: un nivel fuera de rango se pinta como la cima
  return LEVEL_THRESHOLDS[Math.min(Math.max(level, 1) - 1, LEVEL_THRESHOLDS.length - 1)];
}

export function getPointsForNextLevel(currentPoints: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 0;
  const nextLevel = LEVEL_THRESHOLDS[currentLevel];
  return nextLevel.minPoints - currentPoints;
}

export function getLevelProgress(currentPoints: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 100;
  const currentLevelInfo = LEVEL_THRESHOLDS[currentLevel - 1];
  const nextLevelInfo = LEVEL_THRESHOLDS[currentLevel];
  const pointsInLevel = currentPoints - currentLevelInfo.minPoints;
  const pointsNeeded = nextLevelInfo.minPoints - currentLevelInfo.minPoints;
  return Math.min(Math.round((pointsInLevel / pointsNeeded) * 100), 100);
}
