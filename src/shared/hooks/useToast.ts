import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

/**
 * Hook para usar el sistema de toasts
 *
 * @example
 * ```tsx
 * const { showSuccess, showError } = useToast();
 *
 * // Antes:
 * alert('Error al eliminar');
 *
 * // Después:
 * showError('Error al eliminar');
 * ```
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
