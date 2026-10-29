'use client';

import { useState, useRef } from 'react';
import { addMonths } from 'date-fns';
import {
  CreateEventInput,
  UpdateEventInput,
  RecurrencePattern,
  RECURRENCE_TYPE_LABELS,
  DAYS_OF_WEEK,
  UserTier,
  EventWithCreator,
} from '../types';
import {
  formatDateInput,
  formatTimeInput,
  parseDateTime,
} from '../utils/dateHelpers';
import {
  getRecurrenceDescription,
  estimateOccurrences,
  validateRecurrencePattern,
} from '../utils/recurrenceHelpers';
import { DurationSelector } from './DurationSelector';

interface EventFormProps {
  initialDate?: Date;
  event?: EventWithCreator; // For edit mode
  onSubmit: (input: CreateEventInput, coverFile?: File) => Promise<void>;
  onUpdate?: (eventId: string, input: UpdateEventInput, coverFile?: File) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EventForm({
  initialDate = new Date(),
  event,
  onSubmit,
  onUpdate,
  onCancel,
  isLoading = false,
}: EventFormProps) {
  const isEditMode = !!event;

  // Get initial values from event (for edit mode) or defaults
  const getInitialDate = () => {
    if (event) return new Date(event.start_time);
    return initialDate;
  };

  const eventDate = getInitialDate();

  // Form state
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [date, setDate] = useState(formatDateInput(eventDate));
  const [time, setTime] = useState(formatTimeInput(eventDate));
  const [duration, setDuration] = useState(event?.duration_minutes || 60);
  const [googleMeetLink, setGoogleMeetLink] = useState(event?.google_meet_link || '');
  const [recordingUrl, setRecordingUrl] = useState(event?.recording_url || '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(event?.cover_image_url || null);

  // Recurrence state (disabled in edit mode for now)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrencePattern['type']>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([eventDate.getDay()]);
  const [recurrenceUntil, setRecurrenceUntil] = useState(
    formatDateInput(addMonths(new Date(), 3))
  );

  // Tier state (simplified: one field for visibility/access)
  const [accessTier, setAccessTier] = useState<UserTier>(
    (event?.visible_to_tier as UserTier) || 'standard'
  );

  // Validation state
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setError('Solo se permiten imágenes');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('La imagen debe ser menor a 10MB');
        return;
      }

      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle day selection for weekly recurrence
  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // Build recurrence pattern
  const buildRecurrencePattern = (): RecurrencePattern | undefined => {
    if (!isRecurring) return undefined;

    const pattern: RecurrencePattern = {
      type: recurrenceType,
      interval: recurrenceInterval,
      until: new Date(recurrenceUntil).toISOString(),
    };

    if (recurrenceType === 'weekly') {
      pattern.days_of_week = selectedDays;
    }

    return pattern;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    // Validate recurrence pattern
    if (isRecurring) {
      const pattern = buildRecurrencePattern();
      if (pattern) {
        const validationError = validateRecurrencePattern(pattern);
        if (validationError) {
          setError(validationError);
          return;
        }
      }
    }

    try {
      if (isEditMode && event && onUpdate) {
        // Update existing event
        const updateInput: UpdateEventInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          start_time: parseDateTime(date, time),
          duration_minutes: duration,
          google_meet_link: googleMeetLink.trim() || null,
          // Pass empty string explicitly so service can clear the recording URL
          recording_url: recordingUrl.trim(),
        };

        await onUpdate(event.id, updateInput, coverFile || undefined);
      } else {
        // Create new event
        const input: CreateEventInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          start_time: parseDateTime(date, time),
          duration_minutes: duration,
          google_meet_link: googleMeetLink.trim() || undefined,
          recording_url: recordingUrl.trim() || undefined,
          is_recurring: isRecurring,
          recurrence_pattern: buildRecurrencePattern(),
          required_tier: accessTier,
          visible_to_tier: accessTier, // Simplified: same as required
        };

        await onSubmit(input, coverFile || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditMode ? 'Error al actualizar evento' : 'Error al crear evento');
    }
  };

  // Calculate estimated occurrences
  const estimatedOccurrences = isRecurring && buildRecurrencePattern()
    ? estimateOccurrences(new Date(parseDateTime(date, time)), buildRecurrencePattern()!)
    : 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        className="bg-background rounded-xl border border-border/30 w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border/20 flex-shrink-0">
          <h2 className="text-xl font-semibold text-foreground">
            {isEditMode ? 'Editar evento' : 'Crear evento'}
          </h2>
          <p className="text-sm text-muted mt-1">
            {isEditMode ? 'Modifica los detalles del evento' : 'Completa los detalles del nuevo evento'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Nombre del evento"
            />
            <div className="text-xs text-muted mt-1 text-right">
              {title.length}/100
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Fecha *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Hora *
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Duration */}
          <DurationSelector value={duration} onChange={setDuration} />

