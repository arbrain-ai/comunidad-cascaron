'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { VideoTrack, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { ChevronLeft, ChevronRight, Volume2, Maximize2, Minimize2 } from 'lucide-react';
import { Celda, type AccionesCelda, type CeldaDatos } from './Celda';
import { calcularRejilla, celdasPorPagina, paginaDe, paginar, presentacion, incluirOrador } from './geometria';

export type Vista = 'rejilla' | 'orador' | 'presentacion';
interface Props {
  celdas: CeldaDatos[]; acciones: Omit<AccionesCelda, 'fijado'>;
  fijadoId: string | null; hablandoId: string | null; vista: Vista;
  pantallaCompartida?: { trackRef: TrackReferenceOrPlaceholder; identity: string; nombre: string } | null;
  ahora: () => number;
  onCamerasVisible?: (identities: string[]) => void;
}

function Paginador({ pagina, total, onIr, label = 'participantes' }: { pagina: number; total: number; onIr: (p: number) => void; label?: string }) {
  if (total <= 1) return null;
  return <div className="sala-pages" aria-label={`Páginas de ${label}`}>
    <button onClick={() => onIr(pagina - 1)} disabled={pagina === 0} aria-label="Página anterior"><ChevronLeft size={16}/></button>
    <span aria-live="polite">{pagina + 1} <span className="opacity-50">/ {total}</span></span>
    <button onClick={() => onIr(pagina + 1)} disabled={pagina >= total - 1} aria-label="Página siguiente"><ChevronRight size={16}/></button>
  </div>;
}

