'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { splitLessonContent, type LessonVideoPlatform } from '../utils/sanitizeLesson';
import { selfVideoEmbedUrl } from '@/shared/utils/selfVideo';
import { fitLessonVideo } from '../utils/fitLessonVideo';
import LessonCapsule from './LessonCapsule';
import LessonCarrusel from './LessonCarrusel';

const NARRADOR_MIN = 400;
const NARRADOR_MAX = 6000;

/**
 * Lección narrada: página propia de `public/curso-<curso>/l/<slug>/`.
 *
 * Mismo origen a propósito (ver nota en sanitizeLesson.ts): si la página usa
 * WebGL, sus texturas exigirían CORS desde un origen opaco. Además, el mismo
 * origen deja que los assets pesados se cacheen UNA vez para todas las lecciones.
 *
 * La altura la REPORTA la página, no la adivina la base: depende del ancho, de
 * si hay lámina y de si hay prueba de fuego. Veinte números fijos en `content`
 * se pudren al primer cambio de tipografía.
 */
/** Carpeta del curso bajo `public/curso-<carpeta>/`. El marcador solo admite `[a-z0-9-]{3,40}`
 *  (regex de sanitizeLesson), así que el nombre no puede salirse de `public/curso-*`.
 *  Sin curso → `public/curso-default/`. */
function LessonNarrador({ slug, alto, curso, lleno }: { slug: string; alto?: number; curso?: string; lleno?: boolean }) {
  const carpeta = curso && /^[a-z0-9-]{3,40}$/.test(curso) ? curso : 'default';
  const ref = useRef<HTMLIFrameElement>(null);
  const [altura, setAltura] = useState(() =>
    Math.min(NARRADOR_MAX, Math.max(NARRADOR_MIN, alto ?? 1800))
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Solo del contentWindow de ESTE frame: si no, cualquier otro iframe de la
      // página podría redimensionar este.
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const d = e.data as { __lx?: string; h?: unknown } | null;
      if (d?.__lx === 'alto-narrador' && typeof d.h === 'number' && Number.isFinite(d.h)) {
        setAltura(Math.min(NARRADOR_MAX, Math.max(NARRADOR_MIN, Math.ceil(d.h))));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /**
   * PUENTE DE VENTANA — por qué existe.
   *
   * El frame crece hasta el alto de la lección, así que NO tiene scroll propio:
   * el que scrollea es el contenedor del Classroom. Dentro de ese documento,
   * `position: sticky` no encuentra contenedor al que pegarse y `fixed` se ancla
   * al documento entero, o sea se queda arriba. Resultado sin este puente: el
   * narrador clavado en el tope y el transporte en el fondo.
   *
   * El único que sabe dónde está la ventana es este lado. Se le manda al frame
   * dónde empieza su franja visible y cuánto mide, y él planta ahí el riel.
   */
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    let pendiente = 0;
    const avisar = () => {
      const win = frame.contentWindow;
      if (!win) return;
      const r = frame.getBoundingClientRect();
      const vh = window.innerHeight;
      // Franja del frame que de verdad se ve, en coordenadas DEL FRAME.
      const top = Math.max(0, -r.top);
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (h > 0) win.postMessage({ __lx: 'ventana', top, h }, '*');
    };
    // rAF y no el evento pelado: el scroll dispara decenas de veces por segundo
    // y mover el riel más de una vez por fotograma no se ve, solo cuesta.
    const enScroll = () => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => { pendiente = 0; avisar(); });
    };

    // El contenedor que scrollea puede ser un div del Classroom, no la ventana:
    // se escucha en captura para atrapar el scroll de cualquier ancestro.
    window.addEventListener('scroll', enScroll, { passive: true, capture: true });
    window.addEventListener('resize', enScroll, { passive: true });
    frame.addEventListener('load', avisar);
    const t = setInterval(avisar, 500); // red de seguridad: layout que se mueve solo
    avisar();

    return () => {
      window.removeEventListener('scroll', enScroll, { capture: true });
      window.removeEventListener('resize', enScroll);
      frame.removeEventListener('load', avisar);
      clearInterval(t);
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, []);

  return (
    <div className={`lx-narrador${lleno ? ' lx-narrador--lleno' : ''}`}>
      <iframe
        ref={ref}
        // `index.html` EXPLÍCITO: Next no resuelve el índice de un directorio de
        // `public/`. La URL con barra final se 308-ea a la versión sin barra y de
        // ahí cae al 404 de la app. Un `python -m http.server` sí sirve el índice,
        // así que esto solo aparece probando dentro del producto.
        src={`/curso-${carpeta}/l/${encodeURIComponent(slug)}/index.html`}
        title="Lección narrada"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        onLoad={(event) => fitLessonVideo(event.currentTarget)}
        // Modo LLENO (cursos v2, `data-lx-curso`): el marco ocupa la ventana visible y la
        // página scrollea ADENTRO (sus fijos —píldora, índice, tema— quedan en su sitio).
        // La altura la pone el CSS (.lx-narrador--lleno), no el puente de altura.
        style={lleno ? undefined : { height: altura }}
      />
    </div>
  );
}

