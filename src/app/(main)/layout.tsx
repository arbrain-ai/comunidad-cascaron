import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { MainHeader } from '@/shared/components/MainHeader';
import { MobileTabsNav } from '@/shared/components/MobileTabsNav';
import { BottomNav } from '@/shared/components/BottomNav';
import { PushReviveBanner } from '@/features/notifications/components/PushReviveBanner';
import { LevelUpNotifier } from '@/features/gamification/components';
import { ScrollRestoration } from '@/shared/components/ScrollRestoration';

// CRÍTICO: Este es un Server Component async que verifica autorización
// El middleware ya validó auth con getUser() - aquí solo necesitamos user.id para profile query
// La autorización REAL es el profile query (has_community_access, role)
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();

  // 1. Obtener user.id del JWT (NO hace network call, solo decode de cookie)
  // Middleware ya validó el token con getUser() - esto es safe
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect('/login');
  }

  // 2. Fetch profile FRESCO via raw HTTP a Supabase REST con service role.
  // supabase-js + noStore + dynamic NO bypasseaban el Vercel Data Cache que ya
  // tenia un profile stale guardado. Raw fetch con cache-buster + no-store +
  // service role garantiza que siempre llega a DB.
  const profileRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=id,has_community_access,role,tier,onboarding_completed`,
    {
      cache: 'no-store',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
        // Cache-buster vía header (no via query — PostgREST lo confunde con filtro)
        'X-Cache-Bust': String(Date.now()),
      },
    }
  );
  const profileRows = profileRes.ok ? (await profileRes.json()) as Array<{
    id: string;
    has_community_access: boolean;
    role: string;
    tier: string;
    onboarding_completed: boolean;
  }> : [];
  const profile = profileRows[0] ?? null;


  // 3. Verificar autorización - owners/admins siempre tienen acceso
  const isPowerUser = profile?.role === 'owner' || profile?.role === 'admin';
  const hasAccess = isPowerUser || profile?.has_community_access;

  if (!hasAccess) {
    redirect('/sin-acceso');
  }

  // 5. Usuario autorizado - renderizar layout
  return (
    <>
      <div className="sf-app-shell">
        <div className="sf-atmosphere" />
        {/* Main Navigation */}
        <nav className="titanium-header glass-panel-strong sticky top-0 z-50">
          <div className="sf-container">
            {/* Header unificado: Logo, Nav, Search, Actions — 1 fila */}
            <MainHeader />
          </div>

          {/* Mobile Tabs Navigation - Shows below header on mobile */}
          <MobileTabsNav />
        </nav>

        {/* Main Content - Unified container matching header */}
        <main className="sf-mobile-safe">
          <div className="sf-container py-3 md:py-6">
            {children}
          </div>
        </main>

        {/* Bottom Navigation (Mobile only) */}
        <BottomNav />

        {/* 🔔 Campaña suave de re-suscripción push (PWA móvil sin canal) */}
        <PushReviveBanner />

        {/* 🎉 Level Up Celebration */}
        <LevelUpNotifier />

        {/* Scroll position restoration for main nav routes */}
        <ScrollRestoration />
      </div>
    </>
  );
}
