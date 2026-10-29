import { useState, useEffect } from 'react';
import { getCategories } from '../services/communityService';
import { getCached, setCached } from '@/shared/lib/queryCache';
import { Category } from '../types';

const KEY = 'community:categories';

export function useCategories() {
  // Caché de módulo: al volver a la página las categorías pintan al instante
  // y se revalidan en silencio (las categorías casi nunca cambian).
  const initial = getCached<Category[]>(KEY);
  const [categories, setCategories] = useState<Category[]>(initial?.data ?? []);
  const [isLoading, setIsLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const entry = getCached<Category[]>(KEY);
    if (entry) {
      setCategories(entry.data);
      setIsLoading(false);
      if (!entry.isStale) return; // frescas: cero red
    }

    let alive = true;
    const fetchCategories = async () => {
      try {
        if (!entry) setIsLoading(true);
        setError(null);
        const data = await getCategories();
        if (!alive) return;
        setCached(KEY, data);
        setCategories(data);
      } catch (err) {
        console.error('Error fetching categories:', err);
        if (alive && !entry) setError('Error al cargar las categorías');
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    fetchCategories();
    return () => {
      alive = false;
    };
  }, []);

  return {
    categories,
    isLoading,
    error,
  };
}
