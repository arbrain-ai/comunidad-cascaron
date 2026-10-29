import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { safeLoginRedirect } from '@/shared/lib/safe-login-redirect';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Default redirect to /community, can be overridden via 'next' param
  const next = safeLoginRedirect(searchParams.get('next'));

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // Use Supabase's default cookie options
                cookieStore.set(name, value, options);
              });
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] Error:', error.message);
      return NextResponse.redirect(`${origin}/?error=auth_error`);
    }

    // Stay on the request's origin; client-supplied forwarding headers do not
    // choose where an authenticated browser goes after the code exchange.
    return NextResponse.redirect(new URL(next, origin));
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${origin}/`);
}
