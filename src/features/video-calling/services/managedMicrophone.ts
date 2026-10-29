import { LocalAudioTrack } from 'livekit-client';
import { voiceCaptureConstraints } from './voiceCapturePolicy';

/** Transfer preview ownership to LiveKit, without reopening a capture device. */
export function adoptLobbyMicrophone(track: MediaStreamTrack): LocalAudioTrack {
  return new LocalAudioTrack(track, voiceCaptureConstraints(track.getSettings().deviceId), false);
}

export const VOICE_PUBLISH = {
  audioPreset: { maxBitrate: 40_000, priority: 'high' as const },
  dtx: true, red: true, forceStereo: false, stopMicTrackOnMute: true,
};
