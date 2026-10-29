// ============================================
// API Route: Webhook for Auto Push & Email Notifications
// ============================================
// Receives Supabase Database Webhook on notifications INSERT
// Two notification types:
//   - admin_post: Push notifications (individual per user, N webhooks)
//   - admin_post_email_broadcast: Email broadcast (1 single webhook)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySupabaseWebhookRequest } from '@/shared/lib/internal-request-auth';
import webpush from 'web-push';
import { BRAND } from '@/shared/config/brand';
import { sendAdminAnnouncementEmails } from '@/features/notifications/services/emailNotificationService';
import { deliverPush } from '@/features/notifications/services/pushDelivery';

// Supabase webhook payload structure
interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    read: boolean;
    created_at: string;
  };
  old_record: null | Record<string, unknown>;
}

// Helper to get initialized Supabase client
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to configure web-push
function configureWebPush() {
  webpush.setVapidDetails(
    (process.env.VAPID_SUBJECT || `mailto:${BRAND.supportEmail}`).trim(),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
}

// Registro auditable del broadcast de email.
// Existe porque el bug de julio 2026 (trigger sin el bloque de email) duro 16 dias:
// el resultado del envio solo vivia en un console.log que nadie lee. Nunca lanza:
// si el registro falla, el envio ya ocurrio y no debe romperse por la bitacora.
async function logEmailBroadcast(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  entry: {
    postId: string | null;
    notificationId: string;
    status: 'sent' | 'partial' | 'failed' | 'no_recipients';
    recipientsTotal: number;
    sent: number;
    failed: number;
    errors: string[];
  }
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('admin_email_broadcast_log')
      .upsert(
        {
          post_id: entry.postId,
          notification_id: entry.notificationId,
          status: entry.status,
          recipients_total: entry.recipientsTotal,
          sent: entry.sent,
          failed: entry.failed,
          errors: entry.errors,
        },
        { onConflict: 'notification_id' }
      );

    if (error) {
      console.error('[Webhook] No se pudo registrar el broadcast:', error);
    }
  } catch (logError) {
    console.error('[Webhook] Excepcion al registrar el broadcast:', logError);
  }
}

