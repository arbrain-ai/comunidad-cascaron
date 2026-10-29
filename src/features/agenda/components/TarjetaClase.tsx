'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRinging, Lock, VideoCamera, Play } from '@phosphor-icons/react/dist/ssr';
import type { Clase } from '../types';
import { BRAND } from '@/shared/config/brand';
import { rangoHorario, etiquetaCortaZona, faltan } from '../lib/tiempo';
import { leerReloj, cadenciaTick } from '../lib/estado';
import { useGlobo } from '@/shared/hooks/useGlobo';

/** La descripcion viene del editor y puede traer HTML. En la tarjeta se
 *  muestra como TEXTO: nada de dangerouslySetInnerHTML en una lista. */
function textoPlano(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
             .replace(/\s+/g, ' ').trim();
}

interface Props {
  clase: Clase;
  zona: string;
  bloqueada?: boolean;
  onAbrir: () => void;
  onEntrar: () => void;
  onRecordar: (on: boolean) => void;
}

/**
 * LA TARJETA — Titaniumorphism, la piel de la casa.
 *
 * Viste el MISMO sistema que la tarjeta de la comunidad, no una piel propia:
 *  · normal  → `card-spotlight` (piel + globo morado que sigue al cursor,
 *              rim light, depth-anchor, lift de -3px en hover).
 *  · EN VIVO → `es-vivo-fondo` + `globo`. Regla de ley.css §13: el ámbar YA
 *              trae piel, y card-spotlight la pisaría; `.globo` es solo la
 *              capa de luz y convive. Y la ley del ámbar se cumple al pie:
 *              "si no puedes decir en voz alta 'esto está pasando', no es
 *              ámbar" — una clase en vivo es exactamente eso.
 *
 * Handlers del globo: `useGlobo` (RAF-throttled), compartido con el
 * leaderboard y el feed. Cero duplicación.
 *
 * Reglas heredadas del diagnóstico del calendario viejo: el título NUNCA se
 * corta (13 de 20 tarjetas viejas venían clipeadas), la hora SIEMPRE lleva
 * zona, y nada es decorativo (el "+N más" viejo no tenía onClick).
 */