/**
 * La URL del video se CONSTRUYE desde una plantilla fija por plataforma.
 * Nunca se toma una URL del contenido: así el host está en whitelist por
 * construcción y ningún contenido puede apuntar el iframe a un tercero.
 */
function videoEmbedUrl(id: string, platform: LessonVideoPlatform): string {
  // `enablejsapi=1` es lo único que habilita `seekTo` por postMessage: sin él, un
  // timestamp de la lección solo puede mandarte a YouTube en otra pestaña.
  return platform === 'youtube'
    ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1`
    : selfVideoEmbedUrl(id);
}

interface LessonAttachment {
  url: string;
  name: string;
  size?: number;
  type?: string;
}

interface LessonHtmlProps {
  /** HTML de la lección (content_format = 'html'). Se sanitiza aquí dentro. */
  content: string;
  /** Adjuntos de la lección; se listan debajo del contenido. */
  attachments?: LessonAttachment[];
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Renderizador de lecciones generadas (content_format = 'html').
 *
 * NO pasa por TipTap: es la segunda vía de render, hermana de LinkedPostEmbed.
 * El contenido se sanitiza con `sanitizeLessonHtml` (config propia, separada de la
 * de posts/comments) y los videos se montan como <iframe> de React a partir de un
 * marcador, nunca como iframe embebido en el HTML.
 */
export default function LessonHtml({ content, attachments = [] }: LessonHtmlProps) {
  const segments = useMemo(() => splitLessonContent(content || ''), [content]);
  const articuloRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLIFrameElement>(null);

  /**
   * TIMESTAMPS QUE SALTAN EN LA MISMA PÁGINA (en vez de mandar a YouTube).
   *
   * El HTML de una lección no puede traer `<script>` (el sanitizador lo prohíbe), así que el
   * lazo se cierra AQUÍ: un `<a data-lx-seek="260">` se intercepta por delegación y se le manda
   * `seekTo` al iframe por postMessage. El `href` a `youtu.be/<id>?t=<seg>` se conserva como
   * RESPALDO: si no hay reproductor en la lección (o el mensaje no llega), el enlace funciona
   * como siempre. Mejora progresiva, nunca un click muerto.
   */
  useEffect(() => {
    const raiz = articuloRef.current;
    if (!raiz) return;
    const alClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[data-lx-seek]') as HTMLAnchorElement | null;
      if (!a) return;
      const segundos = Number(a.dataset.lxSeek);
      const marco = videoRef.current;
      if (!marco?.contentWindow || !Number.isFinite(segundos) || segundos < 0) return; // se va a YouTube
      e.preventDefault();
      marco.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [segundos, true] }),
        'https://www.youtube.com'
      );
      marco.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        'https://www.youtube.com'
      );
      marco.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    raiz.addEventListener('click', alClick);
    return () => raiz.removeEventListener('click', alClick);
  }, [segments]);
  // Lección que es SOLO marcos narrados de un curso v2 (data-lx-curso): el marco es la
  // lección entera → sin columna de lectura (68ch), sin márgenes: ocupa el borde del área.
  const lleno = segments.length > 0 && segments.every(s => s.kind === 'narrador' && !!s.curso);

  return (
    <>
      <article ref={articuloRef} className={`lx-root${lleno ? ' lx-root--lleno' : ''}`}>
        {segments.map((seg, i) =>
          seg.kind === 'video' ? (
            <div className="lx-video" key={`v-${seg.value}-${i}`}>
              <iframe
                ref={seg.platform === 'youtube' ? videoRef : undefined}
                src={videoEmbedUrl(seg.value, seg.platform ?? 'selfhosted')}
                title="Video de la lección"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          ) : seg.kind === 'narrador' ? (
            <LessonNarrador key={`n-${seg.value}-${i}`} slug={seg.value} alto={seg.alto} curso={seg.curso} lleno={lleno} />
          ) : seg.kind === 'capsula' ? (
            // Mecanismo interactivo: iframe sandbox de origen opaco (fase 2)
            <LessonCapsule key={`c-${i}`} payload={seg.value} alto={seg.alto} />
          ) : seg.kind === 'carrusel' ? (
            <LessonCarrusel key={`car-${i}`} imagenes={seg.imagenes ?? []} />
          ) : (
            <div
              key={`h-${i}`}
              // Contenido ya sanitizado en splitLessonContent (DOMPurify, sin script/iframe/style)
              dangerouslySetInnerHTML={{ __html: seg.value }}
            />
          )
        )}
      </article>

      {attachments.length > 0 && (
        <div className="lx-root mt-8">
          <h4>Archivos de la lección</h4>
          <ul>
            {attachments.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.name}
                </a>
                {a.size ? <span className="lx-kicker"> {formatSize(a.size)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
