// ============================================
// API Route: Push Subscription Status (reconciliacion navegador <-> BD)
// ============================================
// El cliente manda el endpoint de su suscripcion local y este route responde
// la VERDAD de la BD: ¿existe una fila para este usuario+endpoint?
// Es la pieza que faltaba desde el revert de enero (el toggle mostraba
// "activo" para siempre porque solo miraba pushManager.getSubscription()).
//
// Efecto lateral intencional: si la fila existe, se refresca last_used_at
// ("señal de vida") para que el cleanup de 90 dias nunca borre una
// suscripcion cuyo dueño sigue abriendo la app.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
    }

    const endpoint = request.nextUrl.searchParams.get('endpoint');

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rows, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('user_id', userId);

    if (error) {
      console.error('[API Push Status] Query error:', error);
      return NextResponse.json({ error: 'Error consultando estado' }, { status: 500 });
    }

    const thisDevice = !!endpoint && (rows ?? []).some((r) => r.endpoint === endpoint);

    if (thisDevice) {
      await admin
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('endpoint', endpoint!);
    }

    return NextResponse.json({
      subscribed: thisDevice,
      devices: rows?.length ?? 0,
    });
  } catch (error) {
    console.error('[API Push Status] Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
