'use client';

import { useMemo } from 'react';
import { Cluster } from '../lib/clusters';
import { ViewBox } from '../lib/projection';
import { MAP_COLORS } from './MapDefs';

interface MapEdgeBeaconsProps {
  clusters: Cluster[];
  view: ViewBox;
  k: number;
  light: boolean;
  onJump: (c: Cluster) => void;
}

/**
 * Los que quedaron fuera del encuadre.
 *
 * El mapa abre en Iberoamérica porque ahí vive el 80% de la comunidad, pero los
 * 23 de Estados Unidos, el de Australia o los de Emiratos no pueden
 * desaparecer por eso. Cada uno deja una baliza pegada al borde, en la
 * dirección real donde está: se ve que existen, se ve cuántos son, y un clic
 * lleva la vista hasta ellos.
 *
 * Se agrupan por país para que el borde no se convierta en una fila de puntos
 * ilegibles.
 */
export function MapEdgeBeacons({ clusters, view, k, light, onJump }: MapEdgeBeaconsProps) {
  const beacons = useMemo(() => {
    const margin = view.w * 0.012;
    const outside = clusters.filter(
      (c) =>
        c.x < view.x + margin ||
        c.x > view.x + view.w - margin ||
        c.y < view.y + margin ||
        c.y > view.y + view.h - margin
    );

    const byCountry = new Map<string, { count: number; target: Cluster; x: number; y: number }>();
    for (const c of outside) {
      const key = c.country ?? c.id;
      const prev = byCountry.get(key);
      if (!prev) {
        byCountry.set(key, { count: c.members.length, target: c, x: c.x, y: c.y });
      } else {
        prev.count += c.members.length;
        // La baliza apunta al grupo más grande del país, que es a donde
        // conviene saltar.
        if (c.members.length > prev.target.members.length) {
          prev.target = c;
          prev.x = c.x;
          prev.y = c.y;
        }
      }
    }

    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    const pad = view.w * 0.028;

    return [...byCountry.entries()]
      .map(([country, b]) => {
        // Se proyecta el punto sobre el borde por la recta que va del centro
        // de la vista hasta él: la baliza queda en su dirección verdadera.
        const dx = b.x - cx;
        const dy = b.y - cy;
        const halfW = view.w / 2 - pad;
        const halfH = view.h / 2 - pad;
        const t = Math.min(
          Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity,
          Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity
        );
        return {
          country,
          count: b.count,
          target: b.target,
          ex: cx + dx * t,
          ey: cy + dy * t,
          angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [clusters, view]);

  if (!beacons.length) return null;

  return (
    <g>
      {beacons.map((b) => (
        <g
          key={b.country}
          onClick={(e) => {
            e.stopPropagation();
            onJump(b.target);
          }}
          style={{ cursor: 'pointer' }}
        >
          <title>{`${b.count} en ${b.country} — clic para ir`}</title>
          <circle cx={b.ex} cy={b.ey} r={7.5 * k} fill={light ? '#fff' : '#0c0a10'} opacity={0.9} />
          <circle
            cx={b.ex}
            cy={b.ey}
            r={7.5 * k}
            fill="none"
            stroke={MAP_COLORS.gold}
            strokeOpacity={0.55}
            strokeWidth={0.5 * k}
          />
          {/* la punta que señala hacia afuera, hacia donde de verdad están */}
          <path
            d={`M ${b.ex + 8.5 * k} ${b.ey} l ${3.2 * k} ${-2.2 * k} l 0 ${4.4 * k} Z`}
            fill={MAP_COLORS.gold}
            fillOpacity={0.75}
            transform={`rotate(${b.angle} ${b.ex} ${b.ey})`}
          />
          <text
            x={b.ex}
            y={b.ey + 2.4 * k}
            textAnchor="middle"
            fontSize={6.4 * k}
            fill={light ? '#7a5200' : MAP_COLORS.goldSoft}
            style={{ fontFamily: "'Iowan Old Style', Palatino, Georgia, serif" }}
          >
            {b.count}
          </text>
        </g>
      ))}
    </g>
  );
}
