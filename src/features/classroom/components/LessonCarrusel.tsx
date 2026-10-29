'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';

/**
 * Carrusel de láminas en el LECTOR de lecciones (`content_format = 'html'`).
 *
 * Hermano de solo-lectura de `CarouselNodeView`, que es el del editor TipTap: mismo gesto
 * (flechas, contador, lightbox, teclado) sin nada de edición ni subida de archivos. Son dos
 * componentes y no uno porque el del editor vive atado a `NodeViewProps` y a los contextos del
 * editor; compartirlo obligaría a arrastrar todo eso al lector para no ganar nada.
 *
 * Las láminas ya vienen validadas (solo https) desde `urlsDeCarrusel`.
 */
export default function LessonCarrusel({ imagenes }: { imagenes: string[] }) {
  const [indice, setIndice] = useState(0);
  const [ampliado, setAmpliado] = useState(false);
  const [montado, setMontado] = useState(false);
  const tiraRef = useRef<HTMLDivElement>(null);

  // El lightbox va por portal al <body>; en SSR no hay document.
  useEffect(() => setMontado(true), []);

  const anterior = useCallback(
    () => setIndice((i) => (i === 0 ? imagenes.length - 1 : i - 1)),
    [imagenes.length]
  );
  const siguiente = useCallback(
    () => setIndice((i) => (i === imagenes.length - 1 ? 0 : i + 1)),
    [imagenes.length]
  );

  // Teclado: solo cuando la lámina está ampliada. Sin el lightbox abierto, las flechas
  // le pertenecen a la página (scroll), no al carrusel.
  useEffect(() => {
    if (!ampliado) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setAmpliado(false); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); anterior(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); siguiente(); }
    };
    window.addEventListener('keydown', onKey);
    // Con el lightbox abierto el fondo no debe scrollear.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [ampliado, anterior, siguiente]);

  // La miniatura activa se trae a la vista sola: con doce láminas, la tira se sale de pantalla.
  useEffect(() => {
    const tira = tiraRef.current;
    const activa = tira?.children[indice] as HTMLElement | undefined;
    if (tira && activa) {
      const centro = activa.offsetLeft - tira.clientWidth / 2 + activa.clientWidth / 2;
      tira.scrollTo({ left: centro, behavior: 'smooth' });
    }
  }, [indice]);

  if (imagenes.length === 0) return null;
  const unaSola = imagenes.length === 1;

  return (
    <div className="lx-carrusel my-8 not-prose">
      <div className="relative rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-border/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagenes[indice]}
          alt={`Lámina ${indice + 1} de ${imagenes.length}`}
          className="w-full h-auto block cursor-zoom-in"
          loading={indice === 0 ? 'eager' : 'lazy'}
          decoding="async"
          onClick={() => setAmpliado(true)}
        />

        <button
          type="button"
          onClick={() => setAmpliado(true)}
          aria-label="Ampliar lámina"
          className="absolute top-3 right-3 p-2 rounded-lg bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 transition-colors"
        >
          <Expand className="w-4 h-4" />
        </button>

        {!unaSola && (
          <>
            <button
              type="button"
              onClick={anterior}
              aria-label="Lámina anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={siguiente}
              aria-label="Lámina siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 border border-white/25 text-white text-xs font-medium backdrop-blur-sm tabular-nums">
              {indice + 1} / {imagenes.length}
            </div>
          </>
        )}
      </div>

      {!unaSola && (
        <div ref={tiraRef} className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
          {imagenes.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ir a la lámina ${i + 1}`}
              aria-current={i === indice}
              className={`flex-shrink-0 w-20 aspect-video rounded-md overflow-hidden border-2 transition-all ${
                i === indice
                  ? 'border-primary opacity-100'
                  : 'border-transparent opacity-50 hover:opacity-90'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      {ampliado && montado && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/92 flex items-center justify-center p-4"
          onClick={() => setAmpliado(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Lámina ampliada"
        >
          <button
            type="button"
            onClick={() => setAmpliado(false)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagenes[indice]}
            alt={`Lámina ${indice + 1} de ${imagenes.length}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {!unaSola && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); anterior(); }}
                aria-label="Lámina anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); siguiente(); }}
                aria-label="Lámina siguiente"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 border border-white/25 text-white text-sm backdrop-blur-sm tabular-nums">
                {indice + 1} / {imagenes.length}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
