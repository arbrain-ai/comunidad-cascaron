'use client';

import { useEffect } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

/** Explicit page membership also covers cameras that have never been attached.
 * Adaptive stream then chooses the resolution for the subscribed visible tiles.
 * Audio and presentations keep their independent subscriptions.
 */
export function useVisibleCameras(identities: string[]) {
  const room = useRoomContext();
  const key = [...identities].sort().join(',');
  useEffect(() => {
    const visible = new Set(key ? key.split(',') : []);
    const apply = () => {
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.videoTrackPublications.values()) {
          if (pub.source !== Track.Source.Camera) continue;
          const desired = visible.has(participant.identity);
          if (pub.isDesired !== desired) pub.setSubscribed(desired);
        }
      }
    };
    apply();
    room.on(RoomEvent.TrackPublished, apply);
    room.on(RoomEvent.Connected, apply);
    room.on(RoomEvent.Reconnected, apply);
    return () => {
      room.off(RoomEvent.TrackPublished, apply);
      room.off(RoomEvent.Connected, apply);
      room.off(RoomEvent.Reconnected, apply);
    };
  },[room,key]);
}
