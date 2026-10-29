'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { ReactRenderer } from '@tiptap/react';
import { nodePasteRule } from '@tiptap/core';
import { liftListItem, splitListItem } from '@tiptap/pm/schema-list';
import { Fragment, Slice } from '@tiptap/pm/model';
import tippy, { Instance as TippyInstance } from 'tippy.js';

// Extend Mention so that pasted text matching `@[Label](uuid)` becomes a chip.
// Example paste: `@[Ana López](00000000-0000-0000-0000-000000000000)`
// Native HTML paste with <span data-type="mention"> already works via default parseHTML.
const MentionWithPasteRule = Mention.extend({
  addPasteRules() {
    return [
      nodePasteRule({
        find: /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g,
        type: this.type,
        getAttributes: (match) => ({
          id: match[2],
          label: match[1],
        }),
      }),
    ];
  },
});

// Syntax highlighting for code blocks (same as PageEditor)
const lowlight = createLowlight(common);
import { MentionList, MentionListRef } from './MentionList';
import { searchMentionableUsers } from '@/features/community/services/communityService';
import { MentionableUser } from '@/features/community/types';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

interface MentionEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxLength?: number;
  autoFocus?: boolean;
  onSubmit?: () => void;
  compact?: boolean;
  /** Toolbar de formato visible (bold/italic/listas/etc). TipTap siempre tuvo
   *  los marks pero solo por atajos de markdown ocultos — en móvil eran
   *  indescubribles (hallazgo #10 del audit de Community). */
  showToolbar?: boolean;
  /** Categoría del post en edición (se acepta por compatibilidad; la búsqueda de menciones no la usa) */
  categoryId?: string | null;
}

// ============================================================
// FormatToolbar — formato descubrible para el composer
// ============================================================
// onMouseDown.preventDefault en cada botón: evita robarle el focus al editor
// (y en móvil evita que el teclado se cierre al tocar un botón).
function ToolbarButton({
  active,
  onRun,
  label,
  children,
}: {
  active: boolean;
  onRun: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`min-w-[32px] h-8 px-1.5 rounded-md flex items-center justify-center text-sm transition-colors ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted hover:text-foreground hover:bg-surface'
      }`}
    >
      {children}
    </button>
  );
}

