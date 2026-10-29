'use client';

import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type Participant } from 'livekit-client';
import { compareIdentity } from '../sala/sharedComposition';

/** Sustained focus; audioLevel is sampled at selection, not a live volume meter. */
export interface ActiveSpeaker { identity: string; name: string; audioLevel: number; }

/** SFU speaker reports include the local participant. Never rank by a local analyser.
 * Wait for sustained speech; retain the last focus through natural pauses.
 */
export function useActiveSpeaker(): ActiveSpeaker | null {
  const room = useRoomContext();
  const [active, setActive] = useState<ActiveSpeaker | null>(null);
  useEffect(() => {
    let candidate: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let selected: string | null = null;
    const update = (speakers: Participant[]) => {
      const next = [...speakers].filter(p => Number(p.kind) === 0 && p.isSpeaking && p.audioLevel >= 0.08)
        .sort((a, b) => b.audioLevel - a.audioLevel || compareIdentity(a.identity, b.identity))[0];
      if ((next?.identity ?? null) === candidate) return;
      candidate = next?.identity ?? null;
      clearTimeout(timer);
      if (!next || next.identity === selected) return;
      timer = setTimeout(() => {
        selected = next.identity;
        setActive({ identity: next.identity, name: next.name || next.identity, audioLevel: next.audioLevel });
      }, 1200);
    };
    const departed = (participant: Participant) => {
      if (participant.identity === candidate) { clearTimeout(timer); candidate = null; }
      if (participant.identity === selected) { selected = null; setActive(null); }
      update(room.activeSpeakers);
    };
    update(room.activeSpeakers);
    room.on(RoomEvent.ActiveSpeakersChanged, update);
    room.on(RoomEvent.ParticipantDisconnected, departed);
    return () => {
      clearTimeout(timer);
      room.off(RoomEvent.ActiveSpeakersChanged, update);
      room.off(RoomEvent.ParticipantDisconnected, departed);
    };
  }, [room]);
  return active;
}
