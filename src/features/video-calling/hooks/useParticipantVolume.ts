'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParticipants } from '@livekit/components-react';
import { RemoteParticipant } from 'livekit-client';

const STORAGE_KEY = 'app-participant-volumes-v1';

type VolumeMap = Record<string, number>;

function readStoredVolumes(): VolumeMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: VolumeMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && v >= 0 && v <= 2) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function persistVolumes(map: VolumeMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota / private-mode: silently drop the persist, state still in memory
  }
}

/**
 * Local listener-side per-participant volume (0..2, default 1).
 * Mirrors the map into LiveKit's `remoteParticipant.setVolume()` so when
 * alguien habla bajito puedes subirle a 1.5x solo para ti sin afectar a
 * los demas. State persists in localStorage so la preferencia sobrevive
 * refresh y re-entrada a la sala.
 */
export function useParticipantVolume() {
  const participants = useParticipants();
  const [volumes, setVolumes] = useState<VolumeMap>(() => readStoredVolumes());
  const volumesRef = useRef(volumes);
  volumesRef.current = volumes;

  // Apply the stored volume whenever the participant set changes so we pick
  // up late-joiners and re-attach after reconnects.
  useEffect(() => {
    for (const p of participants) {
      if (!(p instanceof RemoteParticipant)) continue;
      const v = volumesRef.current[p.identity];
      if (typeof v !== 'number') continue;
      try {
        p.setVolume(v);
      } catch {
        // track might not be subscribed yet; the next participant update
        // will try again.
      }
    }
  }, [participants]);

  const setVolumeFor = useCallback((identity: string, value: number) => {
    const clamped = Math.max(0, Math.min(2, value));
    setVolumes((prev) => {
      const next = { ...prev, [identity]: clamped };
      persistVolumes(next);
      return next;
    });

    // Apply immediately to the live track if we have it
    const remote = participants.find(
      (p): p is RemoteParticipant => p instanceof RemoteParticipant && p.identity === identity,
    );
    if (remote) {
      try {
        remote.setVolume(clamped);
      } catch {
        // ignore — next effect pass will re-apply
      }
    }
  }, [participants]);

  const resetVolumeFor = useCallback((identity: string) => {
    setVolumes((prev) => {
      if (!(identity in prev)) return prev;
      const next = { ...prev };
      delete next[identity];
      persistVolumes(next);
      return next;
    });
    const remote = participants.find(
      (p): p is RemoteParticipant => p instanceof RemoteParticipant && p.identity === identity,
    );
    if (remote) {
      try {
        remote.setVolume(1);
      } catch {
        // no-op
      }
    }
  }, [participants]);

  const api = useMemo(
    () => ({
      getVolumeFor: (identity: string) => volumes[identity] ?? 1,
      setVolumeFor,
      resetVolumeFor,
    }),
    [volumes, setVolumeFor, resetVolumeFor],
  );

  return api;
}
