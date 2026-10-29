// ============================================
// API Route: Subscribe to Push Notifications
// ============================================
// SEGURIDAD (2026-07-06, post-hardening 13-abr):
// - La identidad se verifica SERVER-SIDE. NUNCA se confia en un userId del body
//   (el modelo viejo con ANON_KEY + RLS quedo roto el 13-abr: auth.uid() era NULL
//   y todos los INSERT reales fallaban 500 en silencio — 0 subs nuevas en 85 dias).
// - Resolucion de identidad, en orden:
//     1. Cookie de sesion Supabase (toggle normal + fetch del SW con credentials)
//     2. Herencia por oldEndpoint (pushsubscriptionchange sin sesion viva):
//        la fila vieja ya tiene el user_id dueño del dispositivo.
//     3. Sin identidad -> 401. NUNCA se crean filas huerfanas (BD ademas lo
//        prohibe: user_id NOT NULL desde 20260706_push_pipeline_revival.sql).
// - Escrituras via service_role (RLS queda estricto para clientes directos).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/shared/lib/api-auth';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription, deviceInfo, oldEndpoint } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    if (!endpoint.startsWith('https://')) {
      return NextResponse.json({ error: 'El endpoint debe ser HTTPS' }, { status: 400 });
    }

    if (!p256dh || !auth) {
      return NextResponse.json({ error: 'Faltan keys de encriptación' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1. Identidad primaria: sesion Supabase (cookies)
    let userId = await getAuthenticatedUserId();
    let identitySource: 'session' | 'old_endpoint' | null = userId ? 'session' : null;

    // 2. Fallback: heredar user_id de la suscripcion vieja (pushsubscriptionchange)
    if (!userId && oldEndpoint) {
      const { data: oldRow } = await admin
        .from('push_subscriptions')
        .select('user_id')
        .eq('endpoint', oldEndpoint)
        .maybeSingle();

      if (oldRow?.user_id) {
        userId = oldRow.user_id;
        identitySource = 'old_endpoint';
      }
    }

    if (!userId) {
      console.warn('[API Subscribe] Rejected: no verifiable identity (no session, no inheritable oldEndpoint)');
      return NextResponse.json(
        { error: 'Sesión requerida para activar notificaciones' },
        { status: 401 }
      );
    }

    // Rotacion de endpoint: borrar la fila vieja antes de guardar la nueva
    if (oldEndpoint && oldEndpoint !== endpoint) {
      console.log('[API Subscribe] Endpoint rotated, removing old row');
      await admin.from('push_subscriptions').delete().eq('endpoint', oldEndpoint);
    }

    // Upsert por endpoint (unico global desde 20260706). Si el endpoint ya
    // existia con otro user_id (cambio de sesion en el mismo dispositivo),
    // se reasigna al usuario actual — el dispositivo manda.
    const { data, error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: deviceInfo?.userAgent,
          browser: deviceInfo?.platform,
          last_used_at: new Date().toISOString(),
          failed_attempts: 0,
          last_failure_at: null,
        },
        { onConflict: 'endpoint' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('[API Subscribe] Upsert error:', error);
      return NextResponse.json({ error: 'Error al guardar suscripción' }, { status: 500 });
    }

    console.log('[API Subscribe] Saved. id:', data?.id, 'identity:', identitySource);
    return NextResponse.json({
      success: true,
      message: 'Suscripción guardada',
      subscription_id: data?.id,
    });
  } catch (error) {
    console.error('[API Subscribe] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

// DELETE: desuscribir. Requiere sesion. Borra por endpoint (el endpoint es una
// capability URL inguessable: conocerlo = controlar ese browser), sin filtrar
// por user_id para que un cambio de cuenta en el mismo dispositivo no deje
// filas zombie. Devuelve removed para que el cliente sepa la verdad.
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 });
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: removed, error } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .select('id');

    if (error) {
      console.error('[API Unsubscribe] Error:', error);
      return NextResponse.json({ error: 'Error al eliminar suscripción' }, { status: 500 });
    }

    console.log('[API Unsubscribe] Removed rows:', removed?.length ?? 0);
    return NextResponse.json({
      success: true,
      removed: removed?.length ?? 0,
      message: 'Suscripción eliminada',
    });
  } catch (error) {
    console.error('[API Unsubscribe] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
