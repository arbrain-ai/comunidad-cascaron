'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { dispositivoLocal } from '@/features/video-calling/lib/identidad';
import { entryRequest } from '../services/entryRequest';
import { reportEntryFailure } from '../services/entryTelemetry';
import { supabase } from '@/shared/lib/supabase';
import type {
  VideoRoomWithDetails,
  VideoPermissions,
  LiveKitTokenResponse,
} from '../types';
import type { EstadoSala } from '../services/salaService';
import type { FormatoCamara } from '../sala/useFormatoCamara';
import { calculatePermissions } from '../config/features';

/** Polling interval for lobby session check (ms) */
const LOBBY_POLL_INTERVAL = 3000;

interface UseVideoRoomOptions {
  roomId: string;
  userId: string;
}

/** Lo que el lobby entrega al entrar: los MISMOS tracks que valido (sala v2). */
export interface PreferenciasEntrada {
  audio: boolean;
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
  audioTrack?: MediaStreamTrack | null;
  videoTrack?: MediaStreamTrack | null;
  formato?: FormatoCamara | null;
}

interface UseVideoRoomReturn {
  room: VideoRoomWithDetails | null;
  permissions: VideoPermissions | null;
  token: LiveKitTokenResponse | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  salaInicial: EstadoSala | null;
  isLoading: boolean;
  error: string | null;
  joinError: string | null;
  isInLobby: boolean;
  isConnected: boolean;
  entrada: PreferenciasEntrada | null;
  joinRoom: (preferences?: PreferenciasEntrada) => Promise<boolean>;
  leaveRoom: () => void;
}

