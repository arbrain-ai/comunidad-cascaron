'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { uploadAvatar, deleteAvatar } from '@/shared/lib/supabaseStorage';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { UserProfile } from '@/shared/types/user.types';
import { LocationInput } from '@/features/map/components/LocationInput';
import { LocationInput as LocationInputType } from '@/features/map/types';
import { getUserLocationSettings } from '@/features/map/services/mapService';
import { Github, ExternalLink, Loader2, Cloud, X } from 'lucide-react';
import { PasswordSection } from './PasswordSection';

interface ProfileFormProps {
  profile: UserProfile;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProfileForm({ profile, onCancel }: ProfileFormProps) {
  const { refetchUserProfile } = useUserProfile();

  // Form state
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [error, setError] = useState<string | null>(null);

  // Location state
  const [location, setLocation] = useState<LocationInputType | null>(null);
  const [locationVisible, setLocationVisible] = useState(true);
  const [locationLoaded, setLocationLoaded] = useState(false);

  // GitHub state
  const profileGithubUsername = (profile as UserProfile & { github_username?: string }).github_username;
  const [githubUsername, setGithubUsername] = useState(profileGithubUsername || '');

  // Autoguardado global
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs para trackear valores guardados
  const lastSavedRef = useRef({
    fullName: profile.full_name || '',
    bio: profile.bio || '',
    githubUsername: profileGithubUsername || '',
    location: null as LocationInputType | null,
    locationVisible: true,
  });

  // Load user location on mount
  useEffect(() => {
    const loadLocation = async () => {
      const settings = await getUserLocationSettings(profile.id);
      if (settings) {
        if (settings.location_lat && settings.location_lng) {
          const loc = {
            city: settings.location_city || '',
            country: settings.location_country || '',
            lat: settings.location_lat,
            lng: settings.location_lng,
          };
          setLocation(loc);
          lastSavedRef.current.location = loc;
        }
        setLocationVisible(settings.location_visible ?? true);
        lastSavedRef.current.locationVisible = settings.location_visible ?? true;
      }
      setLocationLoaded(true);
    };
    loadLocation();
  }, [profile.id]);

  // Función de guardado unificada
  const saveProfile = useCallback(async () => {
    const currentValues = {
      fullName: fullName.trim(),
      bio: bio.trim(),
      githubUsername: githubUsername.trim(),
      location,
      locationVisible,
    };

    // Verificar si hay cambios reales
    const hasChanges =
      currentValues.fullName !== lastSavedRef.current.fullName ||
      currentValues.bio !== lastSavedRef.current.bio ||
      currentValues.githubUsername !== lastSavedRef.current.githubUsername ||
      JSON.stringify(currentValues.location) !== JSON.stringify(lastSavedRef.current.location) ||
      currentValues.locationVisible !== lastSavedRef.current.locationVisible;

    if (!hasChanges) return;

    // Validar nombre requerido
    if (!currentValues.fullName) {
      setError('El nombre es requerido');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError, data: updateData } = await supabase
        .from('profiles')
        .update({
          full_name: currentValues.fullName,
          bio: currentValues.bio || null,
          github_username: currentValues.githubUsername || null,
          location_city: currentValues.location?.city || null,
          location_country: currentValues.location?.country || null,
          location_lat: currentValues.location?.lat || null,
          location_lng: currentValues.location?.lng || null,
          location_visible: currentValues.locationVisible,
        })
        .eq('id', profile.id)
        .select();

      if (updateError) {
        console.error('[ProfileForm] Supabase update error:', updateError);
        throw updateError;
      }

      console.log('[ProfileForm] Update successful:', updateData);

      // Actualizar refs con valores guardados
      lastSavedRef.current = { ...currentValues };
      setLastSaved(new Date());

      // Refrescar contexto de usuario (no crítico - si falla, no mostrar error)
      try {
        await refetchUserProfile();
      } catch (refetchErr) {
        console.warn('[ProfileForm] Refetch failed (non-critical):', refetchErr);
      }
    } catch (err) {
      // Mejorar logging para capturar detalles del error
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorDetails = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : 'unknown';
      console.error('[ProfileForm] Error saving:', { message: errorMessage, code: errorDetails, raw: err });
      setError(`Error al guardar: ${errorMessage || 'Intenta de nuevo.'}`);
    } finally {
      setIsSaving(false);
    }
  }, [fullName, bio, githubUsername, location, locationVisible, profile.id, refetchUserProfile]);

