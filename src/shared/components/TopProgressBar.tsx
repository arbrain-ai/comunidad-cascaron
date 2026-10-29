'use client';

/**
 * TopProgressBar: barra delgada estilo Linear para route transitions.
 * Renderizada desde app/loading.tsx mientras Suspense resuelve.
 * Sin JS — animacion CSS pura para que aparezca instantaneamente.
 */
export function TopProgressBar() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[9999] h-[2px] overflow-hidden pointer-events-none"
      style={{ background: 'transparent' }}
    >
      <div
        className="h-full"
        style={{
          width: '32%',
          background:
            'linear-gradient(90deg, rgba(139,92,246,0) 0%, var(--primary) 50%, rgba(139,92,246,0) 100%)',
          boxShadow: '0 0 10px rgba(139, 92, 246, 0.55)',
          animation: 'boot-top-progress 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        }}
      />
    </div>
  );
}

export default TopProgressBar;
