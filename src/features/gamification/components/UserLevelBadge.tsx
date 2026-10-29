// ============================================
// UserLevelBadge Component
// ============================================
// Displays user's level badge with optional size variants

'use client';

import { getLevelInfo, LevelInfo } from '../types';

interface UserLevelBadgeProps {
  level: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'from-gray-400 to-gray-500',
  2: 'from-green-400 to-green-500',
  3: 'from-blue-400 to-blue-500',
  4: 'from-purple-400 to-purple-500',
  5: 'from-yellow-400 to-yellow-500',
  6: 'from-orange-400 to-orange-500',
  7: 'from-red-400 to-red-500',
  8: 'from-pink-400 to-pink-500',
  9: 'from-indigo-400 via-purple-500 to-pink-500',
};

export function UserLevelBadge({ level, size = 'md', showName = false }: UserLevelBadgeProps) {
  const levelInfo = getLevelInfo(level);
  const colorClass = LEVEL_COLORS[level] || LEVEL_COLORS[1];

  const sizeClasses = {
    xs: 'w-4 h-4 text-3xs',
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center font-bold text-white shadow-md`}
        title={`${levelInfo.name} - Nivel ${level}`}
      >
        {level}
      </div>
      {showName && (
        <span className="text-xs text-muted-foreground">{levelInfo.name}</span>
      )}
    </div>
  );
}
