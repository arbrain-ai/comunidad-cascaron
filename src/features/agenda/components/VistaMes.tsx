'use client';

import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import { formatInTimeZone } from 'date-fns-tz';
import type { Clase } from '../types';
import { claveDia, hora, etiquetaCortaZona, capitalizarFrase } from '../lib/tiempo';
import { TarjetaClase } from './TarjetaClase';

interface Props {
  clases: Clase[];
  zona: string;
  onAbrir: (c: Clase) => void;
  /** el candado de nivel, la MISMA regla que aplica la puerta de la sala */
  estaBloqueada?: (c: Clase) => boolean;
  onEntrar?: (c: Clase) => void;
  onRecordar?: (c: Clase, on: boolean) => void;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * EL MES — vista SECUNDARIA (panoramica), no la principal.
 *
 * Aqui morian dos defectos del calendario viejo y no pueden volver:
 *  · el boton "+N mas" no tenia onClick: del 4º evento en adelante eran
 *    INALCANZABLES en escritorio. Aqui el dia SIEMPRE se puede abrir y sus
 *    clases se listan completas abajo, en movil y en escritorio.
 *  · las filas brincaban 100→133→205px segun cuantos eventos cayeran. Aqui la
 *    celda tiene ALTURA FIJA y adentro van puntos, no texto que se corta.
 */
export function VistaMes({ clases, zona, onAbrir, estaBloqueada, onEntrar, onRecordar }: Props) {
  const hoyClave = formatInTimeZone(new Date(), zona, 'yyyy-MM-dd');
  const [ancla, setAncla] = useState(() => new Date());
  const [sel, setSel] = useState<string>(hoyClave);

  const porDia = useMemo(() => {
    const m = new Map<string, Clase[]>();
    for (const c of clases) {
      const k = claveDia(c.start_time, zona);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    for (const v of m.values()) v.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return m;
  }, [clases, zona]);

  const { celdas, etiqueta } = useMemo(() => {
    const y = ancla.getFullYear(), mo = ancla.getMonth();
    const primero = new Date(y, mo, 1);
    // lunes como primer dia
    const off = (primero.getDay() + 6) % 7;
    const inicio = new Date(y, mo, 1 - off);
    const out: { clave: string; dia: number; delMes: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ clave, dia: d.getDate(), delMes: d.getMonth() === mo });
    }
    return {
      celdas: out,
      etiqueta: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(primero),
    };
  }, [ancla]);

  const delDia = porDia.get(sel) ?? [];
  /** la primera clase de un dia, para pintar su hora en la celda del mes */
  const primeraDelDia = (clave: string) => porDia.get(clave)?.[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-foreground">{capitalizarFrase(etiqueta)}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() - 1, 1))}
            aria-label="Mes anterior"
            className="rounded-lg p-1.5 text-muted hover:bg-card/60 hover:text-foreground transition-colors">
            <CaretLeft size={16} weight="bold" />
          </button>
          <button onClick={() => setAncla(new Date())}
            className="rounded-lg px-2.5 py-1 text-[13px] text-muted hover:bg-card/60 hover:text-foreground transition-colors">
            Hoy
          </button>
          <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1))}
            aria-label="Mes siguiente"
            className="rounded-lg p-1.5 text-muted hover:bg-card/60 hover:text-foreground transition-colors">
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Marco Titaniumorphism: bisel + pantalla. Es el mismo envoltorio que
          usaba el calendario viejo — de un trabajo anterior se reusa el
          OFICIO, aunque la materia (la grilla de adentro) sea nueva. */}
      <div className="titanium-bezel">
      <div className="titanium-screen overflow-hidden">
        <div className="grid grid-cols-7 bg-surface/30">
          {DIAS.map((d) => (
            <div key={d} className="border-b border-glass py-2 text-center text-2xs font-medium uppercase tracking-wide text-muted/70">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((c) => {
            const n = porDia.get(c.clave)?.length ?? 0;
            const esHoy = c.clave === hoyClave;
            const activo = c.clave === sel;
            return (
              <button
                key={c.clave}
                onClick={() => setSel(c.clave)}
                /* ALTURA FIJA: la fila jamas brinca por cuantos eventos caigan.
                   Ese invariante viene del calendario viejo, donde las filas
                   saltaban 100→133→205 px segun lo que cayera ese dia. Lo que
                   se agrega debajo va DENTRO de la altura, nunca la estira. */
                className={`relative h-[54px] border-b border-r border-glass last-of-type:border-r-0
                  flex flex-col items-center justify-center gap-0.5 px-1 transition-colors sm:h-[78px]
                  ${!c.delMes ? 'opacity-35' : ''} ${activo ? 'bg-primary/10' : 'hover:bg-card/50'}`}
              >
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[13px] tabular-nums
                  ${esHoy ? 'bg-primary font-semibold text-white' : activo ? 'font-semibold text-primary' : 'text-foreground'}`}>
                  {c.dia}
                </span>

                {/* MOVIL: puntos. No hay ancho para texto y un titulo truncado a
                    4 letras no informa, estorba. */}
                {n > 0 && (
                  <span className="flex items-center gap-[3px] sm:hidden">
                    {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-primary" />
                    ))}
                    {n > 3 && <span className="text-[9px] font-semibold leading-none text-primary">{n}</span>}
                  </span>
                )}

                {/* ESCRITORIO: la HORA de la primera clase. Un punto morado
                    identico en todos los dias no dice nada y obliga a clickear
                    dia por dia para averiguar que pasa. La hora sí distingue, y
                    cabe en una linea sin tocar la altura de la celda. */}
                {n > 0 && (
                  <span className="hidden w-full flex-col items-center gap-px sm:flex">
                    <span className="w-full truncate text-center text-[10.5px] font-medium leading-tight tabular-nums text-primary">
                      {hora(primeraDelDia(c.clave)!.start_time, zona)}
                    </span>
                    {n > 1 && (
                      <span className="text-[9.5px] leading-none text-muted/70">+{n - 1} más</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {/* El dia elegido, COMPLETO. Ningun evento queda inalcanzable, nunca. */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-medium text-muted">
          {capitalizarFrase(
            new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
              .format(new Date(`${sel}T12:00:00`)))}
          <span className="ml-1.5 opacity-60">{etiquetaCortaZona(zona)}</span>
        </h3>
        {delDia.length === 0 ? (
          <p className="sup px-4 py-6 text-center text-[13px] text-muted/70">
            Sin clases este día
          </p>
        ) : (
          /* LA MISMA TARJETA QUE LA AGENDA (2 sep 2026). Antes esto era una tira
             de una línea —hora + título— y no se parecía en nada a lo que el
             miembro acababa de ver en la otra pestaña. Reusar el componente da
             portada, descripción, anfitrión y la acción del reloj gratis, y hace
             imposible que las dos vistas se separen con el tiempo. */
          delDia.map((c) => (
            <TarjetaClase
              key={c.id}
              clase={c}
              zona={zona}
              bloqueada={estaBloqueada?.(c)}
              onAbrir={() => onAbrir(c)}
              onEntrar={() => onEntrar?.(c)}
              onRecordar={(on) => onRecordar?.(c, on)}
            />
          ))
        )}
      </div>
    </div>
  );
}
