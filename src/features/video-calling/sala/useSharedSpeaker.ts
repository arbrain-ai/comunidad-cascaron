'use client';

import { useEffect, useRef } from 'react';
import type { AccionSala, ResultadoAccion } from './useSala';
import { createSpeakerSync } from './speakerSync';

/** One elected observer commits the SFU's sustained speaker; everyone renders the
 * server snapshot, including late joiners during silence. Requests are serialized.
 */
export function useSharedSpeaker(controller: boolean, speaker: string | null, shared: string | null,
  action: (a: AccionSala) => Promise<ResultadoAccion>) {
  const latest = useRef({ controller, speaker, shared });
  latest.current = { controller, speaker, shared };
  const syncRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const observer = createSpeakerSync(() => latest.current, action);
    syncRef.current = observer.sync;
    void observer.sync();
    const timer = setInterval(() => { void observer.sync(); }, 1500);
    return () => { observer.dispose(); syncRef.current = null; clearInterval(timer); };
  }, [action]);
  // Observe even brief eligibility/controller changes while a request is in
  // flight; the pending promise cannot overwrite the next candidate's policy.
  useEffect(() => { void syncRef.current?.(); }, [controller, speaker, shared]);
}
