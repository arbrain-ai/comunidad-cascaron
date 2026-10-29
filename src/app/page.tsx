import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';

// Raíz: con sesión → /community, sin sesión → /login.
// El proxy ya hace esta redirección; esto es la red de seguridad.
export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  redirect(user ? '/community' : '/login');
}