export function useVideoRoom({ roomId, userId }: UseVideoRoomOptions): UseVideoRoomReturn {
  const [room, setRoom] = useState<VideoRoomWithDetails | null>(null);
  const [permissions, setPermissions] = useState<VideoPermissions | null>(null);
  const [token, setToken] = useState<LiveKitTokenResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [salaInicial, setSalaInicial] = useState<EstadoSala | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isInLobby, setIsInLobby] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [entrada, setEntrada] = useState<PreferenciasEntrada | null>(null);
  const joining = useRef(false);
  const entryGeneration = useRef(0);
  const mounted = useRef(true);
  const ownedCapture = useRef<PreferenciasEntrada | null>(null);
  const releaseCapture = useCallback(() => {
    const capture = ownedCapture.current;
    ownedCapture.current = null;
    capture?.audioTrack?.stop();
    capture?.videoTrack?.stop();
  }, []);
  const cancelEntry = useCallback(() => {
    entryGeneration.current++;
    joining.current = false;
    releaseCapture();
  }, [releaseCapture]);
  useEffect(() => {
    mounted.current = true;
    setRoom(null); setPermissions(null); setToken(null); setSessionId(null);
    setSessionStartedAt(null); setSalaInicial(null); setEntrada(null);
    setIsConnected(false); setIsInLobby(true); setIsLoading(true);
    setError(null); setJoinError(null);
    return () => { mounted.current = false; cancelEntry(); };
  }, [roomId, userId, cancelEntry]);

  // Fetch room details, active session, and calculate permissions
  useEffect(() => {
    let cancelled = false;
    async function loadRoom() {
      try {
        setIsLoading(true);
        const { data, error: fetchError } = await supabase
          .from('video_rooms')
          .select(`
            *,
            creator:created_by(id, full_name, avatar_url),
            room_settings:video_room_settings(*),
            events:event_id(host_id)
          `)
          .eq('id', roomId)
          .single();

        if (cancelled) return;
        if (fetchError) throw fetchError;

        const { data: activeSession } = await supabase
          .from('video_sessions')
          .select('*')
          .eq('room_id', roomId)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, tier, current_level')
          .eq('id', userId)
          .single();

        if (cancelled) return;
        if (profile) {
          const roomSettings = Array.isArray(data.room_settings)
            ? data.room_settings[0] || null
            : data.room_settings;
          const ev = (data as { events?: { host_id?: string | null } | { host_id?: string | null }[] | null }).events;
          const hostId = ev ? (Array.isArray(ev) ? ev[0]?.host_id ?? null : ev.host_id ?? null) : null;
          const perms = calculatePermissions(
            { user_id: profile.id, role: profile.role, tier: profile.tier, current_level: profile.current_level || 1 },
            roomSettings,
            hostId,
            (data as { created_by?: string | null }).created_by ?? null,
          );
          setPermissions(perms);
        }

        let participantCount = 0;
        if (activeSession) {
          setSessionId(activeSession.id);
          setSessionStartedAt(activeSession.started_at);
          const { count } = await supabase
            .from('video_participants')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', activeSession.id)
            .is('left_at', null);
          if (cancelled) return;
          participantCount = count || 0;
        }

        setRoom({
          ...data,
          creator: data.creator,
          room_settings: Array.isArray(data.room_settings) ? data.room_settings[0] || null : data.room_settings,
          active_session: activeSession || null,
          participant_count: participantCount,
        } as VideoRoomWithDetails);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load room');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (roomId && userId) loadRoom();
    return () => { cancelled = true; };
  }, [roomId, userId]);

  // Poll for active session + participant count while in lobby.
  const hasRoom = room !== null;
  useEffect(() => {
    if (!isInLobby || !hasRoom) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function checkSession() {
      try {
        const { data: activeSession, error: sessionError } = await supabase
          .from('video_sessions')
          .select('*')
          .eq('room_id', roomId)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || sessionError) return;
        let count = 0;
        if (activeSession) {
          const r = await supabase
            .from('video_participants')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', activeSession.id)
            .is('left_at', null);
          if (cancelled || r.error) return;
          setSessionId(activeSession.id);
          setSessionStartedAt(activeSession.started_at);
          count = r.count || 0;
        }
        setRoom((prev) => (prev ? { ...prev, active_session: activeSession || null, participant_count: count } as VideoRoomWithDetails : prev));
      } catch (error) {
        console.warn('[VideoRoom] No se pudo actualizar el lobby:', error);
      } finally {
        if (!cancelled) timer = setTimeout(() => void checkSession(), LOBBY_POLL_INTERVAL);
      }
    }
    void checkSession();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isInLobby, hasRoom, roomId]);

  // Join the room (get token from API)
  const joinRoom = useCallback(async (preferences?: PreferenciasEntrada) => {
    if (joining.current || !mounted.current) return false;
    joining.current = true;
    const generation = ++entryGeneration.current;
    const current = () => mounted.current && generation === entryGeneration.current;
    ownedCapture.current = preferences ?? null;
    try {
      setJoinError(null);
      if (preferences) setEntrada(preferences);
      const { data: { session } } = await supabase.auth.getSession();
      if (!current()) return false;
      if (!session) throw new Error('Not authenticated');

      const response = await entryRequest('/api/video-calling/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ room_id: roomId, dispositivo: dispositivoLocal() }),
      }, 20000);

      if (!current()) return false;
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get token');
      }

      const result = await response.json();
      if (!current()) return false;
      setToken(result.data);
      if (result.data.session_id) setSessionId(result.data.session_id);
      if (result.data.session_started_at) setSessionStartedAt(result.data.session_started_at);
      if (result.data.sala) setSalaInicial(result.data.sala as EstadoSala);
      setIsInLobby(false);
      setIsConnected(true);
      return true;
    } catch (err) {
      if (!current()) return false;
      void reportEntryFailure(sessionId, 'token', err instanceof Error ? err.name : 'EntryFailed');
      // El lobby entrego tracks vivos; si no entramos, se sueltan
      releaseCapture();
      setEntrada(null);
      setJoinError(err instanceof Error && err.name === 'TimeoutError' ? 'La sala tardó demasiado en responder. Vuelve a intentarlo.' : err instanceof Error ? err.message : 'No se pudo entrar a la sala.');
      return false;
    } finally { if (current()) joining.current = false; }
  }, [roomId, sessionId, releaseCapture]);

  const leaveRoom = useCallback(() => {
    cancelEntry();
    setToken(null);
    setIsConnected(false);
    setIsInLobby(true);
    setEntrada(null);
  }, [cancelEntry]);

  return {
    room,
    permissions,
    token,
    sessionId,
    sessionStartedAt,
    salaInicial,
    isLoading,
    error,
    joinError,
    isInLobby,
    isConnected,
    entrada,
    joinRoom,
    leaveRoom,
  };
}
