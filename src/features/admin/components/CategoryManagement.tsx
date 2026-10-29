'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabase';

interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  description: string;
  permissions: 'members' | 'admins';
  sort_method: 'default' | 'top_week' | 'top_month' | 'latest';
  order_position: number;
}

interface CategoryFormData {
  name: string;
  emoji: string;
  description: string;
  permissions: 'members' | 'admins';
  sort_method: 'default' | 'top_week' | 'top_month' | 'latest';
}

const SORT_LABELS: Record<string, string> = {
  default: 'Default',
  top_week: 'Top (week)',
  top_month: 'Top (month)',
  latest: 'Latest',
};

const PERMISSION_LABELS: Record<string, string> = {
  members: 'Members',
  admins: 'Admins',
};

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    emoji: '',
    description: '',
    permissions: 'members',
    sort_method: 'default',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('order_position');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      emoji: '',
      description: '',
      permissions: 'members',
      sort_method: 'default',
    });
    setError(null);
    setShowModal(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      emoji: category.emoji || '',
      description: category.description || '',
      permissions: category.permissions || 'members',
      sort_method: category.sort_method || 'default',
    });
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('¿Eliminar esta categoría? Los posts asociados perderán su categoría.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      setCategories(categories.filter(c => c.id !== categoryId));
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Error al eliminar categoría');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (!formData.name.trim()) {
        throw new Error('El nombre es requerido');
      }

      if (editingCategory) {
        // Update existing
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            slug: generateSlug(formData.name),
            emoji: formData.emoji,
            description: formData.description.trim(),
            permissions: formData.permissions,
            sort_method: formData.sort_method,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        // Create new
        const maxOrder = categories.length > 0
          ? Math.max(...categories.map(c => c.order_position))
          : 0;

        const { error } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            slug: generateSlug(formData.name),
            emoji: formData.emoji,
            color: '#683ACC',
            description: formData.description.trim(),
            permissions: formData.permissions,
            sort_method: formData.sort_method,
            order_position: maxOrder + 1,
          });

        if (error) throw error;
      }

      setShowModal(false);
      loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="solid-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Categories</h2>
            <p className="text-sm text-muted mt-1">
              Organize posts with categories, permissions, and sort methods.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium"
          >
            NEW
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="solid-card divide-y divide-border">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{category.emoji}</span>
              <div>
                <span className="font-medium text-foreground">{category.name}</span>
                <span className="ml-3 text-sm text-muted">
                  Permissions: {PERMISSION_LABELS[category.permissions]}
                </span>
                <span className="ml-3 text-sm text-muted">
                  Sort: {SORT_LABELS[category.sort_method]}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleEdit(category)}
              className="p-2 text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="18" r="2" />
              </svg>
            </button>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="p-8 text-center text-muted">
            No hay categorías. Crea una nueva.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-xl border border-border/30 w-full max-w-md">
            <div className="p-6 border-b border-border/20">
              <h3 className="text-xl font-semibold text-foreground">
                {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              {/* Name & Emoji */}
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={formData.emoji}
                    onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                    className="w-16 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="💬"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Nombre de la categoría"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Breve descripción"
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Permisos
                </label>
                <select
                  value={formData.permissions}
                  onChange={(e) => setFormData({ ...formData, permissions: e.target.value as any })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="members">Members - Todos pueden publicar</option>
                  <option value="admins">Admins - Solo administradores</option>
                </select>
              </div>

              {/* Sort Method */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ordenar por
                </label>
                <select
                  value={formData.sort_method}
                  onChange={(e) => setFormData({ ...formData, sort_method: e.target.value as any })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="default">Default - Por fecha</option>
                  <option value="top_week">Top (week) - Más populares de la semana</option>
                  <option value="top_month">Top (month) - Más populares del mes</option>
                  <option value="latest">Latest - Más recientes</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(editingCategory.id);
                      setShowModal(false);
                    }}
                    className="px-4 py-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                  >
                    Eliminar
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