export async function POST(request: NextRequest) {
  if (!verifySupabaseWebhookRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Webhook] Received notification webhook');

  try {
    // Parse webhook payload
    const payload: WebhookPayload = await request.json();
    console.log('[Webhook] Payload type:', payload.type, 'table:', payload.table);

    // Only process INSERT events on notifications table
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      console.log('[Webhook] Ignoring non-INSERT or non-notifications event');
      return NextResponse.json({ success: true, message: 'Ignored' });
    }

    const { record } = payload;
    const { id: notificationId, user_id, title, body, data, type: notificationType } = record;

    console.log('[Webhook] Processing notification type:', notificationType, 'for user:', user_id);

    const supabaseAdmin = getSupabaseAdmin();

    // ============================================
    // EMAIL BROADCAST: Triggered by admin_post_email_broadcast (1 single webhook)
    // Sends directly to ALL eligible members (Resend Pro - no daily limits)
    // ============================================
    if (notificationType === 'admin_post_email_broadcast' && data) {
      console.log('[Webhook] Email broadcast detected, fetching eligible members');

      const broadcastPostId = (data.post_id as string) || null;

      const { data: eligibleMembers, error: membersError } = await supabaseAdmin
        .rpc('get_email_eligible_members');

      if (membersError) {
        console.error('[Webhook] Error fetching eligible members:', membersError);
        await logEmailBroadcast(supabaseAdmin, {
          postId: broadcastPostId,
          notificationId,
          status: 'failed',
          recipientsTotal: 0,
          sent: 0,
          failed: 0,
          errors: [`get_email_eligible_members: ${membersError.message}`],
        });
        return NextResponse.json({ success: false, error: 'Failed to fetch eligible members' }, { status: 500 });
      }

      if (!eligibleMembers || eligibleMembers.length === 0) {
        console.log('[Webhook] No eligible members for email');
        await logEmailBroadcast(supabaseAdmin, {
          postId: broadcastPostId,
          notificationId,
          status: 'no_recipients',
          recipientsTotal: 0,
          sent: 0,
          failed: 0,
          errors: [],
        });
        return NextResponse.json({ success: true, message: 'No eligible members', email: { sent: 0 } });
      }

      console.log('[Webhook] Sending emails to', eligibleMembers.length, 'recipients (including author)');

      const emailRecipients = eligibleMembers.map((r: { user_id: string; email: string }) => ({
        user_id: r.user_id,
        email: r.email,
      }));

      // Extract post data from the notification's data field
      const postContent = (data.post_content as string) || '';
      const mediaUrls = (data.media_urls as string[]) || [];
      const postTitle = body || 'Nuevo anuncio';

      // El video se LEE de la tabla, no del payload del trigger. Meterlo en el
      // trigger obligaria a otra migracion sobre la funcion que ya se perdio una
      // vez en produccion (9 jul: un CREATE OR REPLACE borro notify_admin_post y
      // 4 anuncios no llegaron a ~471 correos durante 16 dias). Un SELECT aqui
      // consigue lo mismo sin volver a tocar esa pieza.
      let videoEmbedUrl: string | null = null;
      if (broadcastPostId) {
        const { data: postRow } = await supabaseAdmin
          .from('posts')
          .select('video_embed_url')
          .eq('id', broadcastPostId)
          .maybeSingle();
        videoEmbedUrl = (postRow?.video_embed_url as string) || null;
      }

      // Await email sending before returning (serverless functions terminate after response)
      // emailNotificationService handles batching internally (100 per batch, 1s delay)
      let emailResult;
      try {
        emailResult = await sendAdminAnnouncementEmails({
          recipients: emailRecipients,
          authorName: (data.author_name as string) || 'Admin',
          authorAvatar: (data.author_avatar as string) || null,
          postId: data.post_id as string,
          postTitle,
          postContent,
          mediaUrls,
          videoEmbedUrl,
        });
      } catch (sendError) {
        // Sin este registro, una excepcion de Resend seria invisible: el post se ve
        // publicado y nadie sabe que el correo nunca salio.
        console.error('[Webhook] Email broadcast threw:', sendError);
        await logEmailBroadcast(supabaseAdmin, {
          postId: broadcastPostId,
          notificationId,
          status: 'failed',
          recipientsTotal: eligibleMembers.length,
          sent: 0,
          failed: eligibleMembers.length,
          errors: [sendError instanceof Error ? sendError.message : String(sendError)],
        });
        return NextResponse.json({ success: false, error: 'Email broadcast failed' }, { status: 500 });
      }

      console.log('[Webhook] Email broadcast result:', emailResult);

      const broadcastStatus =
        emailResult.failed === 0 ? 'sent' : emailResult.sent === 0 ? 'failed' : 'partial';

      await logEmailBroadcast(supabaseAdmin, {
        postId: broadcastPostId,
        notificationId,
        status: broadcastStatus,
        recipientsTotal: eligibleMembers.length,
        sent: emailResult.sent,
        failed: emailResult.failed,
        errors: emailResult.errors ?? [],
      });

      return NextResponse.json({
        success: true,
        message: 'Email broadcast completed',
        email: { sent: emailResult.sent, failed: emailResult.failed, total_recipients: eligibleMembers.length },
      });
    }

    // ============================================
    // PUSH NOTIFICATIONS: All other notification types
    // ============================================
    configureWebPush();

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (subError) {
      console.error('[Webhook] Error fetching subscriptions:', subError);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Webhook] No push subscriptions for user:', user_id);
      return NextResponse.json({ success: true, message: 'No active subscriptions', sent: 0 });
    }

    // Los DMs traen conversation_id: sirve para colapsar el aviso y para
    // aterrizar en la conversación correcta.
    const conversationId =
      typeof data?.conversation_id === 'string' ? data.conversation_id : null;

    const pushPayload = JSON.stringify({
      title: title || 'Nueva notificacion',
      body: body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: {
        ...data,
        type: notificationType,
        url: data?.url || '/',
      },
      // Un DM se colapsa por CONVERSACIÓN: cinco mensajes seguidos de la misma
      // persona reemplazan la misma notificación en el teléfono en vez de
      // apilar cinco. El resto de la actividad sí es un evento por fila.
      tag: conversationId
        ? `conversation-${conversationId}`
        : `notification-${record.id}`,
      requireInteraction: false,
    });

    // Entrega con reaper justo + telemetría (política única en pushDelivery.ts)
    const sendPromises = subscriptions.map((sub) =>
      deliverPush(supabaseAdmin, sub, pushPayload, notificationType)
    );

    const results = await Promise.all(sendPromises);
    const successCount = results.filter((r) => r.success).length;

    console.log('[Webhook] Push notifications sent:', successCount, '/', subscriptions.length);

    return NextResponse.json({
      success: true,
      message: 'Notifications processed',
      push: { sent: successCount, total: subscriptions.length },
    });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
