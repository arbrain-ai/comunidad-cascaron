'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface FocusModeContextType {
  isFocusMode: boolean;
  isFullscreen: boolean;
  toggleFocusMode: () => void;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync state with browser fullscreen changes (user might press Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      // If user exits fullscreen via Escape, also exit focus mode
      if (!isCurrentlyFullscreen && isFocusMode) {
        setIsFocusMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFocusMode]);

  const enterFocusMode = useCallback(async () => {
    try {
      // Request browser fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }

      setIsFocusMode(true);
      setIsFullscreen(true);
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      // Still enable focus mode even if fullscreen fails (some browsers block it)
      setIsFocusMode(true);
    }
  }, []);

  const exitFocusMode = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }

    setIsFocusMode(false);
    setIsFullscreen(false);
  }, []);

  const toggleFocusMode = useCallback(() => {
    if (isFocusMode) {
      exitFocusMode();
    } else {
      enterFocusMode();
    }
  }, [isFocusMode, enterFocusMode, exitFocusMode]);

  // Global keyboard shortcut: Ctrl+Shift+F or Cmd+Shift+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + F to toggle focus mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFocusMode();
      }

      // Escape to exit focus mode (browser handles fullscreen exit, we handle state)
      if (e.key === 'Escape' && isFocusMode) {
        // Browser already handles fullscreen exit, just update our state
        // The fullscreenchange event listener will handle this
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode, isFocusMode]);

  return (
    <FocusModeContext.Provider
      value={{
        isFocusMode,
        isFullscreen,
        toggleFocusMode,
        enterFocusMode,
        exitFocusMode,
      }}
    >
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  const context = useContext(FocusModeContext);
  if (context === undefined) {
    throw new Error('useFocusMode must be used within a FocusModeProvider');
  }
  return context;
}

// Safe hook that returns defaults when outside provider (for components that may render without it)
export function useFocusModeSafe() {
  const context = useContext(FocusModeContext);
  return context ?? {
    isFocusMode: false,
    isFullscreen: false,
    toggleFocusMode: () => {},
    enterFocusMode: () => {},
    exitFocusMode: () => {},
  };
}
