import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// ============================================================
// PROXY (Next.js 16, antes middleware.ts)
// Solo AUTENTICACIÓN con getUser(). La autorización real (acceso a la
// comunidad, roles) vive en los layouts y Server Components.
// ============================================================

// Rutas públicas exactas (lookup O(1))
const PUBLIC_PATHS = new Set(['/login', '/reset-password', '/sin-acceso']);

// Rutas que exigen sesión
const PROTECTED_PREFIXES = [
  '/community',
  '/classroom',
  '/calendar',
  '/members',
  '/profile',
  '/admin',
  '/leaderboard',
  '/map',
  '/call',
  '/notifications',
  '/search',
];

const isProtectedPath = (pathname: string): boolean =>
  PROTECTED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Defensa en profundidad: el matcher ya excluye estas rutas.
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
    return NextResponse.next({ request });
  }

  // Rutas públicas: sin chequeo de sesión
  const normalizedPath = pathname.replace(/\/$/, '') || '/';
  if (PUBLIC_PATHS.has(normalizedPath)) {
    return NextResponse.next({ request });
  }

  // Pre-chequeo barato: ¿hay cookie de sesión?
  const hasAuthCookie = request.cookies.getAll().some(c =>
    c.name.includes('auth-token') || c.name.includes('sb-')
  );

  if (!hasAuthCookie) {
    if (pathname === '/' || isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // CRÍTICO: getUser() valida el token contra Supabase Auth.
  // getSession() solo verifica el formato local (se puede falsificar).
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Proxy] getUser error:', error.message);
      }
    } else {
      user = data.user;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Proxy] Auth exception:', error);
    }
  }

  // Cookie presente pero token inválido/expirado → /login
  if (!user) {
    if (pathname === '/' || isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return supabaseResponse;
  }

  // Con sesión: la raíz va a la comunidad (el layout decide el acceso)
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/community', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * EXCLUIDAS (no pasan por el proxy):
     * - _next/static, _next/image (internos de Next.js)
     * - api/ (cada ruta API maneja su propia auth)
     * - auth/ (callbacks de Supabase Auth)
     * - sw.js, manifest.json (PWA) e icons/
     * - favicon.png, logo.png, apple-touch-icon.png
     * - map/world-geometry.json (geometría pública del mapa)
     * - robots.txt, sitemap*.xml
     * - assets estáticos por extensión (imágenes, fuentes, audio/video)
     */
    '/((?!_next/static|_next/image|api/|auth/|sw\\.js|manifest\\.json|icons/|favicon\\.png|logo\\.png|apple-touch-icon\\.png|robots\\.txt|sitemap.*\\.xml|map/world-geometry\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wav|mp4|woff|woff2|ttf|eot|otf)$).*)',
  ],
};
