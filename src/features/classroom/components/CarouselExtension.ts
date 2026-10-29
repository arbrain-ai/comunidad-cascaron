import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CarouselNodeView } from './CarouselNodeView';

export interface CarouselOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    carousel: {
      /**
       * Add a carousel with images
       */
      setCarousel: (images: string[]) => ReturnType;
    };
  }
}

export const CarouselExtension = Node.create<CarouselOptions>({
  name: 'carousel',

  group: 'block',

  draggable: true,

  atom: true, // This node is atomic - no content inside

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: element => {
          const images = element.getAttribute('data-images');
          return images ? JSON.parse(images) : [];
        },
        renderHTML: attributes => {
          return {
            'data-images': JSON.stringify(attributes.images),
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
        tag: 'div[data-type="carousel"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'carousel' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CarouselNodeView);
  },

  addCommands() {
    return {
      setCarousel:
        (images: string[]) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              images,
            },
          });
        },
    };
  },
});
