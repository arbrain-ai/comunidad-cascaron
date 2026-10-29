'use client';

import { useEffect, useState } from 'react';
import { WorldGeometry } from '../lib/projection';

/**
 * Carga la geometría del mundo desde nuestro propio origen.
 *
 * Se sirve como archivo estático de `public/map/`, generado en build por
 * `scripts/build-map-geometry.py` a partir de Natural Earth (dominio público).
 * Es la pieza que sustituye al proveedor de tiles: una sola petición a nuestro
 * dominio, cacheada por el navegador, en vez de ~30 peticiones por carga a un
 * servidor ajeno que puede cambiar de términos (CARTO lo hizo el 26 ago 2026).
 */

// Caché de módulo: al volver al mapa la geometría ya está en memoria y el SVG
// pinta en el primer frame, sin pantalla en blanco.
let cached: WorldGeometry | null = null;
let inFlight: Promise<WorldGeometry> | null = null;

async function load(): Promise<WorldGeometry> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = fetch('/map/world-geometry.json')
    .then((r) => {
      if (!r.ok) throw new Error(`geometría del mapa: HTTP ${r.status}`);
      return r.json() as Promise<WorldGeometry>;
    })
    .then((g) => {
      cached = g;
      inFlight = null;
      return g;
    })
    .catch((e) => {
      inFlight = null;
      throw e;
    });

  return inFlight;
}

// Se dispara al importar el módulo, sin esperar a que React monte el
// componente. El chunk y la geometría viajan solapados en vez de en fila.
if (typeof window !== 'undefined') void load().catch(() => {});

export function useWorldGeometry() {
  const [geometry, setGeometry] = useState<WorldGeometry | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Con setGeometry, no `return`: el preload del HTML y el `immutable` del
    // JSON hacen que el fetch de modulo resuelva ENTRE este render y este
    // efecto. Si solo saliamos, el estado se quedaba en null con la geometria
    // ya en memoria: spinner "Trazando el mapa" para siempre.
    if (cached) {
      setGeometry(cached);
      return;
    }
    let alive = true;
    load()
      .then((g) => alive && setGeometry(g))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'error'));
    return () => {
      alive = false;
    };
  }, []);

  return { geometry, error, loading: !geometry && !error };
}
