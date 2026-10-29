'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * CÁPSULA SOBERANA (Classroom v2, fase 2).
 *
 * Renderiza un mecanismo interactivo (HTML + CSS + JS propios de la lección)
 * dentro de un <iframe sandbox="allow-scripts"> SIN allow-same-origin:
 * el documento corre en un ORIGEN OPACO, así que su JavaScript no puede leer
 * cookies, storage ni el DOM de la app aunque lo intente. Es seguro *porque*
 * está fuera, no porque confiemos en el contenido.
 *
 * Los tres costos del iframe, resueltos aquí:
 *  1. ALTURA   — bootstrap con ResizeObserver dentro del frame que publica su
 *                alto por postMessage; el padre lo aplica (con clamp).
 *  2. TEMA     — el shell define los tokens --lx-* en claro y oscuro; el padre
 *                observa la clase `dark` de <html> y avisa por postMessage.
 *                Sin mensaje aún, cae a prefers-color-scheme (sin flash).
 *  3. BÚSQUEDA — no se resuelve aquí: el texto de una lección-cápsula vive en
 *                la columna espejo `lessons.search_text`.
 */

const ALTO_MIN = 120;
const ALTO_MAX = 30000;
const ALTO_DEFAULT = 520;

/**
 * Tokens ESPEJO de `.lx-root` en globals.css. Si cambias un color allá,
 * cámbialo aquí y conserva el contraste AA (≥4.5:1).
 *
 * LA PANTALLA ESTÁ ENCENDIDA EN LOS DOS TEMAS: igual que la capa .lx-enact,
 * el mecanismo es un instrumento oscuro también sobre papel claro. Eso da
 * uniformidad con los diagramas estáticos y hace que el AA del texto no
 * dependa del tema de la página. El puente de tema se conserva (el padre
 * sigue avisando) porque el MARCO sí distingue claro de oscuro.
 */
const LX_TOKENS_PANTALLA = `
  --lx-void:#09090b; --lx-ink:#0d0d12; --lx-gold:#ff9101; --lx-gold-soft:#ffb64d;
  --lx-purple:#8c27f1; --lx-purple-soft:#9d3cf5;
  --lx-text:#cfcbd6; --lx-dim:#8b8496; --lx-faint:#938ca0;
  --lx-rule:rgba(255,145,1,.16); --lx-panel:#0d0d12;
  --lx-gold-ink:#ff9101; --lx-purple-ink:#ae5ff8;
  --lx-canvas:#0d0d12; --lx-canvas-alto:#101018;
  --lx-enact-lbl:#9a93a6; --lx-enact-gold:#ff9101;
  --lx-enact-pur:#b473f7; --lx-stroke-gold:#ff9101; --lx-stroke-pur:#9d3cf5;
  --lx-stroke-dim:#7c7490; --lx-ejes:#3a3546; --lx-caja:#12121a;
  --lx-caja-line:#4a4458; --lx-caja-gold-bg:rgba(255,145,1,.08);
  --lx-caja-pur-bg:rgba(140,39,241,.09); --lx-ok:#3fb27f; --lx-bad:#e0484d;
`;

/** Shell del documento: tokens de tema + reset mínimo + puente de altura/tema. */
function buildSrcDoc(authorHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style data-lx-shell>
  :root{${LX_TOKENS_PANTALLA}
    --lx-serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    --lx-display:Optima,"Palatino Linotype",Palatino,Georgia,serif;
    --lx-mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;}
  html,body{margin:0;padding:0;background:transparent;
    color:var(--lx-text);font-family:var(--lx-serif);
    overflow-x:hidden;-webkit-font-smoothing:antialiased;}
  /* wrapper de MEDICIÓN: su alto real es el contenido, inmune al enclave del
     viewport (documentElement.scrollHeight nunca baja de la altura que el padre
     le fija al iframe → se latcheaba alto y dejaba un hueco). */
  #lx-measure{display:flow-root;} /* contiene los márgenes hijos */
</style>
</head>
<body>
${authorHtml}
<script data-lx-shell>
(function () {
  var reporta = function () {
    var h = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    parent.postMessage({ __lx: 'alto', h: h }, '*');
  };
  if ('ResizeObserver' in window) {
    new ResizeObserver(reporta).observe(document.documentElement);
    if (document.body) new ResizeObserver(reporta).observe(document.body);
  }
  addEventListener('load', reporta);
  setTimeout(reporta, 80);
  addEventListener('message', function (e) {
    var d = (e && e.data) || {};
    if (d.__lx === 'tema' && (d.tema === 'dark' || d.tema === 'light')) {
      document.documentElement.setAttribute('data-theme', d.tema);
    }
    if (d.__lx === 'visible') {
      try { dispatchEvent(new CustomEvent('lx-visible', { detail: !!d.v })); } catch (err) {}
    }
  });
})();
</script>
</body>
</html>`;
}

/** base64 → UTF-8. Devuelve '' ante payload corrupto (la cápsula no revienta la lección). */
function decodeCapsule(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

interface LessonCapsuleProps {
  /** Payload base64 del marcador data-lx-capsula. */
  payload: string;
  /** Altura inicial (data-lx-alto) mientras el puente reporta la real. */
  alto?: number;
}

export default function LessonCapsule({ payload, alto }: LessonCapsuleProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [altura, setAltura] = useState(() =>
    Math.min(ALTO_MAX, Math.max(ALTO_MIN, alto ?? ALTO_DEFAULT))
  );

  const srcDoc = useMemo(() => {
    const html = decodeCapsule(payload);
    return html ? buildSrcDoc(html) : '';
  }, [payload]);

  // Puente 1: altura. Solo se aceptan mensajes DEL contentWindow de ESTE frame.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const d = e.data as { __lx?: string; h?: unknown } | null;
      if (d?.__lx === 'alto' && typeof d.h === 'number' && Number.isFinite(d.h)) {
        setAltura(Math.min(ALTO_MAX, Math.max(ALTO_MIN, Math.ceil(d.h))));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Puente 2: tema. Observa la clase `dark` de <html> y avisa al frame.
  useEffect(() => {
    const postTema = () => {
      const tema = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      iframeRef.current?.contentWindow?.postMessage({ __lx: 'tema', tema }, '*');
    };
    const obs = new MutationObserver(postTema);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const frame = iframeRef.current;
    frame?.addEventListener('load', postTema);
    return () => {
      obs.disconnect();
      frame?.removeEventListener('load', postTema);
    };
  }, []);

  // Puente 3: visibilidad (para que la cápsula pueda pausar animaciones caras).
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const v = entries.some((en) => en.isIntersecting);
        frame.contentWindow?.postMessage({ __lx: 'visible', v }, '*');
      },
      { rootMargin: '120px 0px' }
    );
    io.observe(frame);
    return () => io.disconnect();
  }, []);

  if (!srcDoc) return null;

  return (
    <iframe
      ref={iframeRef}
      className="lx-capsula"
      // allow-scripts SIN allow-same-origin: JS completo en origen opaco.
      // NUNCA añadir allow-same-origin: rompería el aislamiento entero.
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      title="Mecanismo interactivo de la lección"
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{ height: altura }}
    />
  );
}
