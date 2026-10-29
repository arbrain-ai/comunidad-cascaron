'use client';

// ============================================
// SALA - mover la clase a otro link
// ============================================
// Cuando el ponente tiene que mudarse, pega el link UNA vez y quien esté dentro
// o llegue tarde a la sala original ve el aviso con el link.

import { useEffect, useState } from 'react';
import { ArrowRightLeft, ExternalLink, X } from 'lucide-react';
import { validarMudanza, type Mudanza } from './mudanzaPolicy';

/** Everyone sees where the class went; the host can withdraw it. */
export function AvisoMudanza({ mudanza, gobierna, onQuitar, onVista }: {
  mudanza: Mudanza;
  gobierna: boolean;
  onQuitar?: () => void;
  onVista?: () => void;
}) {
  useEffect(() => { onVista?.(); }, [mudanza.at, onVista]);
  return (
    <div role="alert" className="mx-2 md:mx-4 mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-2xl border border-amber-300/40 bg-amber-400/15 px-4 py-3 text-amber-50" data-testid="aviso-mudanza">
      <ArrowRightLeft className="hidden sm:block w-5 h-5 flex-shrink-0 text-amber-200" />
      <p className="text-sm leading-snug flex-1">
        {gobierna
          ? <>Moviste la clase a <b>{mudanza.host}</b>. Quien entre aquí verá este aviso con el link.</>
          : <><b>La clase se cambió de sala.</b> Continúa en {mudanza.host}.</>}
      </p>
      <div className="flex items-center gap-2">
        <a href={mudanza.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 min-h-10 px-4 rounded-xl bg-amber-300 text-black text-sm font-bold hover:bg-amber-200" data-testid="ir-a-nueva-sala">
          Ir a la nueva sala<ExternalLink className="w-4 h-4" />
        </a>
        {gobierna && onQuitar && (
          <button onClick={onQuitar} className="min-h-10 px-3 rounded-xl border border-amber-200/40 text-amber-100 text-sm hover:bg-amber-300/10" data-testid="quitar-mudanza">Quitar aviso</button>
        )}
      </div>
    </div>
  );
}

/** The host pastes the new link once. Validation mirrors the server's allowlist. */
export function MoverClase({ onMover, onCerrar }: {
  onMover: (url: string) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCerrar]);
  const enviar = async () => {
    const v = validarMudanza(url);
    if (!v.ok) { setError(v.error); return; }
    setOcupado(true);
    const fallo = await onMover(v.url);
    setOcupado(false);
    if (fallo) setError(fallo); else onCerrar();
  };
  return (
    <div className="fixed inset-0 z-[80] bg-black/65 flex items-end sm:items-center justify-center p-3" onClick={onCerrar} data-testid="mover-clase">
      <div role="dialog" aria-modal="true" aria-labelledby="mover-clase-titulo" className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1a1a1e] p-5 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onCerrar} className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-white/10 text-white/60 flex items-center justify-center" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        <h2 id="mover-clase-titulo" className="text-lg font-semibold text-white flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" />Mover la clase a otro link</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">Todos los que están aquí, y quien llegue tarde, verán un aviso con el link nuevo. Esta sala sigue abierta.</p>
        <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="mt-4 flex flex-col gap-2">
          <label htmlFor="mover-clase-url" className="text-xs text-white/60">Link de la nueva sala (Meet, Zoom, Teams…)</label>
          <input id="mover-clase-url" autoFocus value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} placeholder="https://meet.google.com/abc-defg-hij" inputMode="url" className="min-h-11 rounded-xl bg-white/5 border border-white/15 px-3 text-white text-sm focus:outline-none focus:border-[var(--primary)]" data-testid="mover-clase-url" />
          {error && <p role="alert" className="text-sm text-red-300" data-testid="mover-clase-error">{error}</p>}
          <button type="submit" disabled={ocupado} className="mt-2 min-h-11 rounded-xl bg-amber-300 text-black text-sm font-bold disabled:opacity-50" data-testid="mover-clase-confirmar">{ocupado ? 'Avisando…' : 'Avisar a todos'}</button>
        </form>
      </div>
    </div>
  );
}
