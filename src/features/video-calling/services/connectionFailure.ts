/** Keep SDK diagnostics, never raw messages (which can contain URLs, SDP or credentials). */
export function connectionFailure(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const names = new Set(['ConnectionError', 'ConnectionTimeout', 'NotAllowedError', 'NotFoundError',
    'NotReadableError', 'OverconstrainedError', 'TrackInvalidError', 'PublishTrackError',
    'UnexpectedConnectionState', 'Error', 'AbortError']);
  const name = typeof value.name === 'string' && names.has(value.name) ? value.name : 'UnknownError';
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  const category = name === 'NotAllowedError' ? 'permission'
    : name === 'NotFoundError' ? 'device_missing'
    : name === 'NotReadableError' ? 'device_busy'
    : name === 'ConnectionTimeout' || /timed? ?out|timeout/.test(message) ? 'timeout'
    : /\bice\b|peerconnection/.test(message) ? 'media_transport'
    : /websocket|signal/.test(message) ? 'signaling'
    : /token|unauthor|forbidden/.test(message) ? 'authorization'
    : 'unknown';
  return { name, category,
    code: typeof value.code === 'number' && Number.isFinite(value.code) ? value.code : null,
    reason: typeof value.reason === 'number' && Number.isFinite(value.reason) ? value.reason : null };
}
