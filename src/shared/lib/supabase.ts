import { createBrowserClient } from '@supabase/ssr';

// Obtener las variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén definidas
if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Crear y exportar el cliente de Supabase para Next.js App Router
// Usa createBrowserClient de @supabase/ssr - maneja cookies automáticamente
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper function to get the correct redirect URL based on current environment
 * This ensures that OAuth redirects work correctly in both localhost and production
 */
export function getAuthRedirectUrl(path: string = '/'): string {
  // Get the current origin (works in both localhost and production)
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${origin}${cleanPath}`;
}
