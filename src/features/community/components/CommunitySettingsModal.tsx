'use client';

import { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import {
  CommunitySettings,
  updateCommunitySettings,
  uploadCommunityImage,
} from '../services/communitySettingsService';

interface Props {
  settings: CommunitySettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: CommunitySettings) => void;
}

export function CommunitySettingsModal({ settings, isOpen, onClose, onSave }: Props) {
  const [name, setName] = useState(settings.name);
  const [description, setDescription] = useState(settings.description || '');
  const [coverPreview, setCoverPreview] = useState(settings.cover_image_url || '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let coverUrl = settings.cover_image_url;

      // Upload new cover if selected
      if (coverFile) {
        coverUrl = await uploadCommunityImage(coverFile, 'cover');
      }

      const updated = await updateCommunitySettings({
        name,
        description,
        cover_image_url: coverUrl,
      });

      if (updated) {
        onSave(updated);
        onClose();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 glass-panel rounded-xl border border-[rgba(104,58,204,0.3)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(104,58,204,0.2)]">
          <h2 className="text-lg font-sans font-black text-foreground">
            Configurar Comunidad
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[rgba(104,58,204,0.1)] transition-colors"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Cover Image Upload - 16:9 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Imagen de Portada (16:9)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative aspect-video rounded-xl border-2 border-dashed border-[rgba(104,58,204,0.3)] hover:border-primary/50 transition-colors cursor-pointer overflow-hidden bg-[#050505]/50"
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <span className="text-sm">Click para subir imagen</span>
                  <span className="text-xs mt-1">Recomendado: 1920x1080</span>
                </div>
              )}
              {coverPreview && (
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nombre de la Comunidad
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-[#050505]/60 border border-[rgba(104,58,204,0.2)] rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-[rgba(104,58,204,0.5)] focus:ring-1 focus:ring-primary/30"
              placeholder="Nombre de tu comunidad"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Descripcion
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-[#050505]/60 border border-[rgba(104,58,204,0.2)] rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-[rgba(104,58,204,0.5)] focus:ring-1 focus:ring-primary/30 resize-none"
              placeholder="Describe tu comunidad..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-[rgba(104,58,204,0.3)] text-foreground hover:bg-[rgba(104,58,204,0.1)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
