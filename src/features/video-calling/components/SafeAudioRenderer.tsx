'use client';

import { useEffect, useState } from 'react';
import { RoomAudioRenderer, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

/**
 * Audio renderer using LiveKit's stock RoomAudioRenderer + aggressive autoplay unlock.
 *
 * HISTORY: Custom renderers with Web Audio API (AudioContext, DynamicsCompressor,
 * setWebAudioPlugins, manual srcObject) caused 6 days of audio failure (Feb 12-18).
 * RoomAudioRenderer is battle-tested in millions of LiveKit deployments.
 * Do NOT replace this with custom audio handling.
 */
export function SafeAudioRenderer() {
  const room = useRoomContext();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timer);
      if (room.canPlaybackAudio) { setBlocked(false); setFailed(false); }
      else timer = setTimeout(() => setBlocked(!room.canPlaybackAudio), 700);
    };
    check();
    room.on(RoomEvent.AudioPlaybackStatusChanged, check);
    return () => { clearTimeout(timer); room.off(RoomEvent.AudioPlaybackStatusChanged, check); };
  }, [room]);

  // Unlock audio on ANY user interaction (Chrome autoplay policy)
  useEffect(() => {
    if (!room) return;
    const unlock = () => { if (!room.canPlaybackAudio) room.startAudio().catch(() => {}); };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [room]);

  return <><RoomAudioRenderer />{blocked && <div role="status" className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100" data-testid="audio-unlock-notice"><span>{failed ? 'El navegador todavía no permite reproducir el audio.' : 'Activa el sonido para escuchar la llamada.'}</span><button disabled={busy} className="rounded-full bg-amber-300 px-4 py-2 font-semibold text-black disabled:opacity-50" onClick={async(e)=>{e.stopPropagation();setBusy(true);try{await room.startAudio();setFailed(!room.canPlaybackAudio);}catch{setFailed(true);}finally{setBusy(false);}}}>{busy?'Activando…':'Activar sonido'}</button></div>}</>;
}
