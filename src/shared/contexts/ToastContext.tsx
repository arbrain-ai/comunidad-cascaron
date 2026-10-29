'use client';

import { createContext, useCallback, useState } from 'react';
import { Toast, ToastContainer, ToastType } from '../components/Toast';

interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastData = { id, type, message };

    setToasts((prev) => {
      // Limitar a MAX_TOASTS, remover el más antiguo si es necesario
      const updated = [...prev, newToast];
      if (updated.length > MAX_TOASTS) {
        return updated.slice(updated.length - MAX_TOASTS);
      }
      return updated;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string) => addToast('success', message),
    [addToast]
  );

  const showError = useCallback(
    (message: string) => addToast('error', message),
    [addToast]
  );

  const showWarning = useCallback(
    (message: string) => addToast('warning', message),
    [addToast]
  );

  const showInfo = useCallback(
    (message: string) => addToast('info', message),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
      {children}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            onClose={removeToast}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}