export function Rejilla({ celdas, acciones, fijadoId, hablandoId, vista, pantallaCompartida, ahora, onCamerasVisible }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({w:0,h:0});
  const [pagina, setPagina] = useState(0);
  const [paginaTira, setPaginaTira] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const [mainSize, setMainSize] = useState({w:0,h:0});
  const [ampliada, setAmpliada] = useState(false);
  const orador = hablandoId;
  useEffect(() => {
    if (!root.current) return;
    const ro = new ResizeObserver(([e]) => setSize({w:Math.floor(e.contentRect.width),h:Math.floor(e.contentRect.height)}));
    ro.observe(root.current); return () => ro.disconnect();
  }, []);
  // The shared speaker is already stabilized upstream; don't add a local delay.
  useEffect(() => { if (!pantallaCompartida) setAmpliada(false); }, [pantallaCompartida?.identity]);
  useEffect(() => { if(!ampliada)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setAmpliada(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[ampliada]);
  const ordered = useMemo(() => {
    const fixed = celdas.find(c => c.identity === fijadoId);
    return fixed ? [fixed, ...celdas.filter(c => c !== fixed)] : celdas;
  }, [celdas, fijadoId]);
  const acc = (c: CeldaDatos): AccionesCelda => ({...acciones,fijado:c.identity===fijadoId});
  const stage = vista === 'presentacion' && pantallaCompartida ? pantallaCompartida : null;
  const speaker = vista === 'orador' ? ordered.find(c=>c.identity===(fijadoId??orador))??ordered[0] : null;
  useEffect(() => {
    if (!mainRef.current) return;
    const ro = new ResizeObserver(([e])=>setMainSize({w:e.contentRect.width,h:e.contentRect.height}));
    ro.observe(mainRef.current); return ()=>ro.disconnect();
  }, [stage?.identity, !!speaker]);
  const dimensions = stage?.trackRef.publication?.dimensions;
  const ratio = dimensions?.width && dimensions?.height ? dimensions.width/dimensions.height : 16/9;
  const fittedWidth = Math.min(mainSize.w,mainSize.h*ratio);
  const presentation = presentacion(size.w,size.h,ordered.length);
  const zoomWidth = ampliada && !presentation.lateral ? mainSize.w * 2 : fittedWidth;
  const others = speaker ? ordered.filter(c=>c!==speaker) : ordered;
  const strip = paginar(others,presentation.porPagina,paginaTira);
  const visibleStrip = incluirOrador(strip.visibles,others,strip.visibles.length===1 && strip.visibles[0].identity===fijadoId?null:orador);
  const grid = paginar(ordered,celdasPorPagina(size.w,size.h),pagina);
  const visibleGrid = incluirOrador(grid.visibles, ordered, grid.visibles.length===1 && grid.visibles[0].identity===fijadoId ? null : orador);
  const visibleKey = (stage || speaker ? [...(speaker ? [speaker] : []), ...(!ampliada ? visibleStrip : [])] : visibleGrid).map(c=>c.identity).join(',');
  useEffect(() => { onCamerasVisible?.(visibleKey ? visibleKey.split(',') : []); }, [visibleKey,onCamerasVisible]);
  const gap = size.w < 600 ? 8 : 12;
  const geometry = calcularRejilla(grid.visibles.length,Math.max(0,size.w),Math.max(0,size.h-(grid.totalPaginas>1?44:0)),gap);
  const offPage = orador ? ordered.find(c=>c.identity===orador && !grid.visibles.includes(c)) : null;
  return <div ref={root} className="sala-stage" data-testid="sala-stage" data-view={stage?'presentacion':speaker?'orador':'rejilla'}>
    {stage || speaker ? <div className={`sala-presentation ${presentation.lateral?'is-lateral':'is-stacked'} ${ampliada?'is-expanded':''} ${size.h<400?'is-short':''}`} style={{gap:presentation.gap}}>
      <div ref={mainRef} className="sala-presentation-main" data-testid="presentation-main">
        {stage?.trackRef.publication ? <div className="sala-video-viewport"><VideoTrack trackRef={stage.trackRef as Parameters<typeof VideoTrack>[0]['trackRef']} className="sala-shared-track" style={zoomWidth>0?{width:zoomWidth,height:zoomWidth/ratio}:undefined}/></div> : speaker ? <Celda datos={speaker} acciones={acc(speaker)} ahora={ahora}/> : null}
        {stage && <div className="sala-presentation-caption"><span>{ampliada && !presentation.lateral ? 'Desliza para recorrer la presentación' : `Presenta ${stage.nombre}`}</span><button onClick={()=>setAmpliada(v=>!v)} aria-label={ampliada?'Mostrar participantes':'Ampliar presentación'} title={ampliada?'Mostrar participantes':'Ampliar presentación'}>{ampliada?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button></div>}
      </div>
      {!ampliada && others.length>0 && <aside className="sala-participant-strip" style={presentation.lateral?{width:presentation.ancho}:undefined} aria-label="Participantes junto a la presentación" data-testid="participant-strip">
        <div className="sala-strip-heading"><span>{others.length} participantes</span><Paginador pagina={strip.pagina} total={strip.totalPaginas} onIr={setPaginaTira}/></div>
        <div className="sala-strip-tiles" style={!presentation.lateral?{gridTemplateColumns:`repeat(${presentation.columnas},minmax(0,1fr))`}:undefined}>
          {visibleStrip.map(c=><div className="sala-strip-tile" key={c.identity}><Celda datos={c} acciones={acc(c)} ahora={ahora}/></div>)}
        </div>
      </aside>}
    </div> : <div className="sala-gallery">
      <div className="sala-gallery-tiles" style={{gap}} data-testid="gallery-tiles">
        {visibleGrid.map(c=><div className="sala-gallery-tile" key={c.identity} style={{width:geometry.cellW,height:geometry.cellH}}><Celda datos={c} acciones={acc(c)} ahora={ahora}/></div>)}
      </div>
      {(grid.totalPaginas>1 || offPage) && <div className="sala-gallery-footer">
        {offPage && <button className="sala-speaker-link" onClick={()=>setPagina(paginaDe(ordered.indexOf(offPage),celdasPorPagina(size.w,size.h)))}><Volume2 size={14}/>Habla {offPage.nombre}</button>}
        <Paginador pagina={grid.pagina} total={grid.totalPaginas} onIr={setPagina}/>
      </div>}
    </div>}
  </div>;
}
