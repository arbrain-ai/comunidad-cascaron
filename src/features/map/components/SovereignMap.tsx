'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MemberLocation } from '../types';
import { useWorldGeometry } from '../hooks/useWorldGeometry';
import { buildClusters, Cluster, countryNameES, tallyByCountry } from '../lib/clusters';
import {
  boundsToViewBox,
  clampViewBox,
  HOME_BOUNDS,
  projectPoint,
  ViewBox,
} from '../lib/projection';
import { MapDefs, MAP_COLORS } from './MapDefs';
import { MapClusterPanel } from './MapClusterPanel';
import { MapEdgeBeacons } from './MapEdgeBeacons';

interface SovereignMapProps {
  members: MemberLocation[];
  loading: boolean;
}

const ZOOM_MIN_W = 150; // acercamiento máximo: ~nivel región
const ZOOM_MAX_W = 1000; // el mundo entero cabe

/**
 * El mapa de la comunidad, dibujado por nosotros.
 *
 * No hay proveedor de tiles: la geometría es un archivo estático de nuestro
 * propio origen y aquí solo se pinta. Eso significa cero peticiones a terceros
 * al renderizar, cero API keys, y que nadie puede cambiarnos las reglas —que es
 * justo lo que pasó el 26 ago 2026, cuando CARTO empezó a servir los tiles con
 * la leyenda "API KEY REQUIRED" horneada dentro del PNG.
 */
