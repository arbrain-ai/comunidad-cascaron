'use client';

import { useState } from 'react';
import { sbAvatar } from '@/shared/lib/sbImage';

interface Props {
  src?: string | null;
  name?: string | null;
  /** Tailwind size classes (defaults to a compact 28px circle). */
  className?: string;
}

/**
 * Compact, non-interactive avatar for search results (popup + full results).
 * Renders the author's photo, falling back to an initial when missing or broken.
 * Intentionally has no click handler so it never intercepts the parent
 * button/link navigation.
 */
export function SearchResultAvatar({ src, name, className = 'w-7 h-7' }: Props) {
  const [errored, setErrored] = useState(false);
  const initial = name?.trim().charAt(0).toUpperCase() || '?';
  const showImage = !!src && !errored;

  return showImage ? (
    <img
      src={sbAvatar(src, 56)}
      alt={name || 'Autor'}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`${className} rounded-full object-cover aspect-square flex-shrink-0 border border-glass`}
    />
  ) : (
    <div
      className={`${className} rounded-full bg-primary/20 flex items-center justify-center aspect-square flex-shrink-0`}
      aria-hidden="true"
    >
      <span className="text-xs font-bold text-primary">{initial}</span>
    </div>
  );
}
