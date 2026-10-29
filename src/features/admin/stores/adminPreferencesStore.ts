// ============================================
// Admin Preferences Store
// ============================================
// LocalStorage-based store for admin panel preferences
// Pattern: follows levelUpStore.ts

// Tab type definition (must match admin page)
export type TabType = 'analytics' | 'users' | 'categories' | 'leaderboard' | 'video';

const ACTIVE_TAB_KEY = 'admin_active_tab';
const SIDEBAR_COLLAPSED_KEY = 'admin_sidebar_collapsed';

// Default order for validation
export const DEFAULT_TAB_ORDER: TabType[] = [
  'analytics',
  'users',
  'categories',
  'leaderboard',
  'video',
];

// Tab labels mapping
export const TAB_LABELS: Record<TabType, string> = {
  analytics: 'Analytics',
  users: 'Miembros',
  categories: 'Categorias',
  leaderboard: 'Leaderboard',
  video: 'Video',
};

/**
 * Get the last active tab from localStorage
 * SSR-safe: returns 'analytics' on server
 */
export function getActiveTab(): TabType {
  if (typeof window === 'undefined') return 'analytics';

  const stored = localStorage.getItem(ACTIVE_TAB_KEY);
  if (!stored) return 'analytics';

  // Validate: must be a valid TabType
  const validTabs = new Set(DEFAULT_TAB_ORDER);
  if (validTabs.has(stored as TabType)) {
    return stored as TabType;
  }

  return 'analytics';
}

/**
 * Save active tab to localStorage
 * SSR-safe: no-op on server
 */
export function saveActiveTab(tab: TabType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_TAB_KEY, tab);
}

/**
 * Get sidebar collapsed state from localStorage
 * SSR-safe: returns false on server
 */
export function getSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

/**
 * Save sidebar collapsed state to localStorage
 * SSR-safe: no-op on server
 */
export function saveSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false');
}
