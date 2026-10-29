'use client';

import Link from 'next/link';
import { X, MapPin } from 'lucide-react';
import { Cluster } from '../lib/clusters';
import { MAP_COLORS } from './MapDefs';

interface MapClusterPanelProps {
  cluster: Cluster;
  light: boolean;
  onClose: () => void;
}

const isOnline = (lastSeen: string | null) =>
  lastSeen ? Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000 : false;

/**
 * Quién vive en un punto del mapa.
 *
 * Sustituye al popup de Leaflet, que solo sabía mostrar UNA persona: con nueve
 * miembros en Madrid, ocho quedaban invisibles bajo el pin de arriba. Conserva
 * los mismos datos que mostraba antes (avatar, nombre, actividad, ubicación,
 * bio, enlace al perfil) y añade los que faltaban.
 */
export function MapClusterPanel({ cluster, light, onClose }: MapClusterPanelProps) {
  const place = [cluster.city, cluster.country].filter(Boolean).join(', ');

  return (
    <div
      className="absolute right-3 bottom-3 top-3 z-20 flex w-[min(21rem,calc(100%-1.5rem))] flex-col rounded-2xl border shadow-2xl sm:right-4 sm:bottom-4 sm:top-4"
      style={{
        borderColor: light ? 'rgba(0,0,0,.1)' : 'rgba(255,145,1,.22)',
        background: light ? 'rgba(255,255,255,.96)' : 'rgba(10,9,13,.94)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <header
        className="flex items-start justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: light ? 'rgba(0,0,0,.08)' : 'rgba(255,145,1,.14)' }}
      >
        <div className="min-w-0">
          <p
            className="truncate text-[15px] italic leading-tight"
            style={{
              fontFamily: "'Iowan Old Style', Palatino, Georgia, serif",
              color: light ? '#2a2418' : MAP_COLORS.goldSoft,
            }}
          >
            {place || 'Ubicación aproximada'}
          </p>
          <p
            className="mt-1 text-[10px] uppercase tracking-[0.18em]"
            style={{ color: light ? '#6b6152' : MAP_COLORS.textMuted }}
          >
            {cluster.members.length}{' '}
            {cluster.members.length === 1 ? 'miembro' : 'miembros'}
            {cluster.online > 0 && ` · ${cluster.online} en línea`}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          style={{ color: light ? '#6b6152' : MAP_COLORS.textMuted }}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {cluster.members.map((m) => {
          const online = isOnline(m.last_seen);
          return (
            <Link
              key={m.id}
              href={`/profile/${m.id}`}
              className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-black/[.06] dark:hover:bg-white/[.05]"
            >
              <div className="relative shrink-0">
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatar_url}
                    alt={m.full_name}
                    className="h-10 w-10 rounded-full object-cover"
                    style={{ boxShadow: `0 0 0 1.5px rgba(255,145,1,.35)` }}
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      background: 'rgba(255,145,1,.14)',
                      color: MAP_COLORS.goldSoft,
                      boxShadow: '0 0 0 1.5px rgba(255,145,1,.35)',
                    }}
                  >
                    {m.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                {online && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
                    style={{
                      background: '#3fb27f',
                      borderColor: light ? '#fff' : '#0a090d',
                    }}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium"
                  style={{ color: light ? '#1b1710' : MAP_COLORS.textPrimary }}
                >
                  {m.full_name}
                </p>
                {/* Solo "en línea": la fecha de última conexión no se muestra. */}
                {online && (
                  <p className="text-[11px]" style={{ color: light ? '#6b6152' : MAP_COLORS.textMuted }}>
                    En línea ahora
                  </p>
                )}
                {m.bio && (
                  <p
                    className="mt-1 line-clamp-2 text-[11px] leading-relaxed"
                    style={{ color: light ? '#5a5245' : '#d4d4d8', opacity: 0.85 }}
                  >
                    {m.bio}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <footer
        className="flex items-center gap-1.5 border-t px-4 py-2.5 text-[10px]"
        style={{
          borderColor: light ? 'rgba(0,0,0,.08)' : 'rgba(255,145,1,.14)',
          color: light ? '#6b6152' : MAP_COLORS.textMuted,
        }}
      >
        <MapPin className="h-3 w-3 shrink-0" />
        Las ubicaciones son aproximadas por privacidad
      </footer>
    </div>
  );
}
