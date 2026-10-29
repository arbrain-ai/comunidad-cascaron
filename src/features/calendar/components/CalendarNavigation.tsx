'use client';

interface CalendarNavigationProps {
  monthLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreateEvent?: () => void;
  showCreateButton?: boolean;
  hideVipEvents?: boolean;
  onToggleVipVisibility?: () => void;
}

export function CalendarNavigation({
  monthLabel,
  onPrevious,
  onNext,
  onToday,
  onCreateEvent,
  showCreateButton = false,
  hideVipEvents,
  onToggleVipVisibility,
}: CalendarNavigationProps) {
  return (
    <div className="flex items-center justify-between mb-4 md:mb-6">
      {/* Left: Today button + navigation arrows */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onToday}
          className="btn-secondary text-xs md:text-sm"
        >
          Hoy
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            className="p-1.5 md:p-2 hover:bg-secondary/50 rounded-lg transition-colors"
            aria-label="Mes anterior"
          >
            <svg
              className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={onNext}
            className="p-1.5 md:p-2 hover:bg-secondary/50 rounded-lg transition-colors"
            aria-label="Mes siguiente"
          >
            <svg
              className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground"
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
        </div>
      </div>

      {/* Center: Month label */}
      <h2 className="text-base md:text-xl font-semibold text-foreground capitalize">
        {monthLabel}
      </h2>

      {/* Right: VIP toggle + Create button */}
      <div className="flex items-center gap-2 md:gap-3">
        {onToggleVipVisibility && (
          <button
            onClick={onToggleVipVisibility}
            className={`p-2 rounded-lg transition-colors ${
              hideVipEvents
                ? 'bg-primary/15 text-primary-hover'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
            title={hideVipEvents ? 'Mostrar eventos VIP' : 'Ocultar eventos VIP'}
            aria-label={hideVipEvents ? 'Mostrar eventos VIP' : 'Ocultar eventos VIP'}
          >
            {hideVipEvents ? (
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
        {showCreateButton && onCreateEvent && (
          <button
            onClick={onCreateEvent}
            className="btn-primary flex items-center justify-center gap-2 p-2 md:px-4 md:py-2 text-sm"
          >
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="hidden md:inline">Crear evento</span>
          </button>
        )}
        {/* Spacer to maintain layout when no button */}
        {(!showCreateButton || !onCreateEvent) && !onToggleVipVisibility && <div className="w-10 md:w-32" />}
      </div>
    </div>
  );
}
