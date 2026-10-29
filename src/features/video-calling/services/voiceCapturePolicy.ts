/** One voice policy for preview, publication and SDK reacquisition. No user DSP preference. */
export const VOICE_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48000,
} as const;

export const LEGACY_NOISE_KEY = 'app.video.supresion-ruido';

export function retireNoisePreference(storage?: Pick<Storage, 'removeItem'>): void {
  try { storage?.removeItem(LEGACY_NOISE_KEY); } catch { /* Private storage cannot change voice policy. */ }
}

export function voiceCaptureConstraints(deviceId?: string): MediaTrackConstraints {
  return { ...VOICE_CAPTURE, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) };
}

/** Explicit allowlist: never serialize deviceId, groupId, label or raw constraints. */
export function voiceCaptureEvidence(settings: MediaTrackSettings, supported: MediaTrackSupportedConstraints) {
  const booleanSetting = (key: 'echoCancellation' | 'noiseSuppression' | 'autoGainControl') => ({
    requested: true,
    supported: supported[key] === true,
    applied: typeof settings[key] === 'boolean' ? settings[key] : null,
  });
  return {
    policy: 'voice-v1',
    echoCancellation: booleanSetting('echoCancellation'),
    noiseSuppression: booleanSetting('noiseSuppression'),
    autoGainControl: booleanSetting('autoGainControl'),
    channelCount: settings.channelCount ?? null,
    sampleRate: settings.sampleRate ?? null,
    sampleSize: settings.sampleSize ?? null,
  };
}
