// ============================================
// Leaderboard Management - Admin Panel
// ============================================
// Gestiona los premios por nivel desde el admin

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  Upload,
  Eye,
} from 'lucide-react';
import {
  getAllLevelRewards,
  updateLevelReward,
  uploadPreviewImage,
  deletePreviewImage,
  type LevelRewardDB,
  type RewardItem,
  type UpdateLevelRewardInput,
} from '../services/levelRewardsService';
import { LEVEL_THRESHOLDS } from '@/features/gamification/types';
import { UserLevelBadge } from '@/features/gamification/components/UserLevelBadge';

export function LeaderboardManagement() {
  const [rewards, setRewards] = useState<LevelRewardDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [savingLevel, setSavingLevel] = useState<number | null>(null);
  const [previewModal, setPreviewModal] = useState<LevelRewardDB | null>(null);

  const loadRewards = useCallback(async () => {
    try {
      const data = await getAllLevelRewards();
      setRewards(data);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const handleSave = async (level: number, updates: UpdateLevelRewardInput) => {
    setSavingLevel(level);
    try {
      const result = await updateLevelReward(level, updates);
      if (result.success) {
        await loadRewards();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar');
    } finally {
      setSavingLevel(null);
    }
  };

  const handleImageUpload = async (level: number, file: File) => {
    setSavingLevel(level);
    try {
      const result = await uploadPreviewImage(level, file);
      if (result.url) {
        await loadRewards();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir imagen');
    } finally {
      setSavingLevel(null);
    }
  };

  const handleImageDelete = async (level: number, currentUrl: string) => {
    if (!confirm('Eliminar esta imagen?')) return;
    setSavingLevel(level);
    try {
      const result = await deletePreviewImage(level, currentUrl);
      if (result.success) {
        await loadRewards();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setSavingLevel(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-black text-foreground flex items-center gap-2">
            <Trophy className="text-amber-500" size={28} />
            Premios por Nivel
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configura los premios que los usuarios desbloquean al subir de nivel
          </p>
        </div>
      </div>

      {/* Rewards List */}
      <div className="space-y-3">
        {rewards.map((reward) => (
          <RewardEditor
            key={reward.level}
            reward={reward}
            isExpanded={expandedLevel === reward.level}
            isSaving={savingLevel === reward.level}
            onToggle={() =>
              setExpandedLevel(expandedLevel === reward.level ? null : reward.level)
            }
            onSave={(updates) => handleSave(reward.level, updates)}
            onImageUpload={(file) => handleImageUpload(reward.level, file)}
            onImageDelete={() =>
              reward.preview_image_url && handleImageDelete(reward.level, reward.preview_image_url)
            }
            onPreview={() => setPreviewModal(reward)}
          />
        ))}
      </div>

      {/* Preview Modal */}
      {previewModal && (
        <PreviewModal reward={previewModal} onClose={() => setPreviewModal(null)} />
      )}
    </div>
  );
}

interface RewardEditorProps {
  reward: LevelRewardDB;
  isExpanded: boolean;
  isSaving: boolean;
  onToggle: () => void;
  onSave: (updates: UpdateLevelRewardInput) => void;
  onImageUpload: (file: File) => void;
  onImageDelete: () => void;
  onPreview: () => void;
}

export function RewardEditor({
  reward,
  isExpanded,
  isSaving,
  onToggle,
  onSave,
  onImageUpload,
  onImageDelete,
  onPreview,
}: RewardEditorProps) {
  const [formData, setFormData] = useState({
    title: reward.title,
    description: reward.description,
    icon: reward.icon,
    expanded_title: reward.expanded_title || '',
    expanded_description: reward.expanded_description || '',
    rewards: reward.rewards || [],
  });

  const levelInfo = LEVEL_THRESHOLDS.find(({ level }) => level === reward.level);
  const hasChanges =
    formData.title !== reward.title ||
    formData.description !== reward.description ||
    formData.icon !== reward.icon ||
    formData.expanded_title !== (reward.expanded_title || '') ||
    formData.expanded_description !== (reward.expanded_description || '') ||
    JSON.stringify(formData.rewards) !== JSON.stringify(reward.rewards || []);

  const handleAddReward = () => {
    setFormData({
      ...formData,
      rewards: [...formData.rewards, { title: '', description: '', icon: '' }],
    });
  };

  const handleRemoveReward = (index: number) => {
    setFormData({
      ...formData,
      rewards: formData.rewards.filter((_, i) => i !== index),
    });
  };

  const handleRewardChange = (index: number, field: keyof RewardItem, value: string) => {
    const newRewards = [...formData.rewards];
    newRewards[index] = { ...newRewards[index], [field]: value };
    setFormData({ ...formData, rewards: newRewards });
  };

  const handleSubmit = () => {
    onSave({
      title: formData.title,
      description: formData.description,
      icon: formData.icon,
      expanded_title: formData.expanded_title || null,
      expanded_description: formData.expanded_description || null,
      rewards: formData.rewards,
    });
  };

  // Historical reward rows can outlive levels removed from the current ladder.
  // Keep the data intact without rendering an editor for an unsupported level.
  if (!levelInfo) {
    return (
      <div role="status" className="solid-card p-4 text-sm text-muted-foreground">
        El premio «{reward.title}» pertenece a un nivel que ya no está disponible
        (nivel {String(reward.level)}). Sus datos se conservan.
      </div>
    );
  }

  return (
    <div className="solid-card overflow-hidden">
      {/* Header - Clickable */}
      <div
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      >
        <div className="flex items-center gap-4">
          <UserLevelBadge level={reward.level} size="md" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl">{reward.icon}</span>
              <h3 className="font-semibold text-foreground">{reward.title}</h3>
              {hasChanges && (
                <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
                  Sin guardar
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {levelInfo.name} - {levelInfo.minPoints.toLocaleString()} pts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"
            title="Preview"
          >
            <Eye size={18} />
          </button>
          {isExpanded ? (
            <ChevronUp size={20} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={20} className="text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-6 bg-background/50">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Emoji
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-center text-2xl"
                maxLength={4}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Titulo
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Descripcion Corta
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
            />
          </div>

          {/* Expanded Details */}
          <div className="border-t border-border/50 pt-4">
            <h4 className="text-sm font-semibold text-amber-500 mb-3 flex items-center gap-2">
              <ChevronDown size={16} />
              Contenido Expandido (visible al hacer click)
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Titulo Expandido
                </label>
                <input
                  type="text"
                  value={formData.expanded_title}
                  onChange={(e) =>
                    setFormData({ ...formData, expanded_title: e.target.value })
                  }
                  placeholder="Titulo mas descriptivo..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Descripcion Expandida
                </label>
                <textarea
                  value={formData.expanded_description}
                  onChange={(e) =>
                    setFormData({ ...formData, expanded_description: e.target.value })
                  }
                  placeholder="Descripcion detallada de lo que desbloquea este nivel..."
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground resize-none"
                />
              </div>

              {/* Preview Image */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Imagen de Preview
                </label>
                {reward.preview_image_url ? (
                  <div className="relative inline-block">
                    <img
                      src={reward.preview_image_url}
                      alt={`Preview nivel ${reward.level}`}
                      className="max-w-md h-auto rounded-lg border border-border"
                    />
                    <button
                      onClick={onImageDelete}
                      disabled={isSaving}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-full max-w-md h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-amber-500 hover:bg-amber-500/5 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImageUpload(file);
                      }}
                      disabled={isSaving}
                    />
                    <div className="text-center">
                      <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click para subir captura
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Multiple Rewards */}
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground">
                Recompensas Individuales
              </h4>
              <button
                onClick={handleAddReward}
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                <Plus size={14} />
                Agregar
              </button>
            </div>

            <div className="space-y-3">
              {formData.rewards.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 bg-background rounded-lg border border-border"
                >
                  <div className="flex flex-col items-center gap-1">
                    {item.icon.startsWith('http') ? (
                      <img
                        src={item.icon}
                        alt={item.title}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <input
                        type="text"
                        value={item.icon}
                        onChange={(e) => handleRewardChange(index, 'icon', e.target.value)}
                        placeholder=""
                        className="w-12 px-2 py-1.5 bg-card border border-border rounded text-center text-lg"
                        maxLength={4}
                      />
                    )}
                    {item.icon.startsWith('http') && (
                      <button
                        onClick={() => handleRewardChange(index, 'icon', '')}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleRewardChange(index, 'title', e.target.value)}
                      placeholder="Titulo de la recompensa"
                      className="w-full px-2 py-1.5 bg-card border border-border rounded text-sm"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        handleRewardChange(index, 'description', e.target.value)
                      }
                      placeholder="Descripcion"
                      className="w-full px-2 py-1.5 bg-card border border-border rounded text-sm text-muted-foreground"
                    />
                    {!item.icon.startsWith('http') && (
                      <input
                        type="text"
                        value={item.icon.startsWith('http') ? item.icon : ''}
                        onChange={(e) => handleRewardChange(index, 'icon', e.target.value)}
                        placeholder="URL de imagen (opcional)"
                        className="w-full px-2 py-1.5 bg-card border border-border rounded text-xs text-muted-foreground"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveReward(index)}
                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors self-start"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {formData.rewards.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay recompensas individuales. Click en &quot;Agregar&quot; para crear
                  una.
                </p>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSubmit}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PreviewModalProps {
  reward: LevelRewardDB;
  onClose: () => void;
}

export function PreviewModal({ reward, onClose }: PreviewModalProps) {
  const levelInfo = LEVEL_THRESHOLDS.find(({ level }) => level === reward.level);

  if (!levelInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)] bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserLevelBadge level={reward.level} size="md" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Preview Nivel {reward.level}
              </h2>
              <p className="text-sm text-muted-foreground">{levelInfo.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Basic */}
          <div className="flex items-start gap-4">
            <span className="text-4xl">{reward.icon}</span>
            <div>
              <h3 className="font-semibold text-foreground text-lg">{reward.title}</h3>
              <p className="text-muted-foreground">{reward.description}</p>
            </div>
          </div>

          {/* Expanded Content */}
          {(reward.expanded_title || reward.expanded_description || reward.preview_image_url) && (
            <div className="border-t border-border/50 pt-4 space-y-3">
              <p className="text-xs text-amber-500 font-medium uppercase tracking-wide">
                Contenido Expandido
              </p>
              {reward.expanded_title && (
                <h4 className="font-semibold text-foreground">{reward.expanded_title}</h4>
              )}
              {reward.expanded_description && (
                <p className="text-muted-foreground">{reward.expanded_description}</p>
              )}
              {reward.preview_image_url && (
                <img
                  src={reward.preview_image_url}
                  alt={`Preview nivel ${reward.level}`}
                  className="w-full rounded-lg border border-border"
                />
              )}
            </div>
          )}

          {/* Individual Rewards */}
          {reward.rewards && reward.rewards.length > 0 && (
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs text-amber-500 font-medium uppercase tracking-wide mb-3">
                Recompensas
              </p>
              <div className="space-y-2">
                {reward.rewards.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border"
                  >
                    {item.icon.startsWith('http') ? (
                      <img
                        src={item.icon}
                        alt={item.title}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <span className="text-xl">{item.icon}</span>
                    )}
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
