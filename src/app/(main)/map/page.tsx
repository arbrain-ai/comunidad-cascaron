'use client';

import dynamic from 'next/dynamic';
import { useMapMembers } from '@/features/map/hooks/useMapMembers';

// El mapa mide su contenedor y lee el tema del documento, así que se monta solo
// en cliente. Ya no hay motivo de Leaflet aquí: el mapa es SVG propio.
const SovereignMap = dynamic(
  () => import('@/features/map/components/SovereignMap').then((mod) => mod.SovereignMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#f4f1ea] dark:bg-[#09090b]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#ff9101]/30 border-t-[#ff9101]" />
      </div>
    ),
  }
);

export default function MapPage() {
  const { members, loading, error } = useMapMembers();

  return (
    <div className="h-[calc(100vh-120px)] p-4">
      {/* React hoistea este link al <head>, así que sale en el HTML inicial y
          la geometría empieza a bajar EN PARALELO con el chunk del mapa. Antes
          el navegador esperaba a que el componente montara para pedirla:
          medido, el fetch no arrancaba hasta los ~608 ms. */}
      <link rel="preload" href="/map/world-geometry.json" as="fetch" crossOrigin="anonymous" />
      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      <div className="relative isolate h-full" style={{ zIndex: 0 }}>
        <SovereignMap members={members} loading={loading} />
      </div>
    </div>
  );
}
