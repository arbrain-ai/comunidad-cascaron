'use client';

/**
 * CierreLeccion — el pie de toda lección.
 *
 * La conversación se manda a la COMUNIDAD con el post ya armado (título + enlace de regreso a
 * la lección), donde todos la ven; y un "me encanta" del curso con conteo y caras.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircleQuestion, Sparkles } from 'lucide-react';

interface Props {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
}

interface Loves { total: number; mio: boolean; caras: { id: string; name: string; avatar: string | null }[] }

export function CierreLeccion({ courseId, courseTitle, lessonId, lessonTitle }: Props) {
  const [loves, setLoves] = useState<Loves | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/course-loves?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) setLoves(d); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [courseId]);

  const alternar = useCallback(async () => {
    if (enviando) return;
    setEnviando(true);
    // optimista: la señal se ve al instante, el servidor confirma
    setLoves((l) => (l ? { ...l, mio: !l.mio, total: l.total + (l.mio ? -1 : 1) } : l));
    try {
      const r = await fetch('/api/course-loves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId }) });
      if (r.ok) setLoves(await r.json());
    } finally {
      setEnviando(false);
    }
  }, [courseId, enviando]);

  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/classroom/${courseId}?lesson=${lessonId}` : `/classroom/${courseId}?lesson=${lessonId}`;
  const cuerpo = (intro: string) => `<p>${intro}</p><p></p><p><a href="${enlace}">${courseTitle} · ${lessonTitle}</a></p>`;
  const post = (categoria: string, titulo: string, intro: string) =>
    `/community?create=true&category=${categoria}&titulo=${encodeURIComponent(titulo)}&cuerpo=${encodeURIComponent(cuerpo(intro))}`;

  return (
    <section className="mt-6 md:mt-8 solid-card p-5 md:p-7" aria-label="Cierre de la lección">
      {/* solid-card + btn-primary/btn-secondary, corazón SOLO icono, cero texto de relleno. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg md:text-xl font-bold text-foreground">¿Qué aprendiste? Cuéntalo donde todos lo vean</h3>
        <button
          type="button"
          onClick={alternar}
          disabled={!loves || enviando}
          aria-pressed={!!loves?.mio}
          aria-label={loves?.mio ? 'Quitar me encanta del curso' : 'Me encanta este curso'}
          title={loves?.mio ? 'Te encanta este curso' : 'Me encanta este curso'}
          className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all duration-fast shadow-elevation-xs hover:-translate-y-0.5 hover:shadow-elevation-md active:translate-y-0 ${
            loves?.mio
              ? 'bg-rose-500/15 border-rose-400/60 text-rose-400'
              : 'bg-surface border-border text-muted hover:text-rose-400 hover:border-rose-400/50'
          }`}
        >
          <Heart className={`w-5 h-5 ${loves?.mio ? 'fill-current' : ''}`} />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={post('logros', `Aprendí en ${courseTitle}: ${lessonTitle}`, 'Lo que me llevo de esta lección y qué me gustó:')} className="btn-primary">
          <Sparkles className="w-4 h-4" /> Cuenta qué aprendiste
        </Link>
        <Link href={post('ayuda', `Pregunta sobre ${courseTitle}: ${lessonTitle}`, 'Mi pregunta:')} className="btn-secondary">
          <MessageCircleQuestion className="w-4 h-4" /> Haz una pregunta
        </Link>
      </div>
      {loves && loves.caras.length > 0 && (
        <div className="mt-5 flex items-center gap-2" aria-label="Personas a las que les encanta este curso">
          <div className="flex -space-x-2">
            {loves.caras.slice(0, 8).map((c) => (
              c.avatar
                ? <img key={c.id} src={c.avatar} alt={c.name} title={c.name} className="w-7 h-7 rounded-full border-2 border-background object-cover" />
                : <span key={c.id} title={c.name} className="w-7 h-7 rounded-full border-2 border-background bg-primary/30 text-3xs flex items-center justify-center text-foreground">{(c.name || '?').slice(0, 1)}</span>
            ))}
          </div>
          <span className="text-xs text-muted">{loves.total === 1 ? 'a 1 persona le encanta' : `a ${loves.total} personas les encanta`}</span>
        </div>
      )}
    </section>
  );
}
