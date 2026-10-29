'use client';

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { mediaDelta, type MediaCounter } from './mediaStats';

/** Public track stats distinguish packet loss/decoding from a generic quality flag. */
export function useMediaReceptionTelemetry(registrar: (event: string, detail?: Record<string, unknown>) => void) {
  const room = useRoomContext();
  useEffect(() => {
    const previous = new Map<string, MediaCounter>();
    let running = false, stopped = false;
    const read = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const pubs = [...room.remoteParticipants.values()].flatMap(p => [...p.trackPublications.values()]);
        const active = pubs.filter(p=>p.track && p.isSubscribed && !p.isMuted && p.isEnabled).slice(0,40);
        const readings = await Promise.allSettled(active.map(async pub => {
          const report = await pub.track!.getRTCStatsReport();
          let result: Record<string, unknown> | null = null;
          report?.forEach(raw => {
            if (raw.type !== 'inbound-rtp') return;
            const s = raw as RTCInboundRtpStreamStats;
            const counter = {stream:s.id,timestamp:s.timestamp,bytes:s.bytesReceived??0,received:s.packetsReceived??0,lost:s.packetsLost??0,frames:s.framesDecoded??0};
            const delta = mediaDelta(counter,previous.get(pub.trackSid));previous.set(pub.trackSid,counter);
            result = {sid:pub.trackSid,kind:pub.kind,source:pub.source,delta,jitter_ms:typeof s.jitter==='number'?Math.round(s.jitter*1000):null,width:s.frameWidth,height:s.frameHeight,adaptive:pub.videoTrack && 'isAdaptiveStream' in pub.videoTrack ? pub.videoTrack.isAdaptiveStream : null,attached:pub.track?.attachedElements.length};
          });
          return result;
        }));
        const ids = new Set(pubs.map(p=>p.trackSid));for(const id of previous.keys())if(!ids.has(id))previous.delete(id);
        if (!stopped) registrar('medios_recepcion',{video_enabled:pubs.filter(p=>p.kind==='video'&&p.isSubscribed&&p.isEnabled&&!p.isMuted).length,video_paused:pubs.filter(p=>p.kind==='video'&&(!p.isDesired||!p.isEnabled)).length,measured:readings.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.status==='fulfilled'?r.value:null)});
      } finally { running=false; }
    };
    const first=setTimeout(()=>void read(),8000), timer=setInterval(()=>void read(),30000);
    return () => { stopped=true;clearTimeout(first);clearInterval(timer); };
  },[room,registrar]);
}
