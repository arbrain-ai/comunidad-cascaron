'use client';

import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { SELF_VIDEO_URL_REGEX, selfVideoEmbedUrl } from '@/shared/utils/selfVideo';

/**
 * Detects YouTube, Vimeo, Loom or Video and returns embed URL
 */
function getVideoEmbedUrl(url: string): { embedUrl: string; platform: string } | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // video propio patterns (ver src/shared/utils/selfVideo.ts)
  const selfVideoMatch = url.match(SELF_VIDEO_URL_REGEX);
  if (selfVideoMatch && selfVideoMatch[1]) {
    return {
      embedUrl: selfVideoEmbedUrl(selfVideoMatch[1]),
      platform: 'selfhosted',
    };
  }

  // YouTube patterns
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);

  if (youtubeMatch && youtubeMatch[1]) {
    return {
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?playsinline=1`,
      platform: 'youtube',
    };
  }

  if (url.includes('youtube.com/embed/')) {
    const hasPlaysinline = url.includes('playsinline=');
    return {
      embedUrl: hasPlaysinline ? url : `${url}${url.includes('?') ? '&' : '?'}playsinline=1`,
      platform: 'youtube'
    };
  }

  // Loom patterns
  const loomShareMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomShareMatch && loomShareMatch[1]) {
    return {
      embedUrl: `https://www.loom.com/embed/${loomShareMatch[1]}`,
      platform: 'loom',
    };
  }

  const loomEmbedMatch = url.match(/loom\.com\/embed\/([a-zA-Z0-9]+)/);
  if (loomEmbedMatch && loomEmbedMatch[1]) {
    return {
      embedUrl: url,
      platform: 'loom',
    };
  }

  // Vimeo patterns
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?playsinline=1`,
      platform: 'vimeo',
    };
  }

  if (url.includes('player.vimeo.com/video/')) {
    return {
      embedUrl: url,
      platform: 'vimeo',
    };
  }

  return null;
}

export function MultiVideoNodeView({ node, deleteNode, selected }: NodeViewProps) {
  const { src, platform } = node.attrs;
  const embedData = getVideoEmbedUrl(src);

  if (!embedData) {
    return (
      <NodeViewWrapper data-drag-handle draggable="true" contentEditable={false}>
        <div className="p-4 border-2 border-dashed border-error/30 rounded-lg text-center text-error">
          URL de video no válida. Soportamos video propio, YouTube, Loom y Vimeo.
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="relative group my-6"
      data-drag-handle
      draggable="true"
      contentEditable={false}
      data-type="multi-video"
      data-platform={platform}
    >
      {/* Video Container */}
      <div className="relative w-full pb-[56.25%] h-0 overflow-hidden rounded-xl border border-primary/30 bg-[#050505] shadow-[0_0_30px_rgba(104,58,204,0.15)]">
        <iframe
          src={embedData.embedUrl}
          className="absolute top-0 left-0 w-full h-full rounded-xl border-0"
          allowFullScreen
          // @ts-expect-error - Legacy fullscreen attributes for older browsers
          webkitallowfullscreen="true"
          mozallowfullscreen="true"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          title="Video embed"
        />
      </div>

      {/* Delete Button (only when selected in edit mode) */}
      {selected && (
        <button
          onClick={deleteNode}
          className="absolute -top-2 -right-2 w-8 h-8 bg-error text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-30"
          aria-label="Eliminar video"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </NodeViewWrapper>
  );
}
