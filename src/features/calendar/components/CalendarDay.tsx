'use client';

import { EventWithCreator } from '../types';
import { EventCard } from './EventCard';
import { getDayNumber, isDayInMonth, isDateToday, isSameDayAs } from '../utils/dateHelpers';

interface CalendarDayProps {
  date: Date;
  currentMonth: Date;
  events: EventWithCreator[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onEventClick?: (event: EventWithCreator) => void;
}

export function CalendarDay({
  date,
  currentMonth,
  events,
  selectedDate,
  onSelectDate,
  onEventClick,
}: CalendarDayProps) {
  const isCurrentMonth = isDayInMonth(date, currentMonth);
  const isToday = isDateToday(date);
  const isSelected = selectedDate ? isSameDayAs(date, selectedDate) : false;
  const dayNumber = getDayNumber(date);

  // Limit displayed events to 3 for desktop
  const displayedEvents = events.slice(0, 3);
  const hiddenCount = events.length - displayedEvents.length;
  const hasEvents = events.length > 0;

  return (
    <div
      onClick={() => onSelectDate(date)}
      className={`
        min-h-[50px] md:min-h-[100px] p-1 md:p-2 border-b border-r border-glass cursor-pointer
        transition-colors
        ${!isCurrentMonth ? 'bg-surface/20' : 'hover:bg-primary/5'}
        ${isSelected ? 'bg-primary/10 md:bg-primary/10 border-glass-strong' : ''}
      `}
    >
      {/* Day number - centered on mobile, left-aligned on desktop */}
      <div className="flex justify-center md:justify-between items-start mb-0 md:mb-1">
        <span
          className={`
            inline-flex items-center justify-center w-7 h-7 text-sm rounded-full
            ${isToday ? 'bg-red-500 text-white font-semibold' : ''}
            ${isSelected && !isToday ? 'bg-primary/20 text-primary font-medium' : ''}
            ${!isCurrentMonth ? 'text-muted/50' : !isToday && !isSelected ? 'text-foreground' : ''}
          `}
        >
          {dayNumber}
        </span>
      </div>

      {/* Mobile: Show dots only */}
      {hasEvents && (
        <div className="flex md:hidden justify-center gap-0.5 mt-1">
          {events.slice(0, 3).map((_, index) => (
            <div
              key={index}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          ))}
        </div>
      )}

      {/* Desktop: Show event cards */}
      <div className="hidden md:block space-y-1">
        {displayedEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            compact
            onClick={() => onEventClick?.(event)}
          />
        ))}

        {hiddenCount > 0 && (
          <button
            className="w-full text-left px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            +{hiddenCount} más
          </button>
        )}
      </div>
    </div>
  );
}
