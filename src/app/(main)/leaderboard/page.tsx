// ============================================
// Tu Camino — la escalera de niveles (v2)
// ============================================
// Reemplazo total de la página de leaderboard: la protagonista es la
// ESCALERA permanente (camino de luz), con la acción siempre antes que el
// número. Los rankings y la distribución sobreviven como secundarios.
// Demo de la Ignición sin ganar puntos reales: ?ignicion=N

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useUserPoints } from '@/features/gamification/hooks';
import {
  LevelLadder,
  HowToEarn,
  LeaderboardPanel,
  LevelDistribution,
  Ignition,
} from '@/features/gamification/components';
import { getRungConfig } from '@/features/gamification/config/levels';
import { MAX_LEVEL } from '@/features/gamification/types';
import { sbAvatar } from '@/shared/lib/sbImage';

export default function LeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, isLoading: profileLoading } = useUserProfile();
  const { points, rank, levelInfo } = useUserPoints();

  // Demo de la Ignición (dev/QA): ?ignicion=4 la dispara sin puntos reales
  const ignicionParam = searchParams.get('ignicion');
  const [demoDismissed, setDemoDismissed] = useState(false);
  const demoLevel = ignicionParam ? Math.min(Math.max(parseInt(ignicionParam, 10) || 0, 2), MAX_LEVEL) : 0;

  if (!profileLoading && userProfile && !userProfile.full_name) {
    router.push('/profile');
    return null;
  }
  if (!profileLoading && !userProfile) {
    router.push('/community');
    return null;
  }

  const level = points?.current_level || userProfile?.current_level || 1;
  const nextRung = level < MAX_LEVEL ? getRungConfig(level + 1) : null;

  return (
    <div className="min-h-dvh">
      <div className="py-2 md:py-4">
        {/* Cabecera: quién eres + LA ACCIÓN (nunca solo el número) */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/40 shadow-[0_0_18px_rgba(139,92,246,0.25)]">
                {points?.avatar_url ? (
                  <Image
                    src={sbAvatar(points.avatar_url, 56)}
                    alt={points.full_name}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary-hover">
                    {(points?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Tu nivel actual: ámbar pleno (es tuyo y es el de ahora) */}
              <span className="es-vivo-punto absolute -bottom-1 -right-1 w-6 h-6 rounded-full text-black text-2xs font-black flex items-center justify-center border-2 border-background">
                {level}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight truncate">
                Tu camino
              </h1>
              <p className="text-sm text-muted truncate">
                <span className="text-primary-hover font-medium">{levelInfo?.name}</span>
                {' · '}{(points?.total_points ?? 0).toLocaleString()} pts
                {rank ? <> · ranking #{rank}</> : null}
              </p>
            </div>
          </div>

          {nextRung && (
            <Link href={nextRung.cta.href} className="btn-gold text-sm flex-shrink-0 self-start md:self-auto">
              {nextRung.cta.label}
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* La escalera: protagonista */}
          <div className="lg:col-span-2">
            <LevelLadder />
          </div>

          {/* Secundarios */}
          <div className="space-y-5">
            <HowToEarn />
            <LeaderboardPanel />
            <LevelDistribution />
          </div>
        </div>
      </div>

      {/* Ignición en modo demo */}
      {demoLevel > 0 && !demoDismissed && (
        <Ignition
          previousLevel={demoLevel - 1}
          newLevel={demoLevel}
          onDismiss={() => setDemoDismissed(true)}
        />
      )}
    </div>
  );
}
