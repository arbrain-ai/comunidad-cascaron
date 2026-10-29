'use client';

type ActionType = 'single' | 'future';

interface RecurringEventModalProps {
  mode: 'edit' | 'delete';
  eventTitle: string;
  onConfirm: (actionType: ActionType) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RecurringEventModal({
  mode,
  eventTitle,
  onConfirm,
  onCancel,
  isLoading = false,
}: RecurringEventModalProps) {
  const isDelete = mode === 'delete';

  const config = {
    edit: {
      title: 'Editar evento recurrente',
      question: 'Este es un evento recurrente. ¿Qué deseas modificar?',
      futureLabel: 'Este y futuros de esta serie',
      futureDescription: 'Aplica los cambios a todos los eventos futuros de esta serie',
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      futureBorder: 'border-primary/30',
      futureHover: 'hover:bg-primary/10',
      futureTextColor: 'text-primary',
    },
    delete: {
      title: 'Eliminar evento',
      question: 'Este es un evento recurrente. ¿Qué deseas eliminar?',
      futureLabel: 'Este y futuros de esta serie',
      futureDescription: 'Elimina este evento y todos los futuros de esta serie',
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      futureBorder: 'border-red-500/30',
      futureHover: 'hover:bg-red-500/10',
      futureTextColor: 'text-red-500',
    },
  };

  const c = config[mode];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        className="bg-background rounded-xl border border-border/30 w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 ${c.iconBg} rounded-full`}>
            {isDelete ? (
              <svg
                className={`w-6 h-6 ${c.iconColor}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            ) : (
              <svg
                className={`w-6 h-6 ${c.iconColor}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{c.title}</h3>
            <p className="text-sm text-muted truncate max-w-[280px]">{eventTitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <p className="text-sm text-muted mb-4">{c.question}</p>

          {/* Option: Single */}
          <button
            onClick={() => onConfirm('single')}
            disabled={isLoading}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-secondary/50 transition-colors text-left disabled:opacity-50"
          >
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <svg
                className="w-5 h-5 text-blue-500"
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
            </div>
            <div>
              <p className="font-medium text-foreground">Solo este evento</p>
              <p className="text-xs text-muted">
                Los demás eventos de la serie permanecen
              </p>
            </div>
          </button>

          {/* Option: Future */}
          <button
            onClick={() => onConfirm('future')}
            disabled={isLoading}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border ${c.futureBorder} ${c.futureHover} transition-colors text-left disabled:opacity-50`}
          >
            <div className={`p-2 ${c.iconBg} rounded-lg`}>
              <svg
                className={`w-5 h-5 ${c.futureTextColor}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </div>
            <div>
              <p className={`font-medium ${c.futureTextColor}`}>{c.futureLabel}</p>
              <p className="text-xs text-muted">{c.futureDescription}</p>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="w-full mt-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </div>
  );
}
