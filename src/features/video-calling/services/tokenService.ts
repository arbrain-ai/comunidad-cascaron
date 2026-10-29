// ============================================
// VIDEO CALLING - TOKEN SERVICE
// ============================================
// Generates LiveKit access tokens (SERVER-SIDE ONLY)
// This file must NEVER be imported in client components.

import { AccessToken, type TrackSource } from 'livekit-server-sdk';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, TOKEN_TTL_SECONDS, LIVEKIT_WS_URL } from '../config/livekit';
import type { LiveKitTokenPayload, LiveKitTokenResponse } from '../types';

/**
 * Generate a LiveKit access token for a participant.
 * MUST be called from API route only (server-side).
 */
export async function generateToken(payload: LiveKitTokenPayload): Promise<LiveKitTokenResponse> {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
    throw new Error('LiveKit not configured (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, NEXT_PUBLIC_LIVEKIT_WS_URL)');
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: payload.participant_identity,
    name: payload.participant_name,
    metadata: payload.participant_metadata,
    ttl: TOKEN_TTL_SECONDS,
  });

  token.addGrant({
    room: payload.room_name,
    roomJoin: true,
    canPublish: payload.can_publish,
    canSubscribe: payload.can_subscribe,
    canPublishData: payload.can_publish_data,
    // Sala v2 (5 sep 2026): QUE puede publicar cada quien lo decide el modo de la
    // sala en el servidor. Sin turno no hay microfono, aunque el cliente insista.
    ...(payload.can_publish_sources ? { canPublishSources: payload.can_publish_sources } : {}),
  });

  const jwt = await token.toJwt();

  return {
    token: jwt,
    ws_url: LIVEKIT_WS_URL,
    room_name: payload.room_name,
  };
}
