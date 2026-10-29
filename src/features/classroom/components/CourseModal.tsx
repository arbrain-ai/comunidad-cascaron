'use client';

import { useState, useRef, useEffect } from 'react';
import { Course, CourseAccessType, UserTier } from '../types';
import { uploadCourseThumbnail } from '../services/classroomService';

interface CourseModalProps {
  course?: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description?: string;
    thumbnail_url?: string;
    published?: boolean;
    access_type?: CourseAccessType;
    unlock_level?: number | null;
    price_cents?: number | null;
    unlock_after_days?: number | null;
    tier_bypass_enabled?: boolean;
    tier_bypass_min?: 'standard' | 'vip' | null;
  }) => Promise<void>;
}

const ACCESS_OPTIONS: { value: CourseAccessType; label: string; icon: string }[] = [
  { value: 'open', label: 'Open', icon: '🌐' },
  { value: 'level_unlock', label: 'Level unlock', icon: '⬆️' },
  { value: 'buy_now', label: 'Buy now', icon: '💰' },
  { value: 'time_unlock', label: 'Time unlock (VIP Only)', icon: '⏰' },
  { value: 'private', label: 'Private', icon: '🔒' },
];

// Simplified: only VIP can bypass tier restrictions
const TIER_OPTIONS: { value: 'standard' | 'vip'; label: string }[] = [
  { value: 'standard', label: 'Standard (All Members)' },
  { value: 'vip', label: 'VIP' },
];