function FormatToolbar({ editor }: { editor: Editor }) {
  // Forzar re-render en cada transacción para que isActive() refleje la
  // selección actual (React no observa el estado interno de TipTap).
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    editor.on('transaction', update);
    editor.on('selectionUpdate', update);
    return () => {
      editor.off('transaction', update);
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 pb-1.5 mb-1 border-b border-glass overflow-x-auto">
      <ToolbarButton
        active={editor.isActive('bold')}
        onRun={() => editor.chain().focus().toggleBold().run()}
        label="Negrita"
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onRun={() => editor.chain().focus().toggleItalic().run()}
        label="Cursiva"
      >
        <span className="italic font-serif">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('strike')}
        onRun={() => editor.chain().focus().toggleStrike().run()}
        label="Tachado"
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <div className="w-px h-5 bg-glass mx-0.5 flex-shrink-0" />
      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onRun={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Título"
      >
        <span className="font-semibold text-xs">H2</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('heading', { level: 3 })}
        onRun={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Subtítulo"
      >
        <span className="font-semibold text-xs">H3</span>
      </ToolbarButton>
      <div className="w-px h-5 bg-glass mx-0.5 flex-shrink-0" />
      <ToolbarButton
        active={editor.isActive('bulletList')}
        onRun={() => editor.chain().focus().toggleBulletList().run()}
        label="Lista"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h.01M4 12h.01M4 18h.01M8 6h12M8 12h12M8 18h12" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onRun={() => editor.chain().focus().toggleOrderedList().run()}
        label="Lista numerada"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        </svg>
      </ToolbarButton>
      <div className="w-px h-5 bg-glass mx-0.5 flex-shrink-0" />
      <ToolbarButton
        active={editor.isActive('blockquote')}
        onRun={() => editor.chain().focus().toggleBlockquote().run()}
        label="Cita"
      >
        <span className="font-serif text-base leading-none">&rdquo;</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('codeBlock')}
        onRun={() => editor.chain().focus().toggleCodeBlock().run()}
        label="Bloque de código"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

// Exposed methods via ref
export interface MentionEditorRef {
  insertContent: (content: string) => void;
  focus: () => void;
}

export const MentionEditor = forwardRef<MentionEditorRef, MentionEditorProps>(function MentionEditor({
  content,
  onChange,
  placeholder = 'Escribe algo...',
  minHeight = '100px',
  maxLength = 5000,
  autoFocus = false,
  onSubmit,
  compact = false,
  showToolbar = false,
}, ref) {
  const [charCount, setCharCount] = useState(0);
  // Track if mention suggestion popup is open
  const isMentionOpenRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false, // Replaced by CodeBlockLowlight below
        horizontalRule: false,
        // Listas habilitadas con input rules (*, -, + al inicio = bullet)
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      MentionWithPasteRule.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          char: '@',
          // Permite escribir espacios sin cerrar el dropdown ("@ana lopez").
          // searchMentionableUsers ya soporta multi-palabra via ILIKE %query%.
          allowSpaces: true,
          items: async ({ query }) => searchMentionableUsers(query),
          render: () => {
            let component: ReactRenderer<MentionListRef, { items: MentionableUser[]; command: (item: MentionableUser) => void }>;
            let popup: TippyInstance[];

            return {
              onStart: (props) => {
                isMentionOpenRef.current = true;
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate(props) {
                component.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }

                return component.ref?.onKeyDown(props) || false;
              },

              onExit() {
                isMentionOpenRef.current = false;
                popup[0].destroy();
                component.destroy();
              },
            };
          },
          command: ({ editor, range, props }) => {
            const user = props as unknown as MentionableUser;

            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: 'mention',
                  attrs: {
                    id: user.id,
                    label: user.full_name,
                  },
                },
                {
                  type: 'text',
                  text: ' ',
                },
              ])
              .run();
          },
        },
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none',
        style: `min-height: ${minHeight}`,
      },
      // Normalize pasted plain text: single \n → space, \n\n → paragraph break.
      // Fixes AI output paste where line-wrapped text becomes separate paragraphs.
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const html = clipboardData.getData('text/html');
        const text = clipboardData.getData('text/plain');

        // Only normalize plain text paste (rich HTML is handled by TipTap default)
        if (!text || html) return false;

        // Don't normalize inside code blocks
        const { $from } = view.state.selection;
        if ($from.parent.type.name === 'codeBlock') return false;

        event.preventDefault();

        // Normalize: \n\n = paragraph break, single \n = space
        const paragraphs = text
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .split('\n\n')
          .map(para => para.replace(/\n/g, ' ').trim())
          .filter(para => para.length > 0);

        if (paragraphs.length === 0) return true;

        const { schema } = view.state;
        const nodes = paragraphs.map(p =>
          schema.nodes.paragraph.create(null, p ? schema.text(p) : null)
        );

        const fragment = Fragment.from(nodes);
        const tr = view.state.tr.replaceSelection(new Slice(fragment, 0, 0));
        view.dispatch(tr);

        return true;
      },
      handleKeyDown: (view, event) => {
        // Si el popup de menciones está abierto, dejar que TipTap maneje las teclas
        if (isMentionOpenRef.current) {
          return false;
        }

        // Backspace al inicio de un list item vacío → salir de la lista
        if (event.key === 'Backspace') {
          const { state } = view;
          const { $from } = state.selection;

          // Verificar si estamos en un listItem
          const listItem = $from.node(-1);
          const isInList = listItem?.type.name === 'listItem';

          if (isInList) {
            // Verificar si el cursor está al inicio del item y si está vacío
            const isAtStart = $from.parentOffset === 0;
            const isEmpty = $from.parent.content.size === 0;

            if (isAtStart && isEmpty) {
              // Usar el comando de ProseMirror para salir de la lista
              const listItemType = state.schema.nodes.listItem;
              if (listItemType) {
                const lift = liftListItem(listItemType);
                if (lift(state, view.dispatch)) {
                  return true;
                }
              }
            }
          }
        }

        // Shift+Enter en lista → nuevo bullet point (en lugar de salto de línea)
        if (event.key === 'Enter' && event.shiftKey) {
          const { state } = view;
          const { $from } = state.selection;
          const listItem = $from.node(-1);
          const isInList = listItem?.type.name === 'listItem';

          if (isInList) {
            const listItemType = state.schema.nodes.listItem;
            if (listItemType) {
              const split = splitListItem(listItemType);
              if (split(state, view.dispatch)) {
                return true;
              }
            }
          }
        }

        // Enter key handling
        if (event.key === 'Enter' && onSubmit) {
          // Detect mobile: touch device or small screen (same logic as MessageInput)
          const isMobile = 'ontouchstart' in window || window.innerWidth < 768;

          if (isMobile) {
            // Mobile: Enter = new line (let default behavior happen)
            // User must use the send button to submit
            return false;
          } else {
            // Desktop: Enter = submit, Shift+Enter = new line
            if (!event.shiftKey) {
              event.preventDefault();
              onSubmit();
              return true;
            }
          }
        }
        // Shift+Enter fuera de lista permite salto de línea (comportamiento por defecto)
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Actualizar contador
      const text = editor.getText();
      setCharCount(text.length);
      // SIEMPRE sincronizar con el padre: el estado del form debe reflejar
      // EXACTAMENTE lo que el usuario ve en el editor. Antes descartábamos los
      // updates que pasaban de maxLength, lo que congelaba el estado en un
      // snapshot parcial mientras el editor seguía mostrando el texto completo
      // -> el post (y el email de anuncio) salían truncados sin aviso. El límite
      // ahora se valida al publicar (PostForm), nunca descartando input en silencio.
      onChange(html);
    },
  });

  // Expose methods via ref for external use (e.g., emoji insertion)
  useImperativeHandle(ref, () => ({
    insertContent: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    },
    focus: () => {
      if (editor) {
        editor.commands.focus('end');
      }
    },
  }), [editor]);

  // Sync content when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      setCharCount(editor.getText().length);
    }
  }, [content, editor]);

  // Initialize charCount on editor creation
  useEffect(() => {
    if (editor) {
      setCharCount(editor.getText().length);
    }
  }, [editor]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && editor) {
      setTimeout(() => {
        editor.commands.focus();
      }, 100);
    }
  }, [autoFocus, editor]);

  if (!editor) {
    return (
      <div
        className="bg-surface rounded-lg border border-border/30 p-4 animate-pulse"
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className="relative">
      {showToolbar && <FormatToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className={`
          bg-transparent
          [&_.ProseMirror]:outline-none
          [&_.ProseMirror:focus]:shadow-none
          [&_.ProseMirror:focus-visible]:shadow-none
          [&_.ProseMirror_p]:mb-4
          [&_.ProseMirror_p:first-child]:mt-0
          [&_.ProseMirror_p:last-child]:mb-0
          [&_.mention]:text-primary
          [&_.mention]:font-medium
          [&_.mention]:bg-primary/10
          [&_.mention]:px-1
          [&_.mention]:py-0.5
          [&_.mention]:rounded
          [&_.editor-link]:text-primary
          [&_.editor-link]:underline
          [&_.editor-link]:underline-offset-2
          [&_.editor-link]:decoration-primary/40
          hover:[&_.editor-link]:decoration-primary
          [&_a]:text-primary
          [&_a]:underline
          [&_a]:underline-offset-2
          [&_a]:decoration-primary/40
          hover:[&_a]:decoration-primary
          [&_ul]:list-disc
          [&_ul]:pl-5
          [&_ul]:my-3
          [&_ol]:list-decimal
          [&_ol]:pl-5
          [&_ol]:my-3
          [&_li]:my-0.5
          [&_h2]:text-lg
          [&_h2]:font-semibold
          [&_h2]:mt-6
          [&_h2]:mb-2
          [&_h3]:text-base
          [&_h3]:font-semibold
          [&_h3]:mt-5
          [&_h3]:mb-2
          [&_pre]:bg-black/30
          [&_pre]:rounded-lg
          [&_pre]:p-3
          [&_pre]:my-3
          [&_pre]:overflow-x-auto
          [&_pre]:text-sm
          [&_pre_code]:bg-transparent
          [&_pre_code]:p-0
          [&_code]:bg-white/10
          [&_code]:px-1.5
          [&_code]:py-0.5
          [&_code]:rounded
          [&_code]:text-sm
          [&_code]:font-mono
          [&_blockquote]:border-l-2
          [&_blockquote]:border-primary/50
          [&_blockquote]:pl-3
          [&_blockquote]:my-2
          [&_blockquote]:text-muted
          [&_blockquote]:italic
          [&_.ProseMirror_.is-empty::before]:content-[attr(data-placeholder)]
          [&_.ProseMirror_.is-empty::before]:text-muted/50
          [&_.ProseMirror_.is-empty::before]:float-left
          [&_.ProseMirror_.is-empty::before]:pointer-events-none
          [&_.ProseMirror_.is-empty::before]:h-0
        `}
      />

      {/* Character counter - hidden in compact mode */}
      {maxLength && !compact && (
        <div className="absolute bottom-2 right-3 text-xs text-muted">
          <span className={charCount > maxLength * 0.9 ? 'text-warning' : ''}>
            {charCount}
          </span>
          /{maxLength}
        </div>
      )}
    </div>
  );
});