export function SovereignMap({ members, loading }: SovereignMapProps) {
  const uid = useId().replace(/:/g, '');
  const { geometry, error } = useWorldGeometry();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [light, setLight] = useState(false);
  const [view, setView] = useState<ViewBox | null>(null);
  const [hover, setHover] = useState<Cluster | null>(null);
  const [selected, setSelected] = useState<Cluster | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });

  // El tema lo manda la clase `dark` del documento, igual que el resto de la app.
  useEffect(() => {
    const read = () => setLight(!document.documentElement.classList.contains('dark'));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clusters = useMemo(
    () => (geometry ? buildClusters(members, geometry.projection) : []),
    [members, geometry]
  );
  const tally = useMemo(() => tallyByCountry(members), [members]);

  // Encuadre inicial: Iberoamérica, donde vive el 80% de la comunidad.
  //
  // Se rehace cuando cambia la FORMA del contenedor (girar el teléfono, abrir
  // el panel, pasar de escritorio a móvil) mientras nadie haya movido el mapa
  // a mano. Sin esto el viewBox conservaba el aspecto con el que nació y en un
  // teléfono el recorte se comía México y España — o sea la mitad de la
  // comunidad — que es exactamente lo que el encuadre existe para mostrar.
  const lastAspect = useRef(0);
  const userMoved = useRef(false);
  useEffect(() => {
    if (!geometry) return;
    const aspect = size.w / size.h;
    if (view && (userMoved.current || Math.abs(aspect - lastAspect.current) < 0.08)) return;
    lastAspect.current = aspect;
    setView(boundsToViewBox(HOME_BOUNDS, geometry.projection, aspect));
  }, [geometry, size.w, size.h, view]);

  const goHome = useCallback(() => {
    if (!geometry) return;
    userMoved.current = false;
    lastAspect.current = size.w / size.h;
    setSelected(null);
    setView(boundsToViewBox(HOME_BOUNDS, geometry.projection, size.w / size.h));
  }, [geometry, size.w, size.h]);

  /** Centra la vista en un punto del lienzo, opcionalmente acercando. */
  const focusOn = useCallback(
    (x: number, y: number, targetW?: number) => {
      if (!geometry) return;
      userMoved.current = true;
      setView((v) => {
        if (!v) return v;
        const w = targetW ?? v.w;
        const h = (w / v.w) * v.h;
        return clampViewBox(
          { x: x - w / 2, y: y - h / 2, w, h },
          geometry.projection,
          ZOOM_MIN_W,
          ZOOM_MAX_W
        );
      });
    },
    [geometry]
  );

  const zoomBy = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      if (!geometry) return;
      userMoved.current = true;
      setView((v) => {
        if (!v) return v;
        const w = v.w * factor;
        const h = v.h * factor;
        // Sin ancla, el zoom sale del centro; con ancla (rueda del ratón), el
        // punto bajo el cursor se queda quieto.
        const ax = anchor ? anchor.x : v.x + v.w / 2;
        const ay = anchor ? anchor.y : v.y + v.h / 2;
        const nx = ax - ((ax - v.x) * w) / v.w;
        const ny = ay - ((ay - v.y) * h) / v.h;
        return clampViewBox({ x: nx, y: ny, w, h }, geometry.projection, ZOOM_MIN_W, ZOOM_MAX_W);
      });
    },
    [geometry]
  );

  /** Convierte coordenadas de pantalla a coordenadas del lienzo. */
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !view) return null;
      return {
        x: view.x + ((clientX - rect.left) / rect.width) * view.w,
        y: view.y + ((clientY - rect.top) / rect.height) * view.h,
      };
    },
    [view]
  );

  // Zoom con rueda. Se registra a mano con { passive: false } porque React
  // adjunta onWheel como pasivo y preventDefault() no surtiría efecto: la
  // página entera haría scroll al intentar acercar el mapa.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const anchor = toCanvas(e.clientX, e.clientY);
      zoomBy(e.deltaY > 0 ? 1.12 : 0.89, anchor ?? undefined);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toCanvas, zoomBy]);

  // Arrastre para desplazar.
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!view) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !view || !geometry) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((e.clientX - d.x) / rect.width) * view.w;
    const dy = ((e.clientY - d.y) / rect.height) * view.h;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) {
      d.moved = true;
      userMoved.current = true;
    }
    setView(
      clampViewBox(
        { ...view, x: d.vx - dx, y: d.vy - dy },
        geometry.projection,
        ZOOM_MIN_W,
        ZOOM_MAX_W
      )
    );
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // Escala inversa: el trazo y los puntos conservan su grosor en pantalla al
  // acercar. Sin esto las costas engordan y el grabado se vuelve caricatura.
  const k = view ? view.w / 1000 : 1;

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center rounded-2xl bg-[#09090b] text-sm text-red-300">
        No se pudo cargar el mapa: {error}
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden rounded-2xl select-none"
      style={{ background: light ? '#f4f1ea' : MAP_COLORS.void }}
    >
      {!geometry && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-7 w-7 rounded-full border-2 border-[#ff9101]/30 border-t-[#ff9101] animate-spin" />
            <p className="text-xs tracking-[0.18em] uppercase text-[#a1a1aa]">Trazando el mapa</p>
          </div>
        </div>
      )}

      {geometry && view && (
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          // slice: el lienzo se llena siempre. Con el "meet" por defecto
          // quedaban bandas negras a los lados cuando el aspecto del
          // contenedor no coincidia con el del encuadre.
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full touch-none"
          style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          role="img"
          aria-label="Mapa de la comunidad"
        >
          <MapDefs light={light} uid={uid} />

          {/* --- el papel --- */}
          <rect
            x={-200}
            y={-200}
            width={geometry.projection.width + 400}
            height={geometry.projection.height + 400}
            fill={light ? '#f4f1ea' : MAP_COLORS.void}
          />

          {/* trama de sonda sobre el agua: el papel del grabado no deja
              superficie vacía */}
          <rect
            x={-200}
            y={-200}
            width={geometry.projection.width + 400}
            height={geometry.projection.height + 400}
            fill={`url(#${uid}-water)`}
            opacity={0.75}
          />

          {/* --- retícula de la carta: meridianos y paralelos --- */}
          <g
            stroke={MAP_COLORS.purple}
            strokeOpacity={light ? 0.16 : 0.16}
            strokeWidth={0.35 * k}
            fill="none"
          >
            {Array.from({ length: 25 }, (_, i) => {
              const lon = -180 + i * 15;
              const a = projectPoint(lon, geometry.projection.latMax, geometry.projection);
              const b = projectPoint(lon, geometry.projection.latMin, geometry.projection);
              return <line key={`m${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
            })}
            {Array.from({ length: 13 }, (_, i) => {
              const lat = -60 + i * 15;
              if (lat > geometry.projection.latMax || lat < geometry.projection.latMin) return null;
              const a = projectPoint(-180, lat, geometry.projection);
              return (
                <line
                  key={`p${i}`}
                  x1={0}
                  y1={a.y}
                  x2={geometry.projection.width}
                  y2={a.y}
                />
              );
            })}
          </g>

          {/* --- la tierra en sombra --- */}
          <g>
            {geometry.countries.map((c) => (
              <path
                key={c.n}
                d={c.d}
                fill={light ? MAP_COLORS.shadowLandLight : MAP_COLORS.shadowLand}
                stroke={MAP_COLORS.purple}
                strokeOpacity={light ? 0.28 : 0.22}
                strokeWidth={0.4 * k}
                strokeLinejoin="round"
              />
            ))}
            {/* la trama del aguafuerte, solo sobre la tierra */}
            {geometry.countries.map((c) => (
              <path
                key={`h${c.n}`}
                d={c.d}
                fill={`url(#${uid}-hatch)`}
                // La trama pesa menos donde cae la luz: el aguafuerte raya la
                // sombra, no lo iluminado.
                opacity={tally.has(c.n) ? 0.82 : 1}
              />
            ))}
            {/* la segunda dirección: sin ella es rayado, no cross-hatching */}
            {geometry.countries.map((c) => (
              <path
                key={`h2${c.n}`}
                d={c.d}
                fill={`url(#${uid}-hatch2)`}
                opacity={tally.has(c.n) ? 0.7 : 0.9}
              />
            ))}
          </g>

          {/* --- la tierra que recibe la luz: los países con comunidad --- */}
          <g style={{ mixBlendMode: light ? 'multiply' : 'screen' }}>
            {geometry.countries.map((c) => {
              const t = tally.get(c.n);
              if (!t) return null;
              // Raíz cuarta: México (72) no puede verse 72 veces más brillante
              // que Italia (3), o el resto del mapa desaparece.
              const intensity = Math.min(1, Math.pow(t.count / 72, 0.55));
              return (
                <path
                  key={`l${c.n}`}
                  d={c.d}
                  fill={MAP_COLORS.gold}
                  fillOpacity={(light ? 0.1 : 0.035) + intensity * (light ? 0.12 : 0.05)}
                  stroke={MAP_COLORS.gold}
                  strokeOpacity={0.3 + intensity * 0.5}
                  strokeWidth={(0.45 + intensity * 0.35) * k}
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* --- el resplandor de la comunidad: la luz emana de la gente --- */}
          <g style={{ mixBlendMode: light ? 'multiply' : 'screen' }} pointerEvents="none">
            {clusters.map((c) => {
              // Exponente 0.72, no raiz cuadrada: con sqrt un punto de 1
              // persona alcanzaba casi el halo de un foco de 9 y el mapa
              // MENTIA sobre la densidad. Asi 1 pesa ~3.5x menos que 9.
              const r = (2 + Math.pow(c.members.length, 0.72) * 4.6) * k;
              return (
                <circle key={`g${c.id}`} cx={c.x} cy={c.y} r={r} fill={`url(#${uid}-glow)`} />
              );
            })}
          </g>

          {/* --- sondas: los anillos de la carta náutica alrededor de los focos --- */}
          <g fill="none" pointerEvents="none">
            {clusters
              .filter((c) => c.members.length >= 3)
              .map((c) =>
                [1, 1.9, 2.9].map((mult, i) => (
                  <circle
                    key={`s${c.id}-${i}`}
                    cx={c.x}
                    cy={c.y}
                    r={(2.6 + Math.sqrt(c.members.length) * 1.5) * mult * k}
                    stroke={MAP_COLORS.gold}
                    strokeOpacity={(light ? 0.3 : 0.26) / (i + 1.3)}
                    strokeWidth={0.35 * k}
                  />
                ))
              )}
          </g>

          {/* --- los miembros --- */}
          <g
            style={{
              animation: 'sfmap-in .5s ease-out both',
            }}
          >
            {clusters.map((c) => {
              const n = c.members.length;
              // El radio baja con el zoom, pero nunca por debajo de lo que se
              // ve y se toca: en móvil un punto de 1 miembro se perdía.
              // El radio del punto también discrimina: 1 persona no puede
              // ocupar lo mismo que 9. El piso solo garantiza que se vea y se
              // pueda tocar en un teléfono.
              const r = Math.max((1.35 + Math.pow(n, 0.7) * 1.5) * k, 1.6 * k);
              const active = hover?.id === c.id || selected?.id === c.id;
              return (
                <g
                  key={c.id}
                  // Ancla estable para pruebas y depuración: sin esto la única
                  // forma de señalar un punto concreto es por coordenada, que
                  // cambia con cada reencuadre.
                  data-place={c.id}
                  data-members={n}
                  onMouseEnter={() => setHover(c)}
                  onMouseLeave={() => setHover((h) => (h?.id === c.id ? null : h))}
                  onClick={() => {
                    if (drag.current?.moved) return;
                    setSelected(c);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* área de toque: en móvil el dedo no acierta a 3px */}
                  <circle cx={c.x} cy={c.y} r={Math.max(r * 2.6, 9 * k)} fill="transparent" />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={r * (active ? 1.5 : 1)}
                    fill={MAP_COLORS.gold}
                    filter={`url(#${uid}-soft)`}
                    opacity={0.95}
                  />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={r * (active ? 1.5 : 1)}
                    fill={light ? '#b25f00' : MAP_COLORS.goldSoft}
                  />
                  {active && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={r * 2.9}
                      fill="none"
                      stroke={MAP_COLORS.gold}
                      strokeWidth={0.6 * k}
                      strokeOpacity={0.9}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* --- nombres de los países con comunidad --- */}
          <g pointerEvents="none">
            {geometry.countries.map((c) => {
              const t = tally.get(c.n);
              // Los países chicos solo se rotulan de cerca: a vista de mundo
              // sus nombres se encimarían unos con otros.
              if (!t || (t.count < 3 && view.w > 300) || (t.count < 8 && view.w > 620)) return null;
              const p = projectPoint(c.c[0], c.c[1], geometry.projection);
              if (
                p.x < view.x ||
                p.x > view.x + view.w ||
                p.y < view.y ||
                p.y > view.y + view.h
              )
                return null;
              return (
                <g key={`t${c.n}`} opacity={light ? 0.95 : 0.9}>
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    fontSize={5.4 * k}
                    letterSpacing={1.5 * k}
                    fill={light ? '#4a3d1c' : '#ffd9a0'}
                    // Contorno oscuro por debajo del relleno: el rótulo cae
                    // justo encima del resplandor dorado y sin esto se
                    // desaparecía en las zonas densas, que son las que más
                    // necesitan nombre.
                    stroke={light ? '#f4f1ea' : '#08070c'}
                    strokeWidth={1.6 * k}
                    strokeOpacity={light ? 0.85 : 0.8}
                    style={{
                      fontFamily: "'Iowan Old Style', Palatino, Georgia, serif",
                      textTransform: 'uppercase',
                      paintOrder: 'stroke fill',
                    }}
                  >
                    {countryNameES(c.n)}
                  </text>
                  {/* El número va debajo del nombre: sin él, dos manchas de
                      brillo parecido no dicen cuál pesa más — que es el dato
                      que el mapa existe para contar. */}
                  <text
                    x={p.x}
                    y={p.y + 7 * k}
                    textAnchor="middle"
                    fontSize={8.6 * k}
                    fill={light ? '#8a5a00' : MAP_COLORS.gold}
                    fillOpacity={1}
                    stroke={light ? '#f4f1ea' : '#08070c'}
                    strokeWidth={1.9 * k}
                    strokeOpacity={light ? 0.85 : 0.82}
                    style={{
                      fontFamily: "'Iowan Old Style', Palatino, Georgia, serif",
                      paintOrder: 'stroke fill',
                    }}
                  >
                    {t.count}
                  </text>
                </g>
              );
            })}
          </g>

          {/* --- viñeta: la oscuridad domina el lienzo (claroscuro) --- */}
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill={`url(#${uid}-vignette)`}
            pointerEvents="none"
          />

          <MapEdgeBeacons
            clusters={clusters}
            view={view}
            k={k}
            light={light}
            onJump={(c) => focusOn(c.x, c.y, Math.min(view.w, 320))}
          />
        </svg>
      )}

      <style>{`@keyframes sfmap-in { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {/* Grano de papel de grabado. Era un feTurbulence sobre un rect que
          seguía el viewBox, o sea que el navegador lo recalculaba en CADA
          frame de arrastre y zoom. Como textura repetida ya generada, se pinta
          una vez y el filtro deja de existir. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'url(/map/grain.png)',
          backgroundRepeat: 'repeat',
          opacity: light ? 0.05 : 0.075,
          mixBlendMode: light ? 'multiply' : 'overlay',
        }}
      />

      {/* --- rótulo de la carta --- */}
      <div className="pointer-events-none absolute left-5 top-4 z-10">
        <p
          className="text-[13px] italic leading-none"
          style={{
            fontFamily: "'Iowan Old Style', Palatino, Georgia, serif",
            color: light ? '#3d3320' : MAP_COLORS.goldSoft,
            opacity: 0.92,
          }}
        >
          Dónde vive la fábrica
        </p>

      </div>

      {/* --- controles --- */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
        {[
          { label: '+', title: 'Acercar', fn: () => zoomBy(0.75) },
          { label: '−', title: 'Alejar', fn: () => zoomBy(1.33) },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            title={b.title}
            aria-label={b.title}
            className="h-8 w-8 rounded-lg border text-sm transition-colors"
            style={{
              borderColor: light ? 'rgba(0,0,0,.14)' : 'rgba(140,39,241,.35)',
              background: light ? 'rgba(255,255,255,.75)' : 'rgba(9,9,11,.62)',
              color: light ? '#3d3320' : MAP_COLORS.goldSoft,
              backdropFilter: 'blur(6px)',
            }}
          >
            {b.label}
          </button>
        ))}
        <button
          onClick={goHome}
          title="Volver al encuadre inicial"
          aria-label="Volver al encuadre inicial"
          className="h-8 w-8 rounded-lg border text-[10px] uppercase tracking-wider transition-colors"
          style={{
            borderColor: light ? 'rgba(0,0,0,.14)' : 'rgba(140,39,241,.35)',
            background: light ? 'rgba(255,255,255,.75)' : 'rgba(9,9,11,.62)',
            color: light ? '#3d3320' : MAP_COLORS.textMuted,
            backdropFilter: 'blur(6px)',
          }}
        >
          ⌂
        </button>
      </div>

      {/* --- lo que hay bajo el cursor --- */}
      {hover && !selected && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-[11px] whitespace-nowrap"
          style={{
            left: `${((hover.x - (view?.x ?? 0)) / (view?.w ?? 1)) * 100}%`,
            top: `${((hover.y - (view?.y ?? 0)) / (view?.h ?? 1)) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 14px))',
            borderColor: light ? 'rgba(0,0,0,.12)' : 'rgba(255,145,1,.3)',
            background: light ? 'rgba(255,255,255,.94)' : 'rgba(12,10,16,.92)',
            color: light ? '#2a2418' : MAP_COLORS.textPrimary,
            backdropFilter: 'blur(6px)',
          }}
        >
          <span style={{ color: MAP_COLORS.goldSoft }}>{hover.members.length}</span>{' '}
          {hover.members.length === 1 ? 'miembro' : 'miembros'}
          {hover.city ? ` · ${hover.city}` : ''}
        </div>
      )}

      {selected && (
        <MapClusterPanel cluster={selected} light={light} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
