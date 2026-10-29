'use client';

// ============================================
// DiagramaMermaid — los agentes dibujan, no describen
// ============================================
// Un agente que explica un grafo con viñetas está describiendo un dibujo con
// palabras. Desde el 31 ago 2026 puede DIBUJARLO: escribe un bloque ```mermaid
// y aquí se convierte en diagrama de verdad.
//
// Tres cosas que este componente resuelve y que no son obvias:
//
// 1. **Streaming.** Mientras la respuesta llega token por token, el bloque está
//    a medias y mermaid lanza excepción en cada keystroke. Por eso hay debounce
//    y por eso un fallo NUNCA rompe la burbuja: cae al código crudo y ya.
// 2. **Peso.** mermaid pesa ~500 KB. Entra por import() dinámico, solo cuando
//    de verdad hay un diagrama en pantalla. Un chat sin diagramas no lo carga.
// 3. **Tema.** Los colores salen de las variables del sistema (Luminorphism:
//    morado + oro), no del tema default de mermaid, que se ve a chatbot de 2021.

import { useEffect, useRef, useState, useId } from 'react';
import { Maximize2, X, AlertTriangle } from 'lucide-react';

type Estado = 'pendiente' | 'listo' | 'error';

let mermaidCargado: Promise<typeof import('mermaid').default> | null = null;

/** Un solo import y una sola inicialización por pestaña. */
function cargarMermaid(oscuro: boolean) {
  if (!mermaidCargado) {
    mermaidCargado = import('mermaid').then((mod) => {
      const m = mod.default;
      const leer = (v: string, fallback: string) => {
        if (typeof window === 'undefined') return fallback;
        const val = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
        return val || fallback;
      };
      const primary = leer('--primary', oscuro ? '#8B5CF6' : '#683ACC');
      const gold = leer('--gold', '#ff9101');
      const fg = leer('--foreground', oscuro ? '#f7f8f8' : '#0f172a');
      const superficie = leer('--card', oscuro ? '#1a1a1e' : '#ffffff');
      const borde = leer('--border', oscuro ? '#27272a' : '#e4e4e7');
      const tenue = leer('--muted', oscuro ? '#a1a1aa' : '#64748b');

      m.initialize({
        startOnLoad: false,
        securityLevel: 'strict', // sin HTML crudo dentro del diagrama
        fontFamily: 'inherit',
        theme: 'base',
        themeVariables: {
          background: 'transparent',
          primaryColor: superficie,
          primaryTextColor: fg,
          primaryBorderColor: primary,
          secondaryColor: superficie,
          secondaryBorderColor: borde,
          tertiaryColor: superficie,
          tertiaryBorderColor: borde,
          lineColor: tenue,
          textColor: fg,
          mainBkg: superficie,
          nodeBorder: primary,
          clusterBkg: 'transparent',
          clusterBorder: borde,
          edgeLabelBackground: superficie,
          // Secuencia / estados / gantt: que hereden la misma paleta
          actorBkg: superficie,
          actorBorder: primary,
          actorTextColor: fg,
          signalColor: tenue,
          signalTextColor: fg,
          labelBoxBkgColor: superficie,
          labelBoxBorderColor: primary,
          labelTextColor: fg,
          noteBkgColor: `color-mix(in srgb, ${gold} 14%, transparent)`,
          noteBorderColor: gold,
          noteTextColor: fg,
        },
        // useMaxWidth:false es deliberado. Con true, un grafo de 8 nodos se
        // comprime hasta que las etiquetas no se leen — un diagrama ilegible es
        // peor que ningún diagrama. Así conserva su tamaño natural y el
        // contenedor hace scroll horizontal; el botón de ampliar hace el resto.
        flowchart: { curve: 'basis', htmlLabels: false, padding: 14, useMaxWidth: false },
        sequence: { useMaxWidth: false },
      });
      return m;
    });
  }
  return mermaidCargado;
}

interface Props {
  /** El contenido del bloque ```mermaid, tal cual. */
  codigo: string;
  /** true mientras la respuesta sigue llegando: se espera a que asiente. */
  streaming?: boolean;
}

export function DiagramaMermaid({ codigo, streaming = false }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>('pendiente');
  const [ampliado, setAmpliado] = useState(false);
  const idBase = useId().replace(/:/g, '');
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    const fuente = codigo.trim();
    if (!fuente) return;

    // Mientras llega texto el diagrama está incompleto: no vale la pena intentar
    // en cada token. Se espera a que el texto deje de moverse.
    const espera = streaming ? 700 : 0;
    const t = setTimeout(async () => {
      try {
        const oscuro = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const m = await cargarMermaid(oscuro);
        await m.parse(fuente); // lanza si la sintaxis está a medias
        const { svg: dibujo } = await m.render(`mmd-${idBase}`, fuente);
        if (!vivo.current) return;
        setSvg(dibujo);
        setEstado('listo');
      } catch {
        if (!vivo.current) return;
        // Durante el streaming un error es normal (el bloque va a medias): se
        // queda en pendiente. Ya cerrado, sí es un diagrama mal escrito.
        setEstado(streaming ? 'pendiente' : 'error');
      }
    }, espera);

    return () => clearTimeout(t);
  }, [codigo, streaming, idBase]);

  // Mientras no hay dibujo, se muestra el código: nunca una burbuja vacía.
  if (estado !== 'listo' || !svg) {
    return (
      <div className="my-3 rounded-xl border border-border bg-card/60 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 text-[11px] text-muted-foreground">
          {estado === 'error' ? (
            <><AlertTriangle className="w-3 h-3 text-gold" /> Diagrama con sintaxis inválida — te dejo el código</>
          ) : (
            <><span className="w-3 h-3 rounded-full border border-primary/40 border-t-primary animate-spin" /> Dibujando el diagrama…</>
          )}
        </div>
        <pre className="px-3 py-2 text-xs overflow-x-auto text-muted-foreground"><code>{codigo}</code></pre>
      </div>
    );
  }

  return (
    <>
      <figure className="group/mmd relative my-3 rounded-xl border border-border bg-card/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setAmpliado(true)}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-background/80 backdrop-blur border border-border text-muted-foreground opacity-0 group-hover/mmd:opacity-100 focus-visible:opacity-100 hover:text-primary hover:border-primary/50 transition-all"
          aria-label="Ampliar diagrama"
          title="Ampliar"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <div
          className="overflow-x-auto px-3 py-4 [&_svg]:mx-auto [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </figure>

      {ampliado && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6 animate-in fade-in duration-150"
          onClick={() => setAmpliado(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setAmpliado(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-full max-h-full overflow-auto [&_svg]:max-w-none [&_svg]:h-auto"
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      )}
    </>
  );
}