export function CourseModal({ course, isOpen, onClose, onSave }: CourseModalProps) {
  const [title, setTitle] = useState(course?.title || '');
  const [description, setDescription] = useState(course?.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(course?.thumbnail_url || '');
  const [published, setPublished] = useState(course?.published || false);
  const [accessType, setAccessType] = useState<CourseAccessType>(course?.access_type || 'open');

  // Conditional fields
  const [unlockLevel, setUnlockLevel] = useState<number>(course?.unlock_level || 1);
  const [priceCents, setPriceCents] = useState<number>(course?.price_cents || 0);
  const [priceDisplay, setPriceDisplay] = useState<string>(((course?.price_cents || 0) / 100).toFixed(2));
  const [unlockAfterDays, setUnlockAfterDays] = useState<number>(course?.unlock_after_days || 7);

  // Tier bypass: los VIP pueden saltar restricciones
  const [tierBypassEnabled, setTierBypassEnabled] = useState(course?.tier_bypass_enabled || false);
  const [tierBypassMin, setTierBypassMin] = useState<'standard' | 'vip'>(course?.tier_bypass_min || 'vip');

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when course prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(course?.title || '');
      setDescription(course?.description || '');
      setThumbnailUrl(course?.thumbnail_url || '');
      setPublished(course?.published || false);
      setAccessType(course?.access_type || 'open');
      setUnlockLevel(course?.unlock_level || 1);
      setPriceCents(course?.price_cents || 0);
      setPriceDisplay(((course?.price_cents || 0) / 100).toFixed(2));
      setUnlockAfterDays(course?.unlock_after_days || 7);
      setTierBypassEnabled(course?.tier_bypass_enabled || false);
      setTierBypassMin(course?.tier_bypass_min || 'vip');
    }
  }, [course, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen debe ser menor a 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadCourseThumbnail(file, course?.id || 'new');
      setThumbnailUrl(url);
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al subir la imagen: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('El título es requerido');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        thumbnail_url: thumbnailUrl || undefined,
        published,
        access_type: accessType,
        // Only include conditional fields when relevant
        unlock_level: accessType === 'level_unlock' ? unlockLevel : null,
        price_cents: accessType === 'buy_now' ? priceCents : null,
        unlock_after_days: accessType === 'time_unlock' ? unlockAfterDays : null,
        tier_bypass_enabled: tierBypassEnabled,
        tier_bypass_min: tierBypassEnabled ? tierBypassMin : null,
      });
      onClose();
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Error al guardar el curso');
    } finally {
      setIsSaving(false);
    }
  };

  // Format price for display
  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // Handle price input - allows free typing without reformatting
  const handlePriceChange = (value: string) => {
    // Allow user to type freely
    setPriceDisplay(value);
    // Parse and update cents
    const dollars = parseFloat(value) || 0;
    setPriceCents(Math.round(dollars * 100));
  };

  // Format on blur for clean display
  const handlePriceBlur = () => {
    setPriceDisplay(formatPrice(priceCents));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl border border-glass-strong shadow-[0_0_30px_rgba(168,85,247,0.15)] bg-background max-h-[90vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          {/* Header */}
          <h2 className="text-lg font-semibold text-foreground">
            {course ? 'Editar curso' : 'Crear curso'}
          </h2>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-sm text-muted">
              Nombre del curso
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              placeholder="Nombre del curso"
              className="w-full px-3 py-2 bg-surface border border-glass-strong rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors text-sm"
            />
            <div className="text-xs text-muted text-right">
              {title.length} / 50
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm text-muted">
              Descripción del curso
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Descripción opcional"
              className="w-full px-3 py-2 bg-surface border border-glass-strong rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none text-sm"
            />
            <div className="text-xs text-muted text-right">
              {description.length} / 500
            </div>
          </div>

          {/* Thumbnail - 16:9 */}
          <div className="space-y-2">
            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-surface border border-glass-strong">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                  <span>Sin portada</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted">
                Recomendado: 1920 x 1080 px (16:9)
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 text-sm bg-primary/10 border border-glass-strong rounded-lg text-foreground hover:bg-primary/20 hover:border-primary/50 transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Subiendo...' : 'Cambiar'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Access Type Selector - 5 Horizontal Options */}
          <div className="space-y-3">
            <label className="text-sm text-muted">Acceso</label>

            {/* 5 Radio Buttons */}
            <div className="flex gap-1.5">
              {ACCESS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAccessType(option.value)}
                  className={`
                    flex-1 py-2 px-1 rounded-lg border text-center transition-all
                    ${accessType === option.value
                      ? 'border-primary bg-primary/10 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'border-glass-strong hover:border-primary/50 bg-surface'
                    }
                  `}
                >
                  <div className="text-base mb-0.5">{option.icon}</div>
                  <div className={`text-3xs font-medium ${accessType === option.value ? 'text-primary' : 'text-foreground'}`}>
                    {option.label}
                  </div>
                </button>
              ))}
            </div>

            {/* Conditional Fields */}
            {accessType === 'level_unlock' && (
              <div className="p-3 rounded-lg bg-surface border border-glass-strong space-y-2">
                <label className="text-xs text-muted">Nivel requerido</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="9"
                    value={unlockLevel}
                    onChange={(e) => setUnlockLevel(parseInt(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="w-8 text-center text-sm font-semibold text-primary bg-primary/10 rounded px-2 py-1">
                    {unlockLevel}
                  </span>
                </div>
                <p className="text-3xs text-muted">
                  Solo usuarios nivel {unlockLevel} o superior podrán acceder
                </p>
              </div>
            )}

            {accessType === 'buy_now' && (
              <div className="p-3 rounded-lg bg-surface border border-glass-strong space-y-2">
                <label className="text-xs text-muted">Precio (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceDisplay}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    onBlur={handlePriceBlur}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full pl-7 pr-3 py-2 bg-background border border-glass-strong rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors text-sm"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-3xs text-muted">
                  Usuario deberá pagar ${formatPrice(priceCents)} USD para acceder
                </p>
              </div>
            )}

            {accessType === 'time_unlock' && (
              <div className="p-3 rounded-lg bg-surface border border-glass-strong space-y-2">
                <label className="text-xs text-muted">Días después de unirse</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={unlockAfterDays}
                    onChange={(e) => setUnlockAfterDays(parseInt(e.target.value) || 1)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-24 px-3 py-2 bg-background border border-glass-strong rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors text-sm"
                  />
                  <span className="text-sm text-muted">días</span>
                </div>
                <p className="text-3xs text-muted">
                  Se desbloqueará automáticamente {unlockAfterDays} días después de que el usuario se una
                </p>
              </div>
            )}

            {accessType === 'private' && (
              <div className="p-3 rounded-lg bg-surface border border-glass-strong space-y-2">
                <p className="text-xs text-muted">
                  Solo administradores y owners pueden acceder a este curso por defecto.
                </p>
              </div>
            )}

            {/* Tier Bypass Toggle - Available for ALL non-open options */}
            {accessType !== 'open' && (
              <div className="p-3 rounded-lg bg-surface border border-glass-strong space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Or members on/above tier:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTierBypassEnabled(!tierBypassEnabled)}
                    className={`
                      relative w-10 h-5 rounded-full transition-colors border
                      ${tierBypassEnabled ? 'bg-primary border-primary shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-surface border-primary/30'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-0.5 left-0 w-4 h-4 rounded-full transition-transform shadow-sm
                        ${tierBypassEnabled ? 'translate-x-[18px] bg-white' : 'translate-x-0.5 bg-muted'}
                      `}
                    />
                  </button>
                </div>

                {tierBypassEnabled && (
                  <select
                    value={tierBypassMin}
                    onChange={(e) => setTierBypassMin(e.target.value as 'standard' | 'vip')}
                    className="w-full px-3 py-2 bg-background border border-primary/30 rounded-lg text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  >
                    {TIER_OPTIONS.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                )}

                {tierBypassEnabled && (
                  <p className="text-3xs text-muted">
                    Miembros con tier {tierBypassMin === 'standard' ? 'Standard' : 'VIP'} o superior también tendrán acceso
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Published toggle */}
          <div className="flex items-center justify-between py-1">
            <span className={`text-sm font-medium ${published ? 'text-success' : 'text-muted'}`}>
              {published ? 'Publicado' : 'Borrador'}
            </span>
            <button
              onClick={() => setPublished(!published)}
              className={`
                relative w-11 h-6 rounded-full transition-colors border
                ${published ? 'bg-success border-success shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-surface border-primary/30'}
              `}
            >
              <span
                className={`
                  absolute top-1 left-0 w-4 h-4 rounded-full transition-transform shadow-sm
                  ${published ? 'translate-x-[22px] bg-white' : 'translate-x-1 bg-muted'}
                `}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-glass">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="btn-primary"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
