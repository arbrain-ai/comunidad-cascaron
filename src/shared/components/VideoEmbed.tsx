'use client';

// ============================================
// VideoEmbed Component
// ============================================
// Embeds video propio (video propio), YouTube, Vimeo or Loom videos
// FIX: Persiste estado de reproducción en sessionStorage
// para evitar reinicio al cambiar de pestaña (remount)

import { useState, useEffect, useCallback, useRef } from 'react';
import { parseVideoUrl, type VideoInfo } from '@/shared/utils/videoUrl';

const VIDEO_STATE_PREFIX = 'app:video-playing:';

interface VideoEmbedProps {
  url: string;
  className?: string;
  compact?: boolean; // Square thumbnail for post preview
  fill?: boolean; // In compact mode, fill the parent container instead of a fixed 88px square
  disablePlay?: boolean; // Disable inline play (click passes through to parent)
}

/**
 * Boton de play Titaniumorphism — el MISMO del player de video propio.
 *
 * Antes era un circulo morado plano: se leia como un boton de la app encima de
 * la imagen, no como parte del video. Este es metal negro cepillado con el
 * triangulo dorado en tira LED (perimetro encendido, centro del metal), igual
 * que el embed que se ve al abrir el video — asi la miniatura del feed y el
 * reproductor son la misma pieza.
 *
 * Colores por variable (--titanium-*, --gold): en tema claro el mismo boton
 * sale en titanio blanco sin tocar nada.
 */
