import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';

export class ActionAuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
    public readonly code: 'AUTH_REQUIRED' | 'FORBIDDEN' | 'MFA_REQUIRED' = status === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN',
  ) {
    super(message);
    this.name = 'ActionAuthorizationError';
  }
}

export interface ActionActor {
  id: string;
  email?: string;
}

function publicAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// The cookie session only supplies a credential. Its user/role claims are never
// accepted before Auth verifies that exact credential. No cross-request cache.
async function verifiedIdentity(bearerToken?: string) {
  const client = bearerToken === undefined
    ? await createServerSupabaseClient()
    : publicAuthClient();
  let token = bearerToken;
  if (token === undefined) {
    const { data, error } = await client.auth.getSession();
    if (error) throw new ActionAuthorizationError(401, 'Debes iniciar sesión');
    token = data.session?.access_token;
  }
  if (!token) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ActionAuthorizationError(401, 'Debes iniciar sesión');
  return { client, token, actor: { id: data.user.id, email: data.user.email } };
}

/** Anonymous callers are allowed, but may never select another account. */
export async function getOptionalActionActor(expectedUserId?: string): Promise<ActionActor | null> {
  const identity = await verifiedIdentity();
  if (expectedUserId !== undefined && (!identity || expectedUserId !== identity.actor.id)) {
    throw new ActionAuthorizationError(identity ? 403 : 401, 'No tienes permiso para esta cuenta');
  }
  return identity?.actor ?? null;
}

export async function requireOwnActionActor(expectedUserId?: string): Promise<ActionActor> {
  const actor = await getOptionalActionActor(expectedUserId);
  if (!actor) throw new ActionAuthorizationError(401, 'Debes iniciar sesión');
  return actor;
}

/** bearerToken is an internal API adapter, never an argument of a public action. */
export async function requireAdminActionActor(bearerToken?: string): Promise<ActionActor> {
  const identity = await verifiedIdentity(bearerToken);
  if (!identity) throw new ActionAuthorizationError(401, 'Debes iniciar sesión');

  const { data: assurance, error: assuranceError } = await identity.client.auth.mfa
    .getAuthenticatorAssuranceLevel(identity.token);
  if (assuranceError || assurance?.currentLevel !== 'aal2') {
    throw new ActionAuthorizationError(403, 'Verifica tu segundo factor para continuar', 'MFA_REQUIRED');
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: profile, error } = await admin.from('profiles').select('role')
    .eq('id', identity.actor.id).single();
  if (error || !profile || !['admin', 'owner'].includes(profile.role)) {
    throw new ActionAuthorizationError(403, 'No tienes permiso para esta operación');
  }
  return identity.actor;
}
