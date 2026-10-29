'use client';

import Image from 'next/image';
import type { Contributor } from '@/features/admin/services/analyticsService';

interface TopContributorsTableProps {
  contributors: Contributor[];
  title?: string;
  onViewUser?: (userId: string) => void;
}

// Medal colors for top 3
const getMedalColor = (index: number): string => {
  switch (index) {
    case 0:
      return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900'; // Gold
    case 1:
      return 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900'; // Silver
    case 2:
      return 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100'; // Bronze
    default:
      return 'bg-surface text-muted';
  }
};

export function TopContributorsTable({
  contributors,
  title = 'Top Contributors',
  onViewUser,
}: TopContributorsTableProps) {
  if (contributors.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-muted">No hay actividad reciente</p>
            <p className="text-xs text-muted/70 mt-1">Los contribuidores aparecerán aquí</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate max activity for bar width
  const maxActivity = Math.max(...contributors.map((c) => c.totalActivity));

  return (
    <div className="glass-panel rounded-xl p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>

      <div className="space-y-3">
        {contributors.map((contributor, index) => {
          const barWidth = maxActivity > 0 ? (contributor.totalActivity / maxActivity) * 100 : 0;

          return (
            <div
              key={contributor.userId}
              className={`
                relative flex items-center gap-3 p-3 rounded-lg
                bg-surface/30 border border-transparent
                hover:border-glass-border hover:bg-surface/50
                transition-all duration-200
                ${onViewUser ? 'cursor-pointer' : ''}
              `}
              onClick={() => onViewUser?.(contributor.userId)}
            >
              {/* Rank badge */}
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center
                  text-xs font-bold flex-shrink-0
                  ${getMedalColor(index)}
                `}
              >
                {index + 1}
              </div>

              {/* Avatar */}
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-surface flex-shrink-0">
                {contributor.avatarUrl ? (
                  <Image
                    src={contributor.avatarUrl}
                    alt={contributor.fullName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted font-bold text-sm">
                    {contributor.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {contributor.fullName}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted">
                    {contributor.postCount} posts
                  </span>
                  <span className="text-xs text-muted">
                    {contributor.commentCount} comentarios
                  </span>
                </div>
              </div>

              {/* Activity count */}
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-primary">
                  {contributor.totalActivity}
                </p>
                <p className="text-[10px] text-muted uppercase tracking-wider">
                  actividad
                </p>
              </div>

              {/* Activity bar (background) */}
              <div
                className="absolute bottom-0 left-0 h-0.5 rounded-full bg-primary/30 transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted text-center">
          Actividad de los últimos 30 días (posts + comentarios)
        </p>
      </div>
    </div>
  );
}
