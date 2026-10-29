import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from './ImageNodeView';

export interface ImageOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customImage: {
      /**
       * Add an image with lightbox support
       */
      setImage: (options: { src: string; alt?: string }) => ReturnType;
    };
  }
}

export const ImageExtension = Node.create<ImageOptions>({
  name: 'customImage',

  group: 'block',

  draggable: true,

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => {
          return {
            src: attributes.src,
          };
        },
      },
      alt: {
        default: null,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => {
          return {
            alt: attributes.alt,
          };
        },
      },
      size: {
        default: 'medium',
        parseHTML: element => element.getAttribute('data-size') || 'medium',
        renderHTML: attributes => {
          return {
            'data-size': attributes.size,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="custom-image"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'custom-image' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              alt: options.alt || '',
            },
          });
        },
    };
  },
});
