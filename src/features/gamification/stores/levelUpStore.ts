// ============================================
// Level Up Store
// ============================================
// Simple store for level-up celebration state using localStorage

const LEVEL_KEY = 'user_last_known_level';
const PENDING_CELEBRATION_KEY = 'pending_level_up_celebration';

export interface LevelUpData {
  previousLevel: number;
  newLevel: number;
}

/**
 * Get the last known level from localStorage
 */
export function getLastKnownLevel(): number | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LEVEL_KEY);
  return stored ? parseInt(stored, 10) : null;
}

/**
 * Save the current level to localStorage
 */
export function saveCurrentLevel(level: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LEVEL_KEY, level.toString());
}

/**
 * Check if there's a pending level-up celebration
 */
export function getPendingCelebration(): LevelUpData | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(PENDING_CELEBRATION_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as LevelUpData;
  } catch {
    return null;
  }
}

/**
 * Save pending level-up celebration
 */
export function savePendingCelebration(data: LevelUpData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_CELEBRATION_KEY, JSON.stringify(data));
}

/**
 * Clear pending celebration after it's shown
 */
export function clearPendingCelebration(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PENDING_CELEBRATION_KEY);
}

/**
 * Validate if a pending celebration is still relevant
 * A celebration is valid only if newLevel matches the user's current level
 * AND the celebration hasn't been "consumed" yet
 */
export function validateAndGetPendingCelebration(currentLevel: number): LevelUpData | null {
  const pending = getPendingCelebration();
  if (!pending) return null;

  const lastKnownLevel = getLastKnownLevel();

  // If the pending celebration's newLevel matches current level
  // AND lastKnownLevel is LESS than newLevel, it's a valid pending celebration
  // This means: user leveled up, but hasn't dismissed the modal yet
  if (pending.newLevel === currentLevel && lastKnownLevel !== null && lastKnownLevel < pending.newLevel) {
    return pending;
  }

  // Otherwise, this is a stale/obsolete celebration - clean it up
  // This happens when:
  // 1. User dismissed but localStorage wasn't cleaned (the bug we're fixing)
  // 2. User's level changed unexpectedly
  // 3. Data corruption
  clearPendingCelebration();
  return null;
}

/**
 * Check if user leveled up and trigger celebration
 * Returns the level-up data if there was a level up, null otherwise
 */
export function checkLevelUp(currentLevel: number): LevelUpData | null {
  const lastKnownLevel = getLastKnownLevel();

  // First time user - just save the level
  if (lastKnownLevel === null) {
    saveCurrentLevel(currentLevel);
    return null;
  }

  // Check if leveled up
  if (currentLevel > lastKnownLevel) {
    const levelUpData: LevelUpData = {
      previousLevel: lastKnownLevel,
      newLevel: currentLevel,
    };

    // Save pending celebration and update stored level
    savePendingCelebration(levelUpData);
    saveCurrentLevel(currentLevel);

    return levelUpData;
  }

  // Level stayed same or went down (edge case)
  saveCurrentLevel(currentLevel);
  return null;
}
