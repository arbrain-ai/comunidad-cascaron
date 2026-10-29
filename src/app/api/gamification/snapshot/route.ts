// ============================================
// GET /api/gamification/snapshot — el leaderboard como FOTO, no como query
// ============================================
// Sin esto cada visita a /leaderboard dispararía desde el browser 1 RPC por
// tab de ranking + 2 llamadas al RPC de distribución: trabajo repetido para
// producir EL MISMO resultado.
//
// El ranking se computa UNA vez cada 3 minutos en el server (donde
// Supabase está a milisegundos, no a 200ms del browser del usuario) y todos
// reciben la misma foto con su "Última actualización". Los 3 periodos viajan
// juntos: cambiar de tab en la UI es instantáneo, cero red.
//
// Auth: cualquier miembro logueado.
// Los datos los computa el service role llamando LOS MISMOS RPCs que usaba
// el cliente (get_leaderboard_by_period, get_level_distribution): una sola
// lógica de negocio, versionada en migraciones.

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';

export const runtime = 'nodejs';

const REVALIDATE_SECONDS = 180;

interface RawLeaderboardRow {
  rank: number;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_points: number | null;
  current_level: number | null;
  points_in_period: number | null;
  is_annual: boolean | null;
}

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          /* no-op: esta ruta no escribe sesión */
        },
      },
    }
  );
  const { data, error } = await supabase.auth.getUser();
  return !error && !!data.user;
}

const getSnapshot = unstable_cache(
  async () => {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const periods = ['7d', '30d', 'all'] as const;
    const [seven, thirty, all, distribution] = await Promise.all([
      ...periods.map((period) =>
        admin.rpc('get_leaderboard_by_period', { period_type: period, result_limit: 10 })
      ),
      admin.rpc('get_level_distribution'),
    ]);

    const normalize = (rows: RawLeaderboardRow[] | null) =>
      (rows || []).map((row) => ({
        rank: row.rank,
        user_id: row.user_id,
        full_name: row.full_name || 'Usuario',
        avatar_url: row.avatar_url,
        total_points: row.total_points || 0,
        current_level: row.current_level || 1,
        points_in_period: row.points_in_period || 0,
        is_annual: row.is_annual || false,
      }));

    const distRows = (distribution.data || []) as { level: number; member_count: number }[];

    return {
      periods: {
        '7d': normalize(seven.data),
        '30d': normalize(thirty.data),
        all: normalize(all.data),
      },
      distribution: distRows,
      totalMembers: distRows.reduce((sum, row) => sum + row.member_count, 0),
      generatedAt: new Date().toISOString(),
    };
  },
  ['gamification-snapshot-participation-v2'],
  { revalidate: REVALIDATE_SECONDS }
);

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await getSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        // El browser puede reusarla 60s sin preguntar; el server ya la sirve
        // cacheada 180s. Doble capa, misma que la referencia estudiada.
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('[gamification/snapshot] error:', error);
    return NextResponse.json({ error: 'Snapshot failed' }, { status: 500 });
  }
}