          {/* Google Meet Link — OPCIONAL desde el re-enable 2026-07-14.
              Vacío → el evento usa la plataforma de video PROPIA (sala
              nativa, grabación y transcripción automáticas). Con link →
              el evento sale por Google Meet (flujo legacy). */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              🎥 Link de Google Meet <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              type="url"
              value={googleMeetLink}
              onChange={(e) => setGoogleMeetLink(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
            />
            <p className="text-xs text-muted">
              Déjalo vacío para usar la videollamada nativa de la comunidad (sala
              propia). Pega un link solo si esta sesión debe salir por Google Meet u
              otra plataforma.
            </p>
          </div>

          {/* Recording URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Link de grabación
            </label>
            <input
              type="url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="https://..."
            />
            <p className="text-xs text-muted mt-1">
              {isEditMode && recordingUrl
                ? 'Edita para cambiar la grabación vinculada'
                : 'Añade el link de la grabación del evento (opcional)'
              }
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Describe el evento..."
            />
            <div className="text-xs text-muted mt-1 text-right">
              {description.length}/500
            </div>
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Imagen de portada
            </label>

            {coverPreview ? (
              <div className="relative">
                <img
                  src={coverPreview}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCoverFile(null);
                    setCoverPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-muted">Click para subir imagen</span>
                <span className="text-xs text-muted">1460 x 752 px recomendado · Máx 10MB</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Access Tier Selector (simplified) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Acceso
            </label>
            <div className="flex gap-2">
              {(['standard', 'vip'] as UserTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setAccessTier(tier)}
                  className={`
                    flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                    ${accessTier === tier
                      ? tier === 'vip'
                        ? 'bg-primary text-white'
                        : 'bg-success text-white'
                      : 'bg-secondary/50 text-foreground hover:bg-secondary'
                    }
                  `}
                >
                  {tier === 'standard' ? 'Todos' : 'VIP'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1">
              {accessTier === 'vip'
                ? 'Solo los miembros VIP verán y podrán acceder'
                : 'Todos los miembros verán y podrán acceder'
              }
            </p>
          </div>

          {/* Recurring Event Toggle - Only show in create mode */}
          {!isEditMode && (
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-border/30 text-primary focus:ring-primary/50"
              />
              <span className="text-sm font-medium text-foreground">
                Evento recurrente
              </span>
            </label>

            {/* Recurrence Options */}
            {isRecurring && (
              <div className="space-y-4 p-4 bg-secondary/20 rounded-lg">
                {/* Recurrence Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Repetir
                  </label>
                  <div className="flex gap-2">
                    {(Object.keys(RECURRENCE_TYPE_LABELS) as RecurrencePattern['type'][]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRecurrenceType(type)}
                        className={`
                          px-3 py-1.5 text-sm rounded-lg transition-colors
                          ${recurrenceType === type
                            ? 'bg-primary text-white'
                            : 'bg-secondary/50 text-foreground hover:bg-secondary'
                          }
                        `}
                      >
                        {RECURRENCE_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interval */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Cada
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                    />
                    <span className="text-sm text-muted">
                      {recurrenceType === 'daily' && (recurrenceInterval === 1 ? 'día' : 'días')}
                      {recurrenceType === 'weekly' && (recurrenceInterval === 1 ? 'semana' : 'semanas')}
                      {recurrenceType === 'monthly' && (recurrenceInterval === 1 ? 'mes' : 'meses')}
                    </span>
                  </div>
                </div>

                {/* Days of Week (for weekly) */}
                {recurrenceType === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Los días
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleDay(value)}
                          className={`
                            w-10 h-10 rounded-full text-sm font-medium transition-colors
                            ${selectedDays.includes(value)
                              ? 'bg-primary text-white'
                              : 'bg-secondary/50 text-foreground hover:bg-secondary'
                            }
                          `}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Until Date */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={recurrenceUntil}
                    onChange={(e) => setRecurrenceUntil(e.target.value)}
                    min={date}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>

                {/* Recurrence Summary */}
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm text-foreground">
                    {getRecurrenceDescription(buildRecurrencePattern()!)}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Se crearán aproximadamente {estimatedOccurrences} eventos
                  </p>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border/20">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="btn-ghost text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary text-sm"
            >
              {isLoading
                ? (isEditMode ? 'Guardando...' : 'Creando...')
                : (isEditMode ? 'Guardar cambios' : 'Crear evento')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
