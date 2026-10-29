'use client';

import { EventWithCreator } from '../types';
import { formatTime } from '../utils/dateHelpers';

interface EventCardProps {
  event: EventWithCreator;
  onClick?: () => void;
  compact?: boolean;
}

export function EventCard({ event, onClick, compact = false }: EventCardProps) {
  if (compact) {
    // Mini version for calendar grid
    return (
      <button
        onClick={onClick}
        className="w-full text-left px-2 py-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded line-clamp-2 transition-colors"
      >
        {formatTime(event.start_time)} {event.title}
      </button>
    );
  }

  // Full version for lists/details
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl space-y-3 ${
        onClick ? 'sup sup-i cursor-pointer' : 'sup'
      }`}
    >
      {event.cover_image_url && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden">
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground line-clamp-2">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-sm text-muted line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {formatTime(event.start_time)}
          </span>

          {event.duration_minutes && (
            <span>{event.duration_minutes} min</span>
          )}

          {event.is_recurring && (
            <span className="flex items-center gap-1 text-primary">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Recurrente
            </span>
          )}
        </div>

        {event.google_meet_link && (
          <a
            href={event.google_meet_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 10.9l3.9 2.1-3.9 2.1V10.9zm0-1.4L6.5 13l5.5 3 5.5-3.5L12 9.5z"/>
            </svg>
            Unirse a Meet
          </a>
        )}
      </div>
    </div>
  );
}
