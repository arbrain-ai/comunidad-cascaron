// ============================================
// LevelHUD — tu nivel en el header, visible en TODA la app
// ============================================
// Antes había que ir al leaderboard para saber tu nivel. Ahora vive junto
// al avatar: insignia + barra de luz hacia el siguiente peldaño. Tocar
// lleva a la escalera. Compacto en móvil (solo la insignia con anillo).

'use client';

import Link from 'next/link';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { getLevelInfo, getLevelProgress, MAX_LEVEL } from '../types';

export function LevelHUD() {
  const { userProfile } = useUserProfile();

  if (!userProfile) return null;

  const level = userProfile.current_level || 1;
  const points = userProfile.total_points || 0;
  const progress = level >= MAX_LEVEL ? 100 : getLevelProgress(points, level);
  const levelInfo = getLevelInfo(level);

  return (
    <Link
      href="/leaderboard"
      data-tour="level-hud"
      title={`${levelInfo.name} · ${points.toLocaleString()} pts · toca para ver tu camino`}
      className="group flex items-center gap-2 px-1.5 md:px-2 py-1 rounded-full es-tuyo-fondo hover:brightness-110 transition-all"
    >
      {/* Insignia con anillo de progreso */}
      <span className="relative w-6 h-6 flex-shrink-0">
        <svg viewBox="0 0 28 28" className="w-6 h-6 -rotate-90">
          <circle cx="14" cy="14" r="12" fill="none" stroke="var(--border)" strokeWidth="2.5" />
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(progress / 100) * 75.4} 75.4`}
            className="transition-all duration-700"
          />
        </svg>
        {/* Sin color propio: hereda --ambar-tuyo de .es-tuyo-fondo (LEY §1.1 —
            "tu nivel actual" es tuyo, no es morado). */}
        <span className="absolute inset-0 flex items-center justify-center text-3xs font-black">
          {level}
        </span>
      </span>

      {/* Nombre + barra (solo desktop) */}
      <span className="hidden md:flex flex-col min-w-[72px] pr-1">
        <span className="text-3xs font-semibold leading-tight">
          {levelInfo.name}
        </span>
        <span className="mt-0.5 h-1 rounded-full bg-background/70 overflow-hidden">
          {/* bg-gold, no bg-primary: "tu progreso" también es ámbar (LEY §1.1) */}
          <span
            className="block h-full rounded-full bg-gold transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </span>
      </span>
    </Link>
  );
}
