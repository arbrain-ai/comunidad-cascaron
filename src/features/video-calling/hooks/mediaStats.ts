export type MediaCounter = { stream: string; timestamp: number; bytes: number; received: number; lost: number; frames: number };

/** Counter resets and a first reading are unknown, never a fabricated zero. */
export function mediaDelta(now: MediaCounter, previous?: MediaCounter) {
  if (!previous || previous.stream !== now.stream || now.timestamp <= previous.timestamp ||
      now.bytes < previous.bytes || now.received < previous.received || now.lost < previous.lost || now.frames < previous.frames) return null;
  const seconds = (now.timestamp - previous.timestamp) / 1000;
  const received = now.received - previous.received, lost = now.lost - previous.lost;
  return { kbps: Math.round((now.bytes-previous.bytes)*8/seconds/1000),
    lost_pct: received+lost>0 ? Math.round(lost/(received+lost)*10000)/100 : null,
    fps: Math.round((now.frames-previous.frames)/seconds*10)/10 };
}
