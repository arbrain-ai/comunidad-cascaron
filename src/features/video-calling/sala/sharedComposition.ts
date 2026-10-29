export function readRoomFocus(metadata: Record<string, unknown> | null | undefined): string | null {
  const focus = metadata?.room_focus;
  return typeof focus === 'string' && focus.length <= 128 && focus.length > 0 ? focus : null;
}

export function readRoomSpeaker(metadata: Record<string, unknown> | null | undefined): string | null {
  return readRoomFocus({ room_focus: metadata?.room_speaker });
}

export function speakerController(identities: string[], host: string | null): string | null {
  return host && identities.includes(host) ? host : [...identities].sort(compareIdentity)[0] ?? null;
}

/**
 * Same order on every client; no role or "me" bias. IDs break ties without locale variance.
 * The speaker does NOT move (23 sep 2026): ranking by speaker reshuffled every tile each time
 * someone talked ("las cámaras en constante movimiento"). Like Meet, the speaker is marked in
 * place (Celda ring) and only an off-page speaker is brought into view (`incluirOrador`).
 */
export function orderParticipants<T extends { identity: string; camaraAbierta: boolean }>(
  participants: T[], focus: string | null,
): T[] {
  const rank = (p: T) => p.identity === focus ? 0 : p.camaraAbierta ? 1 : 2;
  return [...participants].sort((a, b) => rank(a) - rank(b) || compareIdentity(a.identity, b.identity));
}

export function compareIdentity(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

/** Independent of local track enumeration; muted presentations never win. */
export function choosePresentation<T extends { identity: string; muted: boolean; sid: string }>(tracks: T[], focus: string | null): T | null {
  return tracks.filter(t => !t.muted).sort((a, b) =>
    Number(b.identity === focus) - Number(a.identity === focus) || compareIdentity(a.identity, b.identity) || compareIdentity(a.sid, b.sid),
  )[0] ?? null;
}
