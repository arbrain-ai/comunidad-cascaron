// ============================================
// API Route: Send Push Notifications
// ============================================
// Server-side endpoint to send web push notifications

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { BRAND } from '@/shared/config/brand';
import { deliverPush } from '@/features/notifications/services/pushDelivery';
import { stripHtml } from '@/shared/utils/stripHtml';

interface SendPushRequest {
  userId: string;
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, any>;
    tag?: string;
    requireInteraction?: boolean;
  };
}

// Helper to get initialized Supabase client
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to configure web-push (done at runtime, not at module load)
function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `mailto:${BRAND.supportEmail}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    // Verify caller is authorized (Edge Function sends service role key)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Configure web-push at runtime
    configureWebPush();
    const supabaseAdmin = getSupabaseAdmin();

    const body: SendPushRequest = await request.json();
    const { userId, notification } = body;

    // Validate required fields
    if (!userId || !notification || !notification.title) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active subscriptions for this user',
        sent: 0,
      });
    }

    // Prepare notification payload
    // Defensa: el body puede venir de contenido HTML (posts TipTap). Se stripea
    // aqui para que NUNCA lleguen etiquetas crudas al movil, sin importar el origen.
    const payload = JSON.stringify({
      title: stripHtml(notification.title),
      body: stripHtml(notification.body || ''),
      icon: notification.icon || '/icon-192.png',
      badge: notification.badge || '/badge-72.png',
      data: notification.data || {},
      tag: notification.tag,
      requireInteraction: notification.requireInteraction || false,
    });

    // Send to all user's devices — reaper justo + telemetría (pushDelivery.ts)
    const sendPromises = subscriptions.map((sub) =>
      deliverPush(supabaseAdmin, sub, payload, notification.data?.type as string ?? 'direct_send')
    );

    const results = await Promise.all(sendPromises);

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Push notifications sent`,
      sent: successCount,
      failed: failedCount,
      results,
    });

  } catch (error) {
    console.error('Send push notification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
