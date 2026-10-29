/**
 * API Route Authentication Helpers
 *
 * Use these in Next.js API routes to authenticate callers via
 * Supabase session cookies. Do NOT use in middleware/edge — use
 * `createServerSupabaseClient` from `supabase-server.ts` there.
 *
 * Usage:
 *   export async function POST(request: NextRequest) {
 *     const userId = await getAuthenticatedUserId();
 *     if (!userId) return unauthorized();
 *     // ... use userId safely (verified against Supabase Auth)
 *   }
 *
 *   // For admin-only endpoints:
 *   const { userId, role } = await requireAdminRole();
 *   if (!userId) return unauthorized();
 *   if (!role) return forbidden('Admin only');
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Returns the authenticated user's ID from Supabase session cookies,
 * or null if not authenticated / token invalid.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
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
          // no-op in API route
        },
      },
    }
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * Returns { userId, isAdmin } where isAdmin is true only if the caller
 * is an authenticated user with role IN ('admin', 'owner').
 * Uses service_role client to check role (profiles RLS would prevent
 * self-lookup of role field in some configs).
 */
export async function requireAdminRole(): Promise<{ userId: string | null; isAdmin: boolean }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { userId: null, isAdmin: false };

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) return { userId, isAdmin: false };
  return { userId, isAdmin: data.role === 'admin' || data.role === 'owner' };
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}