function PlayButtonTitanium({ size = 66 }: { size?: number }) {
  const tri = Math.round(size * 0.55);
  return (
    <span
      className="relative flex items-center justify-center transition-transform duration-fast group-hover:scale-[1.07]"
      style={{ width: size, height: size }}
    >
      {/* halo mostaza por detras: despega el boton de cualquier miniatura */}
      <span
        className="absolute rounded-full opacity-85 transition-all duration-200 group-hover:opacity-100 group-hover:scale-125"
        style={{
          width: size * 1.33,
          height: size * 1.33,
          background:
            'radial-gradient(circle, rgb(var(--gold-rgb) / 0.55) 0%, rgb(var(--gold-rgb) / 0.22) 45%, transparent 70%)',
          filter: `blur(${Math.max(6, size * 0.18)}px)`,
        }}
      />
      <span
        className="relative flex items-center justify-center rounded-full transition-all duration-200"
        style={{
          width: size,
          height: size,
          background:
            'linear-gradient(180deg, var(--titanium-top) 0%, var(--titanium-mid) 52%, var(--titanium-bot) 100%)',
          border: '1.5px solid var(--titanium-border)',
          borderTopColor: 'var(--titanium-border-top)',
          boxShadow: [
            'inset 0 1.5px 0 var(--titanium-inner-hi)',
            'inset 0 -1.5px 0 var(--titanium-shine-bot)',
            `inset 0 0 ${size * 0.33}px var(--titanium-inner-lo)`,
            `0 0 ${size * 0.6}px rgb(var(--gold-rgb) / 0.32)`,
            `0 ${size * 0.21}px ${size * 0.55}px rgba(0,0,0,0.65)`,
          ].join(','),
        }}
      >
        {/* triangulo trazado, no relleno: centroide en 12,12 del viewBox, asi
            centra optico sin el margin-left que pide el path clasico de play */}
        <svg
          width={tri}
          height={tri}
          viewBox="0 0 24 24"
          style={{
            filter:
              'drop-shadow(0 0 8px rgb(var(--gold-rgb) / 0.75)) drop-shadow(0 0 16px rgb(var(--gold-rgb) / 0.4))',
          }}
        >
          <path
            d="M6 3.7 L20.1 12 L6 20.3 Z"
            fill="none"
            stroke="rgb(var(--gold-rgb))"
            strokeWidth={2.1}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}

/**
 * Detect if running as iOS PWA (standalone mode)
 */
function isIOSPWA(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS && isStandalone;
}

/**
 * VideoEmbed component - Embeds YouTube, Vimeo or Loom videos
 * Supports compact mode with custom purple play button
 */
export function VideoEmbed({ url, className = '', compact = false, fill = false, disablePlay = false }: VideoEmbedProps) {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoIdRef = useRef<string | null>(null);

  // Restaurar estado de reproducción desde sessionStorage
  const restorePlayingState = useCallback((videoId: string) => {
    try {
      const stored = sessionStorage.getItem(`${VIDEO_STATE_PREFIX}${videoId}`);
      if (stored === 'true') {
        setIsPlaying(true);
      }
    } catch {
      // sessionStorage no disponible
    }
  }, []);

  // Guardar estado de reproducción
  const savePlayingState = useCallback((videoId: string, playing: boolean) => {
    try {
      if (playing) {
        sessionStorage.setItem(`${VIDEO_STATE_PREFIX}${videoId}`, 'true');
      } else {
        sessionStorage.removeItem(`${VIDEO_STATE_PREFIX}${videoId}`);
      }
    } catch {
      // sessionStorage no disponible
    }
  }, []);

  // Manejar play con persistencia
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (videoIdRef.current) {
      savePlayingState(videoIdRef.current, true);
    }
  }, [savePlayingState]);

  useEffect(() => {
    // Deteccion de proveedor: fuente unica en @/shared/utils/videoUrl
    // (la comparten el modal "Añadir video" y la ficha del composer).

    // Fetch Loom thumbnail via oEmbed API (CDN URLs require a hash we can't guess)
    const fetchLoomThumbnail = async (shareUrl: string): Promise<string | undefined> => {
      try {
        const res = await fetch(`https://www.loom.com/v1/oembed?url=${encodeURIComponent(shareUrl)}`);
        if (!res.ok) return undefined;
        const data = await res.json();
        return data.thumbnail_url || undefined;
      } catch {
        return undefined;
      }
    };

    try {
      const info = parseVideoUrl(url);
      if (info.type === 'invalid') {
        setError('URL de video inválida. Solo se soporta video propio, YouTube, Vimeo y Loom.');
        setVideoInfo(null);
        videoIdRef.current = null;
      } else {
        setVideoInfo(info);
        setError(null);
        videoIdRef.current = info.videoId;
        restorePlayingState(info.videoId);

        // Fetch real Loom thumbnail via oEmbed (CDN requires hash we can't guess)
        if (info.type === 'loom' && info.originalUrl) {
          fetchLoomThumbnail(info.originalUrl).then((thumbUrl) => {
            if (thumbUrl) {
              setVideoInfo((prev) => prev ? { ...prev, thumbnailUrl: thumbUrl } : prev);
            }
          });
        }
      }
    } catch (err) {
      setError('Error al procesar la URL del video');
      setVideoInfo(null);
      videoIdRef.current = null;
    }
  }, [url, restorePlayingState]);

  if (error) {
    return (
      <div className={`glass-panel p-4 rounded-xl border border-error/30 ${className}`}>
        <div className="flex items-center gap-2 text-error">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!videoInfo) {
    return (
      <div className={`glass-panel p-8 rounded-xl border border-border/20 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Compact mode - Square thumbnail style like Skool (optimizes space)
  if (compact) {
    return (
      <div
        // 16:9 y no cuadrado. Un center-crop cuadrado de una miniatura de video
        // se come justo lo que la hace reconocible —el texto sobreimpreso suele
        // ir cerca de los bordes—, y el crítico del A/B lo marcó como el gap
        // que quedaba: el bloque le ganaba área al título sin aportar
        // información. A 76×43 cede área Y conserva el frame.
        className={`relative ${fill ? 'w-full h-full' : 'w-[76px] h-[43px] md:w-[96px] md:h-[54px]'} rounded-lg overflow-hidden bg-secondary/50 flex-shrink-0 opacity-[.72] hover:opacity-100 transition-opacity duration-[var(--t-normal)] ${className}`}
      >
        {!disablePlay && isPlaying ? (
          <iframe
            src={`${videoInfo.embedUrl}&autoplay=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            // @ts-expect-error - Legacy fullscreen attributes for older browsers
            webkitallowfullscreen="true"
            mozallowfullscreen="true"
            title="Video embed"
          />
        ) : (
          <div className="relative w-full h-full group">
            {/* Thumbnail */}
            {videoInfo.thumbnailUrl ? (
              <img
                src={videoInfo.thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback: hide broken image and show video icon
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  target.parentElement?.classList.add('bg-secondary', 'flex', 'items-center', 'justify-center');
                }}
              />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center">
                <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {/* Play Titaniumorphism: la miniatura del feed y el player son la misma pieza */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(0,0,0,0.12), rgba(0,0,0,0.5))',
              }}
            >
              <PlayButtonTitanium size={fill ? 56 : 34} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loom y video propio: iframe directo (skip thumbnail-first).
  // Ambos ya entregan play button + poster dentro de su propio iframe.
  // Evita el bug de GIF de 1MB que rompe la UX y el placeholder broken del browser.
  if (videoInfo.type === 'loom' || videoInfo.type === 'selfhosted') {
    const isSelfVideo = videoInfo.type === 'selfhosted';
    return (
      <div className={`glass-panel rounded-xl border border-border/20 overflow-hidden ${className}`}>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={isSelfVideo ? videoInfo.embedUrl : `${videoInfo.embedUrl}?hideEmbedTopBar=true`}
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            // @ts-expect-error - Legacy fullscreen attributes for older browsers
            webkitallowfullscreen="true"
            mozallowfullscreen="true"
            title={isSelfVideo ? 'Video' : 'Loom video'}
          />
        </div>
        {/* video propio NO lleva "Abrir video": el player ya esta completo dentro del
            iframe y abrir OTRA pestana encima del post solo estorba. */}
        {!isSelfVideo && videoInfo.originalUrl && (
          <a
            href={videoInfo.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 px-4 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground text-xs font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {isSelfVideo ? 'Abrir video' : 'Ver en Loom'}
          </a>
        )}
      </div>
    );
  }

  // Full size mode - 16:9 aspect ratio with thumbnail-first loading (YouTube/Vimeo)
  return (
    <div className={`glass-panel rounded-xl border border-border/20 overflow-hidden ${className}`}>
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        {isPlaying ? (
          <iframe
            src={`${videoInfo.embedUrl}&autoplay=1`}
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            // @ts-expect-error - Legacy fullscreen attributes for older browsers
            webkitallowfullscreen="true"
            mozallowfullscreen="true"
            title="Video embed"
          />
        ) : (
          <div
            className="absolute top-0 left-0 w-full h-full cursor-pointer group"
            onClick={handlePlay}
          >
            {videoInfo.thumbnailUrl ? (
              <img
                src={videoInfo.thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  target.parentElement?.classList.add('bg-secondary', 'flex', 'items-center', 'justify-center');
                }}
              />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center">
                <svg className="w-12 h-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {/* Play button overlay — mismo boton que el player de video propio */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-all"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(0,0,0,0.12), rgba(0,0,0,0.5))',
              }}
            >
              <PlayButtonTitanium size={66} />
            </div>
          </div>
        )}
      </div>
      {/* Always show "Watch on YouTube/Vimeo/Loom" link */}
      {videoInfo.originalUrl && (
        <a
          href={videoInfo.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2 px-4 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Ver en {videoInfo.type === 'youtube' ? 'YouTube' : videoInfo.type === 'vimeo' ? 'Vimeo' : 'Loom'}
        </a>
      )}
    </div>
  );
}
