'use client';

import { CalendarBlank } from '@phosphor-icons/react/dist/ssr';
import type { Clase, DiaAgenda } from '../types';
import { TarjetaClase } from './TarjetaClase';
import { capitalizarFrase } from '../lib/tiempo';

interface Props {
  dias: DiaAgenda[];
  zona: string;
  estaBloqueada: (c: Clase) => boolean;
  onAbrir: (c: Clase) => void;
  onEntrar: (c: Clase) => void;
  onRecordar: (c: Clase, on: boolean) => void;
}

/**
 * LA AGENDA — la vista por defecto, igual en movil y escritorio.
 *
 * El calendario viejo era una grilla de 42 celdas para mostrar 1-2 eventos por
 * dia: 90% ruido. Y en movil pintaba SOLO puntitos, con el 55% de la pantalla
 * en negro porque nada seleccionaba el dia de hoy al cargar.
 *
 * lu.ma (el referente) no cambia de layout entre movil y escritorio: es la
 * misma columna unica centrada. Esa es la leccion que copiamos.
 */
export function Agenda({ dias, zona, estaBloqueada, onAbrir, onEntrar, onRecordar }: Props) {
  if (dias.length === 0) {
    return (
      <div className="sup flex flex-col items-center gap-3 px-6 py-14 text-center">
        <CalendarBlank size={30} weight="duotone" className="text-muted/60" />
        <p className="text-sm text-muted">No hay clases agendadas todavía.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {dias.map((dia) => (
        <section key={dia.clave} className="flex flex-col gap-1.5">
          {/* Cabecera del dia: UNA linea calmada. Pegajosa, para que al hacer
              scroll siempre sepas que dia estas leyendo. */}
          <header className="sticky top-0 z-10 -mx-1 flex items-baseline gap-2 bg-background/90 px-1 pb-1.5 pt-2 backdrop-blur-sm">
            <h2 className={`text-[13.5px] font-semibold ${dia.esHoy ? 'text-primary' : 'text-foreground'}`}>
              {capitalizarFrase(dia.titulo)}
            </h2>
            {/* La fecha larga SOLO acompaña a un titulo relativo. Con "sábado 5
                de septiembre" de titulo, repetirla era decir dos veces lo mismo. */}
            {dia.relativo && (
              <span className="text-[12.5px] text-muted/65">
                {capitalizarFrase(
                  new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })
                    .format(new Date(`${dia.clave}T12:00:00`)).replace(/\.$/, '')
                )}
              </span>
            )}
          </header>

          {dia.clases.map((c) => (
            <TarjetaClase
              key={c.id}
              clase={c}
              zona={zona}
              bloqueada={estaBloqueada(c)}
              onAbrir={() => onAbrir(c)}
              onEntrar={() => onEntrar(c)}
              onRecordar={(on) => onRecordar(c, on)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
