'use client';

import Link from 'next/link';
import { useUpcomingEvent } from '../hooks/useUpcomingEvent';

interface UpcomingEventBannerProps {
  userTier: 'standard' | 'vip' | null;
}

/**
 * One-line banner for the next/ongoing class. Adapts copy + color based on
 * timing so the impatient user sees a live countdown and the "Entra ahora"
 * affordance appears automatically 10 min before start. After the event ends
 * it briefly surfaces the recording link.
 *
 * Fallback wiring: if the event has a `google_meet_link`, the banner links
 * directly to that URL (new tab) instead of opening the native call.
 * Used when the native room is unavailable and we need to redirect live
 * traffic to Meet without a deploy bouncing users through the modal.
 */
export function UpcomingEventBanner({ userTier }: UpcomingEventBannerProps) {
  const { upcomingEvent, timeUntil, status, isLoading } = useUpcomingEvent({
    userTier,
    hoursAhead: 72,
  });

  if (isLoading || !upcomingEvent) {
    return null;
  }

  const isVipEvent = upcomingEvent.visible_to_tier === 'vip';
  const meetLink = upcomingEvent.google_meet_link;

  // Con meet link → sale por Google Meet. Sin link → evento NATIVO: el detalle
  // del evento en /calendar trae el CTA de entrar a la sala propia.
  const href = meetLink || `/calendar?event=${upcomingEvent.id}`;
  const linkProps = meetLink
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  const label = upcomingEvent.title;

  // State-specific rendering
  if (status === 'live') {
    return (
      <Link
        href={href}
        {...linkProps}
        className="block px-4 py-2 text-center text-sm transition-colors hover:opacity-90"
      >
        <span className="text-foreground">
          {/* Un evento en vivo ahora SÍ es ámbar (LEY.md §1.1): está pasando. */}
          <span className="relative mr-1.5 inline-flex h-2.5 w-2.5 align-[-1px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75"></span>
            <span className="es-vivo-punto relative inline-flex h-2.5 w-2.5 rounded-full"></span>
          </span>
          <span className="es-vivo font-bold">EN VIVO</span>
          <span className="mx-1.5 text-muted">·</span>
          <span className="font-medium">{label}</span>
          {isVipEvent && (
            <span className="ml-1.5 px-1 py-0.5 text-3xs font-bold uppercase bg-muted/15 text-muted rounded">
              VIP
            </span>
          )}
          <span className="ml-1.5 text-primary font-semibold">
            {meetLink ? 'Entrar por Google Meet →' : 'Entrar a la clase →'}
          </span>
        </span>
      </Link>
    );
  }

  if (status === 'window_open') {
    return (
      <Link
        href={href}
        {...linkProps}
        className="block px-4 py-2 text-center text-sm transition-colors hover:opacity-90"
      >
        <span className="text-foreground">
          <span className="relative mr-1.5 inline-flex h-2 w-2 align-[1px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          <span className="font-medium">{label}</span>
          {isVipEvent && (
            <span className="ml-1.5 px-1 py-0.5 text-3xs font-bold uppercase bg-muted/15 text-muted rounded">
              VIP
            </span>
          )}
          <span className="mx-1.5 text-muted">·</span>
          <span className="font-semibold text-green-500">
            {meetLink ? 'Entrar por Google Meet' : 'Entrar a la clase'}
          </span>
          {timeUntil && (
            <span className="ml-1.5 text-muted">(inicia en {timeUntil})</span>
          )}
        </span>
      </Link>
    );
  }

  if (status === 'recently_ended') {
    return (
      <Link
        href={`/calendar?event=${upcomingEvent.id}`}
        className="block px-4 py-2 text-center text-sm text-muted transition-colors hover:text-foreground"
      >
        <span>
          <svg
            className="mr-1.5 inline-block h-4 w-4 align-[-3px] text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span className="font-medium text-foreground">{label}</span>
          <span className="mx-1.5 text-muted">·</span>
          <span className="text-primary font-medium">Clase terminada — ver grabación</span>
        </span>
      </Link>
    );
  }

  // status === 'future' (or null fallback)
  if (!timeUntil) return null;

  return (
    <Link
      href={`/calendar?event=${upcomingEvent.id}`}
      className="block px-4 py-2 text-center text-sm text-muted transition-colors hover:text-foreground"
    >
      <span>
        <svg
          className="mr-1.5 inline-block h-4 w-4 align-[-3px] text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="font-medium text-foreground">{label}</span>
        {isVipEvent && (
          <span className="ml-1.5 px-1 py-0.5 text-3xs font-bold uppercase bg-muted/15 text-muted rounded">
            VIP
          </span>
        )}
        <span className="mx-1.5 text-muted">·</span>
        <span className="text-muted">Podrás unirte en </span>
        <span className="text-primary font-semibold">{timeUntil}</span>
      </span>
    </Link>
  );
}
