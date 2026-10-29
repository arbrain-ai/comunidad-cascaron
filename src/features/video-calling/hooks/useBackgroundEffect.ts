'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import type { LocalVideoTrack } from 'livekit-client';
import { useLocalParticipant } from '@livekit/components-react';

export type BackgroundEffectMode = 'none' | 'blur-light' | 'blur-medium' | 'blur-strong' | string;

// Lazy-load heavy processor module (TensorFlow.js model ~2MB)
let processorModulePromise: Promise<typeof import('@livekit/track-processors')> | null = null;
function loadProcessorModule() {
  if (!processorModulePromise) {
    processorModulePromise = import('@livekit/track-processors');
  }
  return processorModulePromise;
}

export function useBackgroundEffect() {
  const { localParticipant } = useLocalParticipant();
  const [currentMode, setCurrentMode] = useState<BackgroundEffectMode>('none');
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processorRef = useRef<any>(null);
  const modeRef = useRef<BackgroundEffectMode>('none');
  modeRef.current = currentMode;

  // Check browser support on mount
  useEffect(() => {
    loadProcessorModule()
      .then((mod) => {
        setIsSupported(mod.supportsBackgroundProcessors());
      })
      .catch(() => {
        setIsSupported(false);
      });
  }, []);

  // Core: apply effect to current camera track
  const applyEffect = useCallback(async (mode: BackgroundEffectMode) => {
    try {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track as LocalVideoTrack | undefined;
      if (!track || typeof track.setProcessor !== 'function') return;

      if (mode === 'none') {
        if (typeof track.stopProcessor === 'function') {
          await track.stopProcessor();
        }
        processorRef.current = null;
        return;
      }

      const { BackgroundProcessor } = await loadProcessorModule();

      // Create processor if needed (one per track lifecycle)
      if (!processorRef.current) {
        processorRef.current = BackgroundProcessor({ mode: 'disabled' });
        await track.setProcessor(processorRef.current);
      }

      // Switch to desired mode. blurRadius 6 / 12 / 22 gives a clear gradient
      // (similar to Meet's "ligero/medio/fuerte" steps).
      if (mode === 'blur-light') {
        await processorRef.current.switchTo({ mode: 'background-blur', blurRadius: 6 });
      } else if (mode === 'blur-medium') {
        await processorRef.current.switchTo({ mode: 'background-blur', blurRadius: 12 });
      } else if (mode === 'blur-strong') {
        await processorRef.current.switchTo({ mode: 'background-blur', blurRadius: 22 });
      } else {
        // mode is an image data URL or path
        await processorRef.current.switchTo({ mode: 'virtual-background', imagePath: mode });
      }
    } catch (err) {
      console.error('[useBackgroundEffect] Failed to apply effect:', err);
    }
  }, [localParticipant]);

  // Re-apply when mode changes
  useEffect(() => {
    if (isSupported === false || isSupported === null) return;
    applyEffect(currentMode);
  }, [currentMode, isSupported, applyEffect]);

  // Re-apply when camera track is re-published (after toggle off → on)
  useEffect(() => {
    if (isSupported === false || isSupported === null) return;

    const handleTrackPublished = (pub: { source?: string }) => {
      if (pub.source === Track.Source.Camera && modeRef.current !== 'none') {
        // New track = old processor is invalid
        processorRef.current = null;
        // Small delay for track to initialize fully
        setTimeout(() => applyEffect(modeRef.current), 300);
      }
    };

    // CRITICAL FIX (Joel bug 2026-04-25): when the camera track is
    // unpublished (user toggles cam off), the BackgroundProcessor keeps
    // an internal reference to the underlying MediaStreamTrack via the
    // processor pipeline. Without explicitly tearing it down, the camera
    // device stays "warm" — on macOS the green LED stays on even though
    // LiveKit reports the publication as muted. Releasing the processor
    // ref here ensures the next applyEffect creates a fresh processor.
    const handleTrackUnpublished = (pub: { source?: string }) => {
      if (pub.source === Track.Source.Camera) {
        processorRef.current = null;
      }
    };

    localParticipant.on('localTrackPublished', handleTrackPublished);
    localParticipant.on('localTrackUnpublished', handleTrackUnpublished);
    return () => {
      localParticipant.off('localTrackPublished', handleTrackPublished);
      localParticipant.off('localTrackUnpublished', handleTrackUnpublished);
    };
  }, [localParticipant, isSupported, applyEffect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      processorRef.current = null;
    };
  }, []);

  const setMode = useCallback((mode: BackgroundEffectMode) => {
    setCurrentMode(mode);
  }, []);

  /**
   * Tear down the processor while the camera track is still alive.
   * Call this BEFORE toggling the camera off — otherwise the processor
   * keeps a reference to the underlying MediaStreamTrack and the camera
   * device stays warm (LED on in macOS).
   */
  const cleanup = useCallback(async () => {
    try {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track as LocalVideoTrack | undefined;
      if (track && typeof track.stopProcessor === 'function') {
        await track.stopProcessor();
      }
    } catch (err) {
      console.error('[useBackgroundEffect] cleanup failed:', err);
    } finally {
      processorRef.current = null;
    }
  }, [localParticipant]);

  return {
    currentMode,
    setMode,
    cleanup,
    isSupported: isSupported ?? false,
  };
}
