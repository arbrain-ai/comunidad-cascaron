'use client';

import { useEffect } from 'react';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AuthLayout Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="glass-card p-8 rounded-2xl max-w-md text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          Error de autenticacion
        </h2>
        <p className="text-muted text-sm">
          Ocurrio un problema. Puedes intentar de nuevo o ir al login.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary text-sm"
          >
            Intentar de nuevo
          </button>
          <a
            href="/login"
            className="btn-secondary text-sm"
          >
            Ir al login
          </a>
        </div>
      </div>
    </div>
  );
}
