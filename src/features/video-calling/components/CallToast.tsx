'use client';

import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'join' | 'leave' | 'info';
}

interface CallToastProps {
  toasts: ToastMessage[];
}

export function CallToast({ toasts }: CallToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-1.5 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Sala v2 (5 sep 2026): sobre un video de colores el toast translucido no se
  // leia. Panel oscuro opaco + una linea de acento por tipo.
  const bgColor = toast.type === 'join'
    ? 'bg-[#141416]/95 border-emerald-400/40 text-emerald-200'
    : toast.type === 'leave'
    ? 'bg-[#141416]/95 border-red-400/40 text-red-200'
    : 'bg-[#141416]/95 border-violet-400/40 text-white';

  return (
    <div
      className={`px-3.5 py-2 rounded-full border text-xs font-medium shadow-2xl backdrop-blur-md transition-all duration-300 ${bgColor} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      {toast.text}
    </div>
  );
}
