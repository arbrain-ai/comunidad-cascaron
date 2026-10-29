import { guardAdminRequest } from '@/shared/lib/admin-route-auth';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Admin client with service_role for user deletion
// Perezoso a proposito: creado al importar, esto corre durante el BUILD y
// tumba la compilacion en cualquier entorno sin las variables de Supabase.
const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const supabaseAdmin = () => (_supabaseAdmin ??= crearSupabaseAdmin());

// Regular client for auth verification
// Perezoso a proposito: creado al importar, esto corre durante el BUILD y
// tumba la compilacion en cualquier entorno sin las variables de Supabase.
const crearSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
let _supabase: ReturnType<typeof crearSupabase> | null = null;
const supabase = () => (_supabase ??= crearSupabase());

// Helper to check if user has admin access (owner or admin)
const hasAdminAccess = (role: string) => role === 'owner' || role === 'admin';

// Helper to check if user can delete target
const canDeleteUser = (currentRole: string, targetRole: string) => {
  // Only owners can delete admins or other owners
  if (targetRole === 'owner' || targetRole === 'admin') {
    return currentRole === 'owner';
  }
  // Admins and owners can delete members and moderators
  return hasAdminAccess(currentRole);
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFailure = await guardAdminRequest(request);
  if (authFailure) return authFailure;

  try {
    const { id: userId } = await params;

    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Verify the user from token
    const { data: { user }, error: authError } = await supabase().auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if requesting user is admin or owner
    const { data: profile } = await supabaseAdmin()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!hasAdminAccess(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden: Admin or Owner only' }, { status: 403 });
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    // Get the target user's role to check permissions
    const { data: targetProfile } = await supabaseAdmin()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    // Check if current user can delete the target user
    if (!canDeleteUser(profile?.role || '', targetProfile?.role || '')) {
      return NextResponse.json({
        error: 'Forbidden: Only owners can delete admins or other owners'
      }, { status: 403 });
    }

    // Delete user from auth.users (cascades to profiles via FK)
    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// PATCH — cambiar rol, tier o acceso de un miembro
// ============================================================
// Vive en el servidor a proposito. Hasta el 3 sep 2026 el panel de admin
// escribia `role`, `tier` y `has_community_access` directo desde el navegador
// con el anon key, y eso obligaba a que la tabla `profiles` aceptara esas
// columnas de cualquier autenticado: el mismo permiso que dejaba a un miembro
// hacerse owner. La migracion 20260903_rls_profiles_columnas cierra ese
// permiso, y esta ruta es la unica puerta que queda.

const ROLES_VALIDOS = ['owner', 'admin', 'moderator', 'member'];
const TIERS_VALIDOS = ['free', 'standard', 'premium', 'vip', 'no-paid', 'cancelled'];

// Repartir o quitar poderes de administracion es cosa de owners. Un admin
// puede mover miembros y moderadores, nunca a otro admin ni a un owner.
const puedeTocarRol = (rolQuienPide: string, rolActual: string, rolNuevo?: string) => {
  const tocaPoder =
    rolActual === 'owner' || rolActual === 'admin' ||
    rolNuevo === 'owner' || rolNuevo === 'admin';
  return tocaPoder ? rolQuienPide === 'owner' : hasAdminAccess(rolQuienPide);
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFailure = await guardAdminRequest(request);
  if (authFailure) return authFailure;

  try {
    const { id: userId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!hasAdminAccess(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden: Admin or Owner only' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body invalido' }, { status: 400 });
    }

    const cambios: Record<string, unknown> = {};

    if ('role' in body) {
      if (!ROLES_VALIDOS.includes(body.role)) {
        return NextResponse.json({ error: `role invalido: ${body.role}` }, { status: 400 });
      }
      // Nadie se cambia su propio rol: ni para subirse, ni para dejarse fuera.
      if (userId === user.id) {
        return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 403 });
      }
      cambios.role = body.role;
    }

    if ('tier' in body) {
      if (!TIERS_VALIDOS.includes(body.tier)) {
        return NextResponse.json({ error: `tier invalido: ${body.tier}` }, { status: 400 });
      }
      cambios.tier = body.tier;
    }

    if ('has_community_access' in body) {
      if (typeof body.has_community_access !== 'boolean') {
        return NextResponse.json({ error: 'has_community_access debe ser booleano' }, { status: 400 });
      }
      cambios.has_community_access = body.has_community_access;
    }

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 });
    }

    const { data: destino } = await supabaseAdmin()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!destino) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!puedeTocarRol(profile?.role || '', destino.role || '', cambios.role as string | undefined)) {
      return NextResponse.json({
        error: 'Forbidden: solo un owner reparte o quita poderes de administracion'
      }, { status: 403 });
    }

    const { error } = await supabaseAdmin()
      .from('profiles')
      .update(cambios)
      .eq('id', userId);

    if (error) {
      console.error('[admin/users PATCH] error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[admin/users PATCH] ${user.id} cambio ${JSON.stringify(cambios)} en ${userId}`);
    return NextResponse.json({ success: true, changed: cambios });
  } catch (error) {
    console.error('Patch user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
