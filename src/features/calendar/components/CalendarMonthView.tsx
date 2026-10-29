'use client';

import { EventWithCreator } from '../types';
import { CalendarDay } from './CalendarDay';
import { getWeekDayHeaders, isSameDayAs } from '../utils/dateHelpers';

interface CalendarMonthViewProps {
  days: Date[];
  currentMonth: Date;
  events: EventWithCreator[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onEventClick?: (event: EventWithCreator) => void;
}

export function CalendarMonthView({
  days,
  currentMonth,
  events,
  selectedDate,
  onSelectDate,
  onEventClick,
}: CalendarMonthViewProps) {
  const weekHeaders = getWeekDayHeaders();

  // Group events by date
  const getEventsForDate = (date: Date): EventWithCreator[] => {
    return events.filter(event => isSameDayAs(event.start_time, date));
  };

  return (
    <div className="titanium-bezel">
      <div className="titanium-screen overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 bg-surface/30">
        {weekHeaders.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-muted border-b border-r border-glass last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <CalendarDay
            key={day.toISOString()}
            date={day}
            currentMonth={currentMonth}
            events={getEventsForDate(day)}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onEventClick={onEventClick}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
