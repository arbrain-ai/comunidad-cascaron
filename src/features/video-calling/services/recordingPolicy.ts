/** Keep one video slot available for a presentation that begins after recording. */
export const MAX_RECORDED_VIDEO_TRACKS = 6;
export const MAX_RECORDED_CAMERA_TRACKS = 5;
export type RecordingTrack = { trackSid: string; source: 'screen_share' | 'camera'; isHost: boolean };
export function selectRecordingTracks<T extends RecordingTrack>(tracks: T[]): T[] {
  const sorted = [...tracks].sort((a,b) => Number(b.source === 'screen_share') - Number(a.source === 'screen_share') || Number(b.isHost) - Number(a.isHost));
  let cameras = 0;
  return sorted.filter(t => t.source !== 'camera' || ++cameras <= MAX_RECORDED_CAMERA_TRACKS).slice(0, MAX_RECORDED_VIDEO_TRACKS);
}
export function recordingAdmission(active: Array<RecordingTrack & {egressId:string}>, incoming: RecordingTrack, priorityCamera = false): { start: boolean; stop?: string } {
  if (active.some(t => t.trackSid === incoming.trackSid)) return {start:false};
  if (incoming.source === 'camera' && active.filter(t=>t.source==='camera').length >= MAX_RECORDED_CAMERA_TRACKS) {
    const camera = (priorityCamera || incoming.isHost) ? active.find(t=>t.source==='camera' && !t.isHost) : undefined;
    return camera ? {start:true,stop:camera.egressId} : {start:false};
  }
  if (active.length < MAX_RECORDED_VIDEO_TRACKS) return {start:true};
  if (incoming.source !== 'screen_share') return {start:false};
  // A legacy/full recording must surrender a camera, never its audio anchor.
  const camera = [...active].filter(t=>t.source==='camera').sort((a,b)=>Number(a.isHost)-Number(b.isHost))[0];
  return camera ? {start:true,stop:camera.egressId} : {start:false};
}

export function recordingHost(metadata: string | undefined): boolean {
  try { const m = JSON.parse(metadata || '{}') as {role?:string;rol_sala?:string};
    return m.rol_sala === 'anfitrion' || m.rol_sala === 'moderador' || ['admin','owner','moderator'].includes(m.role ?? '');
  } catch { return false; }
}
