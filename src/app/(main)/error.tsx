'use client';

import { useEffect, useState } from 'react';
import { isChunkLoadError, recoverFromChunkError } from '@/shared/lib/chunkErrorRecovery';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Un chunk de un deploy anterior NO es "algo salió mal": es una versión nueva
  // publicada mientras la pestaña seguía abierta. Merece su propio mensaje y su
  // propio botón, porque "Intentar de nuevo" (reset) vuelve a montar el MISMO
  // bundle roto y no arregla nada (y si la recarga automática ya se gastó, el
  // cooldown de 60 s dejaría al usuario en una pantalla sin salida).
  const [esChunk, setEsChunk] = useState(false);

  useEffect(() => {
    console.error('[MainLayout Error]', error);
    if (isChunkLoadError(String(error?.message || ''))) {
      setEsChunk(true);
      // Si el cooldown ya se gastó, esto no recarga y devuelve false: entonces
      // manda el mensaje de abajo y el usuario recarga con un clic.
      recoverFromChunkError('error-boundary');
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="glass-card p-8 rounded-2xl max-w-md text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          {esChunk ? 'Hay una versión nueva' : 'Algo salio mal'}
        </h2>
        <p className="text-muted text-sm">
          {esChunk
            ? 'Se publicó una actualización mientras tenías esta página abierta. Recarga para tomarla; no perdiste nada.'
            : 'Ocurrio un error inesperado. Puedes intentar de nuevo o volver al inicio.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              // En un chunk error, `reset` re-monta el mismo bundle que ya falló.
              // Lo único que sirve es pedirle al servidor el HTML del build vivo.
              if (esChunk) window.location.reload();
              else reset();
            }}
            className="btn-primary text-sm"
          >
            {esChunk ? 'Recargar' : 'Intentar de nuevo'}
          </button>
          <a
            href="/community"
            className="btn-secondary text-sm"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
