'use client';

import { EventWithCreator } from '../types';
import { formatDateLong, formatTime } from '../utils/dateHelpers';

interface DayEventsSectionProps {
  selectedDate: Date | null;
  events: EventWithCreator[];
  onEventClick?: (event: EventWithCreator) => void;
}

export function DayEventsSection({
  selectedDate,
  events,
  onEventClick,
}: DayEventsSectionProps) {
  if (!selectedDate) return null;

  // Filter events for selected date
  const dayEvents = events.filter(event => {
    const eventDate = new Date(event.start_time);
    return (
      eventDate.getDate() === selectedDate.getDate() &&
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  return (
    <div className="md:hidden mt-4 space-y-3">
      {/* Date header */}
      <h3 className="text-sm font-medium text-muted capitalize">
        {formatDateLong(selectedDate)}
      </h3>

      {/* Events list */}
      {dayEvents.length === 0 ? (
        <div className="sup p-4 text-center text-muted text-sm">
          No hay eventos para este día
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvents.map((event) => (
            <MobileEventCard
              key={event.id}
              event={event}
              onClick={() => onEventClick?.(event)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MobileEventCardProps {
  event: EventWithCreator;
  onClick?: () => void;
}

function MobileEventCard({ event, onClick }: MobileEventCardProps) {
  const startTime = formatTime(event.start_time);
  const endTime = event.end_time ? formatTime(event.end_time) : null;
  const timeDisplay = endTime ? `${startTime} - ${endTime}` : startTime;

  return (
    <button
      onClick={onClick}
      className="sup sup-i w-full p-3 flex items-start gap-3 text-left"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-surface/50">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <svg
              className="w-8 h-8 text-primary/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Time */}
        <p className="text-xs text-muted mb-1">
          Today @ {timeDisplay}
        </p>

        {/* Title */}
        <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-2">
          {event.title}
        </h4>

        {/* Badges */}
        <div className="flex items-center gap-2">
          {event.google_meet_link && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 10.9l3.9 2.1-3.9 2.1V10.9zm0-1.4L6.5 13l5.5 3 5.5-3.5L12 9.5z"/>
              </svg>
              Meet
            </span>
          )}
          {event.is_recurring && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded">
              <svg
                className="w-3 h-3"
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
      </div>

      {/* Chevron */}
      <svg
        className="flex-shrink-0 w-5 h-5 text-muted self-center"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );
}