export function TarjetaClase({ clase, zona, bloqueada, onAbrir, onEntrar, onRecordar }: Props) {
  const cancelada = clase.status === 'cancelado';
  const globo = useGlobo<HTMLElement>();
  const salaViva = !!clase.sala_viva;
  const [reloj, setReloj] = useState(() =>
    leerReloj(clase.start_time, clase.duration_minutes, cancelada, Date.now(), salaViva));

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const r = leerReloj(clase.start_time, clase.duration_minutes, cancelada, Date.now(), salaViva);
      setReloj(r);
      t = setTimeout(tick, cadenciaTick(r));
    };
    tick();
    return () => clearTimeout(t);
  }, [clase.start_time, clase.duration_minutes, cancelada, salaViva]);

  const enVivo = reloj.estado === 'en_vivo';
  const anfitrion = clase.anfitrion;

  /** UNA acción, la que toca según el reloj. */
  const accion = () => {
    if (bloqueada) return (
      <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold uppercase tracking-wide es-tuyo">
        <Lock size={11} weight="fill" /> Nivel {clase.required_level}
      </span>
    );
    if (cancelada) return null;
    if (reloj.puedeEntrar) return (
      <button onClick={onEntrar} className="btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs !rounded-lg">
        <VideoCamera size={14} weight="fill" />
        {enVivo ? 'Entrar' : `Entrar · ${faltan(reloj.msAlInicio)}`}
      </button>
    );
    if (reloj.estado === 'terminado') return clase.grabacion_url ? (
      <a href={clase.grabacion_url} target="_blank" rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover">
        <Play size={12} weight="fill" /> Grabación
      </a>
    ) : (
      <span className="shrink-0 text-xs text-muted/60">Grabación en camino</span>
    );
    return (
      <button onClick={() => onRecordar(!clase.recordatorio)} aria-pressed={!!clase.recordatorio}
        title={clase.recordatorio ? 'Te avisamos 15 min antes' : 'Recordarme 15 min antes'}
        className={`icon-btn inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors
          ${clase.recordatorio
            ? 'border-primary/45 bg-primary/12 text-primary'
            : 'border-glass text-muted hover:text-foreground'}`}>
        {clase.recordatorio
          ? <><BellRinging size={12} weight="fill" /> Te aviso</>
          : <><Bell size={12} weight="regular" /> Recordar</>}
      </button>
    );
  };

  return (
    <article
      ref={globo.ref}
      onClick={onAbrir}
      onMouseMove={globo.onMouseMove}
      onMouseEnter={globo.onMouseEnter}
      onMouseLeave={globo.onMouseLeave}
      className={`relative cursor-pointer overflow-hidden rounded-xl
        ${enVivo ? 'es-vivo-fondo globo border' : 'card-spotlight'}
        ${cancelada ? 'opacity-55' : ''}`}
    >
      {/* DOS FORMAS, no dos tamaños (2 sep 2026). En móvil la portada va ARRIBA
          a todo el ancho, como el banner que es; ponerla al lado dejaba 150 px
          para el texto y el nombre del anfitrión se cortaba a una letra ("I..").
          En escritorio sí va al lado, que es donde sobra ancho. */}
      <div className="relative z-10 flex flex-col gap-2.5 p-2.5 sm:flex-row sm:gap-4 sm:p-3.5">
        {/* Portada 16:9, NO cuadrada: las portadas son banners y un
            marco cuadrado les partía el texto por los dos lados.
            2 sep 2026: al DOBLE de alto (46→92 móvil, 56→112 escritorio). A
            56 px la portada era una miniatura ilegible dentro de una tarjeta
            con medio ancho vacío; ahora el banner se lee. */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-surface/60 ring-1 ring-white/5 sm:h-[112px] sm:w-auto">
          {clase.cover_image_url ? (
            <img src={clase.cover_image_url} alt=""
                 className={`h-full w-full object-cover ${bloqueada ? 'opacity-50 saturate-50' : ''}`}
                 loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-primary/10">
              <VideoCamera size={30} weight="duotone" className="text-primary/60" />
            </div>
          )}
          {bloqueada && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[1px]">
              <Lock size={20} weight="fill" className="text-gold" />
            </div>
          )}
        </div>

        {/* min-w-0 es lo que permite que el título fluya sin empujar la caja. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {/* 1 · el reloj, con su zona SIEMPRE visible */}
          <div className="flex items-center gap-2 text-xs leading-4">
            {enVivo ? (
              <span className="es-vivo inline-flex items-center gap-1.5 font-bold uppercase tracking-wide">
                <span className="relative flex h-[7px] w-[7px]">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                  <span className="es-vivo-punto relative inline-flex h-[7px] w-[7px] rounded-full" />
                </span>
                En vivo
              </span>
            ) : cancelada ? (
              <span className="font-medium text-error">Cancelada</span>
            ) : (
              <span className="tabular-nums text-muted">
                {rangoHorario(clase.start_time, clase.duration_minutes, zona)}
                <span className="ml-1 opacity-55">{etiquetaCortaZona(zona)}</span>
              </span>
            )}
          </div>

          {/* 2 · EL TÍTULO. Fluye a las líneas que necesite. Cero clamp. */}
          <h3 className={`text-[16px] font-semibold leading-[1.28] text-foreground sm:text-[17.5px]
            ${cancelada ? 'line-through decoration-1' : ''}`}>
            {clase.title}
          </h3>

          {/* 2b · DE QUÉ VA. Dos líneas como máximo: la tarjeta informa, el
              detalle explica. Se oculta en pantallas muy angostas para no
              empujar la acción fuera de la vista. */}
          {textoPlano(clase.description) && (
            /* max-w en CARACTERES: a 1232 px de tarjeta la descripción daba
               líneas de ~160 caracteres, que nadie lee. 78ch es el ancho de
               lectura, no un número redondo de píxeles. */
            <p className="max-w-[78ch] text-[13px] leading-[1.45] text-muted line-clamp-2">
              {textoPlano(clase.description)}
            </p>
          )}

          {/* 3 · quién la da + la acción, en el MISMO renglón */}
          <div className="mt-0.5 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
            <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
              {anfitrion?.avatar_url && (
                <img src={anfitrion.avatar_url} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/10" />
              )}
              <span className="truncate">{anfitrion?.full_name ?? BRAND.shortName}</span>
            </span>
            {accion()}
          </div>
        </div>
      </div>
    </article>
  );
}
