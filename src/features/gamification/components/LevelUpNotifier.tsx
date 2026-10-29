// ============================================
// Level Up Notifier
// ============================================
// Client component that monitors level-up and fires the Ignition

'use client';

import { useUserPoints } from '../hooks';
import { Ignition } from './Ignition';

export function LevelUpNotifier() {
  const { levelUpData, dismissLevelUp } = useUserPoints();

  if (!levelUpData) return null;

  return (
    <Ignition
      previousLevel={levelUpData.previousLevel}
      newLevel={levelUpData.newLevel}
      onDismiss={dismissLevelUp}
    />
  );
}
