import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MultiVideoNodeView } from './MultiVideoNodeView';
import { SELF_VIDEO_URL_REGEX, selfVideoEmbedUrl } from '@/shared/utils/selfVideo';

export interface MultiVideoOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    multiVideo: {
      /**
       * Add a video (YouTube, Loom, or Vimeo)
       */
      setMultiVideo: (options: { src: string }) => ReturnType;
    };
  }
}

/**
 * Detects YouTube, Loom, Vimeo or Video and returns embed URL
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
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      platform: 'youtube',
    };
  }

  if (url.includes('youtube.com/embed/')) {
    return { embedUrl: url, platform: 'youtube' };
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
    return { embedUrl: url, platform: 'loom' };
  }

  // Vimeo patterns
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      platform: 'vimeo',
    };
  }

  if (url.includes('player.vimeo.com/video/')) {
    return { embedUrl: url, platform: 'vimeo' };
  }

  return null;
}

export const MultiVideoExtension = Node.create<MultiVideoOptions>({
  name: 'multiVideo',

  group: 'block',

  draggable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'rounded-lg w-full aspect-video',
      },
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => {
          // First try data-src (new format)
          const dataSrc = element.getAttribute('data-src');
          if (dataSrc) return dataSrc;

          // Fallback: read src from iframe child (old format with data-youtube-video)
          const iframe = element.querySelector('iframe');
          if (iframe) {
            return iframe.getAttribute('src');
          }

          return null;
        },
        renderHTML: attributes => {
          return {
            src: attributes.src,
          };
        },
      },
      platform: {
        default: 'youtube',
        parseHTML: element => element.getAttribute('data-platform'),
        renderHTML: attributes => {
          return {
            'data-platform': attributes.platform,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="multi-video"]',
      },
      // Also parse existing youtube embeds for backwards compatibility
      {
        tag: 'div[data-youtube-video]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const embedData = getVideoEmbedUrl(HTMLAttributes.src);

    if (!embedData) {
      return ['div', { class: 'text-red-500' }, 'URL de video no válida. Soportamos YouTube, Loom y Vimeo.'];
    }

    const { embedUrl, platform } = embedData;

    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'multi-video',
          'data-platform': platform,
          'data-src': embedUrl, // ✅ Store src on parent div for parseHTML
          class: 'relative w-full pb-[56.25%] h-0 overflow-hidden rounded-xl my-6 border border-primary/30 bg-[#050505] shadow-[0_0_30px_rgba(104,58,204,0.15)]',
        },
        this.options.HTMLAttributes
      ),
      [
        'iframe',
        {
          src: embedUrl,
          class: 'absolute top-0 left-0 w-full h-full rounded-xl border-0',
          allowfullscreen: 'true',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        },
      ],
    ];
  },

  addCommands() {
    return {
      setMultiVideo:
        (options: { src: string }) =>
        ({ commands }) => {
          const embedData = getVideoEmbedUrl(options.src);

          if (!embedData) {
            // Invalid URL - show error or do nothing
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs: {
              src: embedData.embedUrl,
              platform: embedData.platform,
            },
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MultiVideoNodeView);
  },
});
