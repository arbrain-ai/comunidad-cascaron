'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getMembers } from '../services/membersService';
import { createMemberDirectoryStore } from '../services/memberDirectoryStore';

const directory = createMemberDirectoryStore(() => getMembers());
let consumers = 0;
let stopRefresh: (() => void) | null = null;

function startRefresh(): () => void {
  consumers += 1;
  if (consumers === 1) {
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void directory.refresh();
    };
    refreshVisible();
    const timer = window.setInterval(refreshVisible, 60_000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    stopRefresh = () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }
  return () => {
    consumers -= 1;
    if (consumers === 0) {
      stopRefresh?.();
      stopRefresh = null;
    }
  };
}

/** One snapshot for the directory, sidebar, online list and every counter. */
export function useMemberDirectory() {
  const snapshot = useSyncExternalStore(directory.subscribe, directory.getSnapshot, directory.getServerSnapshot);
  useEffect(startRefresh, []);
  return { ...snapshot, refresh: directory.refresh };
}