  // Efecto de debounce para autoguardado
  useEffect(() => {
    // No guardar hasta que la ubicación se haya cargado
    if (!locationLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProfile();
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [fullName, bio, githubUsername, location, locationVisible, saveProfile, locationLoaded]);

  // Handle GitHub username change - sanitize input
  const handleGithubUsernameChange = (value: string) => {
    let cleaned = value.trim().toLowerCase();
    cleaned = cleaned.replace(/^@/, '');
    cleaned = cleaned.replace(/^https?:\/\/(www\.)?github\.com\//, '');
    cleaned = cleaned.replace(/\/$/, '');
    cleaned = cleaned.replace(/[^a-z0-9-]/g, '');
    setGithubUsername(cleaned);
  };

  // Handle avatar upload - guardado inmediato con manejo robusto para móvil
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validaciones
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setIsProcessingImage(true);

    // Preview con manejo de errores para móvil
    const reader = new FileReader();

    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
      setIsProcessingImage(false);
    };

    reader.onerror = () => {
      console.error('FileReader error');
      setError('Error al procesar la imagen. Por favor, intenta con otra foto.');
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onabort = () => {
      console.warn('FileReader aborted');
      setError('Se canceló la carga de la imagen.');
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsDataURL(file);

    // Upload con timeout de 30s para evitar hangs en móvil
    setIsUploading(true);

    try {
      const uploadPromise = uploadAvatar(profile.id, file);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('La subida tardó demasiado. Por favor, intenta de nuevo.')), 30000)
      );

      const avatarUrl = await Promise.race([uploadPromise, timeoutPromise]);

      await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      setAvatarPreview(avatarUrl);
      setLastSaved(new Date());
      await refetchUserProfile();
    } catch (err) {
      console.error('Error uploading avatar:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al subir la imagen';
      setError(errorMessage);
      setAvatarPreview(profile.avatar_url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsUploading(false);
    }
  };

  // Handle avatar removal - guardado inmediato
  const handleRemoveAvatar = async () => {
    setIsUploading(true);
    setError(null);

    try {
      if (profile.avatar_url) {
        await deleteAvatar(profile.id);
      }

      await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);

      setAvatarPreview(null);
      setLastSaved(new Date());
      await refetchUserProfile();
    } catch (err) {
      console.error('Error removing avatar:', err);
      setError('Error al eliminar la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto relative">
      {/* Close button - top right corner */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute -top-2 -right-2 p-2 text-muted hover:text-foreground hover:bg-secondary/50 rounded-full transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Indicador de estado de guardado */}
      <div className="flex items-center justify-end gap-2 mb-4 h-6 pr-8">
        {isSaving || isUploading || isProcessingImage ? (
          <div className="flex items-center gap-2 text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isProcessingImage ? 'Procesando imagen...' : 'Guardando...'}</span>
          </div>
        ) : lastSaved ? (
          <div className="flex items-center gap-2 text-success text-sm">
            <Cloud className="w-4 h-4" />
            <span>Guardado</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted text-sm">
            <Cloud className="w-4 h-4" />
            <span>Autoguardado activo</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center">
          <div className="relative w-24 h-24 mb-4">
            {(isUploading || isProcessingImage) && (
              <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-full h-full rounded-full object-cover border-2 border-border/50"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-secondary/50 flex items-center justify-center text-muted">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <label className={`cursor-pointer px-4 py-2 bg-secondary/50 hover:bg-secondary text-foreground rounded-lg transition-colors ${(isUploading || isProcessingImage) ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <span className="text-sm">{isProcessingImage ? 'Procesando...' : 'Cambiar foto'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={isUploading || isProcessingImage}
              />
            </label>

            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isUploading || isProcessingImage}
                className="px-4 py-2 bg-error/20 hover:bg-error/30 text-error rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-2">
            Nombre completo <span className="text-error">*</span>
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Tu nombre completo"
          />
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-2">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            placeholder="Cuéntanos un poco sobre ti..."
          />
        </div>

        {/* Location */}
        <LocationInput
          value={location}
          onChange={setLocation}
          visible={locationVisible}
          onVisibilityChange={setLocationVisible}
        />

        {/* GitHub */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-foreground">
            <Github className="w-5 h-5" />
            <span className="font-medium">GitHub</span>
          </div>

          {/* GitHub Username Input */}
          <div>
            <label htmlFor="githubUsername" className="block text-sm text-muted mb-2">
              Username de GitHub
            </label>
            <div className="flex">
              <span className="px-3 py-2 bg-secondary/30 border border-r-0 border-border rounded-l-lg text-muted text-sm">
                github.com/
              </span>
              <input
                id="githubUsername"
                type="text"
                value={githubUsername}
                onChange={(e) => handleGithubUsernameChange(e.target.value)}
                placeholder="tu-username"
                className="flex-1 px-3 py-2 bg-background border border-border rounded-r-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {githubUsername && (
              <a
                href={`https://github.com/${githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
              >
                Ver perfil <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Password Section */}
        <PasswordSection />

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
