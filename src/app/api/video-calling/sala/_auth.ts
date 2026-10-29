// Autenticacion compartida de las rutas de la sala: token de Supabase en el
// header y el perfil (rol) del que llama. Server-side only.
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
let _admin: ReturnType<typeof crearSupabaseAdmin> | null = null;
export const supabaseAdmin = () => (_admin ??= crearSupabaseAdmin());

export interface Quien {
  id: string;
  role: string;
  full_name: string;
}

export async function quienLlama(request: NextRequest): Promise<Quien | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ).auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin()
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();
  if (!profile) return null;
  return profile as Quien;
}
