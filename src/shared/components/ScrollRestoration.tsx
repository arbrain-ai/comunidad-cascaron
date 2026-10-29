// ============================================
// ScrollRestoration Component
// ============================================
// Client component that mounts the scroll restoration hook.
// Add to (main)/layout.tsx alongside other client components.

'use client';

import { useScrollRestoration } from '@/shared/hooks/useScrollRestoration';

export function ScrollRestoration() {
  useScrollRestoration();
  return null;
}
