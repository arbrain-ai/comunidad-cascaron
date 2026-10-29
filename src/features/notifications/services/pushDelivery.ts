// ============================================
// Push Delivery — entrega + reaper justo + telemetría
// ============================================
// Única fuente de la política de entrega de web push. La usan
// /api/notifications/webhook y /api/notifications/send (antes duplicaban
// la lógica línea por línea y ambas borraban subs de más).
//
// REAPER JUSTO (2026-07-06, Goal 1):
//   - 404/410: el push service confirmó que la suscripción YA NO EXISTE
//     -> borrar de inmediato (única evidencia concluyente).
//   - 429: rate limit -> no tocar, se reintenta en el siguiente envío.
//   - Todo lo demás (otros 4xx como 400/403 que suelen ser config VAPID,
//     5xx, timeouts de red, "Apple silent failure" = excepción sin
//     statusCode): AMBIGUO -> failed_attempts++ y solo se borra al llegar
//     al umbral de 5 fallos consecutivos. Un envío exitoso resetea a 0.
//   Antes: cualquier excepción sin statusCode BORRABA la sub -> el pool
//   solo decrecía (83 sobrevivientes al 6-jul).
//
// TELEMETRÍA: cada intento deja una fila en push_send_log (best-effort,
// jamás rompe el envío). Purga automática a 30 días vía pg_cron.

import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const FAILURE_THRESHOLD = 5;

export interface PushSubscriptionRow {
  id: string;
  user_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  browser?: string | null;
  failed_attempts?: number | null;
}

export interface DeliveryResult {
  success: boolean;
  removed: boolean;
  reason?: string;
}

type Outcome = 'sent' | 'removed_gone' | 'rate_limited' | 'failed_retryable' | 'removed_after_retries';

function platformOf(endpoint: string): string {
  if (endpoint.includes('web.push.apple.com')) return 'apple';
  if (endpoint.includes('fcm.googleapis.com')) return 'fcm';
  return 'other';
}

async function logAttempt(
  admin: SupabaseClient,
  sub: PushSubscriptionRow,
  outcome: Outcome,
  notificationType: string | null,
  statusCode: number | null,
  error: string | null
): Promise<void> {
  try {
    await admin.from('push_send_log').insert({
      subscription_id: sub.id,
      user_id: sub.user_id,
      platform: platformOf(sub.endpoint),
      notification_type: notificationType,
      outcome,
      status_code: statusCode,
      error: error ? error.slice(0, 500) : null,
    });
  } catch (logError) {
    console.warn('[PushDelivery] Telemetry insert failed (non-fatal):', logError);
  }
}

/**
 * Envía un push a UNA suscripción aplicando la política completa:
 * éxito -> refresh last_used_at + reset failed_attempts;
 * 404/410 -> borrar; ambiguo -> retry con umbral. Todo queda en push_send_log.
 *
 * Precondición: webpush.setVapidDetails() ya configurado por el caller.
 */
export async function deliverPush(
  admin: SupabaseClient,
  sub: PushSubscriptionRow,
  payload: string,
  notificationType: string | null = null
): Promise<DeliveryResult> {
  const platform = platformOf(sub.endpoint);
  const endpointPreview = sub.endpoint.substring(0, 50) + '...';

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );

    await admin
      .from('push_subscriptions')
      .update({
        last_used_at: new Date().toISOString(),
        failed_attempts: 0,
        last_failure_at: null,
      })
      .eq('id', sub.id);

    await logAttempt(admin, sub, 'sent', notificationType, null, null);
    console.log('[PushDelivery] Sent:', platform, endpointPreview);
    return { success: true, removed: false };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode ?? null;
    const message = error instanceof Error ? error.message : 'Unknown';

    console.error('[PushDelivery] Failed:', JSON.stringify({
      statusCode,
      message,
      platform,
      browser: sub.browser,
      endpoint: endpointPreview,
    }));

    // Evidencia concluyente: la suscripción ya no existe en el push service
    if (statusCode === 404 || statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('id', sub.id);
      await logAttempt(admin, sub, 'removed_gone', notificationType, statusCode, message);
      console.log('[PushDelivery] Removed (gone):', statusCode, platform, sub.id);
      return { success: false, removed: true, reason: `gone_${statusCode}` };
    }

    // Rate limit: no es culpa de la suscripción
    if (statusCode === 429) {
      await logAttempt(admin, sub, 'rate_limited', notificationType, statusCode, message);
      console.warn('[PushDelivery] Rate limited, will retry on next send');
      return { success: false, removed: false, reason: 'rate_limit' };
    }

    // Fallo AMBIGUO (otros 4xx, 5xx, timeout, Apple silent failure):
    // retry con umbral en vez de borrar a la primera.
    const attempts = (sub.failed_attempts ?? 0) + 1;

    if (attempts >= FAILURE_THRESHOLD) {
      await admin.from('push_subscriptions').delete().eq('id', sub.id);
      await logAttempt(admin, sub, 'removed_after_retries', notificationType, statusCode, message);
      console.log('[PushDelivery] Removed after', attempts, 'consecutive failures:', platform, sub.id);
      return { success: false, removed: true, reason: `retries_exhausted_${attempts}` };
    }

    await admin
      .from('push_subscriptions')
      .update({
        failed_attempts: attempts,
        last_failure_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    await logAttempt(admin, sub, 'failed_retryable', notificationType, statusCode, message);
    console.warn('[PushDelivery] Ambiguous failure', attempts, '/', FAILURE_THRESHOLD, ':', platform, sub.id);
    return { success: false, removed: false, reason: `retryable_${attempts}` };
  }
}
