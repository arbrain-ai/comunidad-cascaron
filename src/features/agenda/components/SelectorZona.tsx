'use client';
import { useState } from 'react';
import { Globe, Check } from '@phosphor-icons/react/dist/ssr';
import { etiquetaCortaZona, nombreDeZona } from '../lib/tiempo';

// Zonas sugeridas en el selector. Ajustalas a donde vive tu comunidad.
const ZONAS = [
  'America/Mexico_City', 'Europe/Madrid', 'America/Bogota',
  'America/Argentina/Buenos_Aires', 'America/New_York', 'America/Los_Angeles',
  'America/Santiago', 'America/Lima', 'America/Asuncion',
];

export function SelectorZona({ zona, onCambiar }: { zona: string; onCambiar: (z: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const lista = ZONAS.includes(zona) ? ZONAS : [zona, ...ZONAS];

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[12.5px] text-muted
                   transition-colors hover:bg-card/60 hover:text-foreground"
        title="Las horas se muestran en esta zona"
      >
        <Globe size={14} weight="duotone" />
        <span className="hidden md:inline">{nombreDeZona(zona)}</span>
        <span className="tabular-nums opacity-70">{etiquetaCortaZona(zona)}</span>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-50 mt-1 w-60 rounded-xl border border-border/60
                          bg-surface-elevated shadow-xl overflow-hidden py-1">
            <p className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted/70">
              Ver las horas en
            </p>
            {lista.map((z) => (
              <button
                key={z}
                onClick={() => { onCambiar(z); setAbierto(false); }}
                className="flex w-full items-center justify-between px-3 py-2 text-[13px]
                           hover:bg-card/70 transition-colors"
              >
                <span className={z === zona ? 'text-primary font-medium' : 'text-foreground'}>
                  {nombreDeZona(z)}
                </span>
                <span className="flex items-center gap-2 text-muted tabular-nums text-xs">
                  {etiquetaCortaZona(z)}
                  {z === zona && <Check size={13} weight="bold" className="text-primary" />}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
