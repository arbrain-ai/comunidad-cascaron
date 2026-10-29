'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import { FontSizeExtension } from './FontSizeExtension';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CodeBlockComponent } from './CodeBlockComponent';

// Highlight colors for marker/highlighter feature - vibrant colors for visibility
const HIGHLIGHT_COLORS = [
  { name: 'Amarillo', color: '#facc15' },
  { name: 'Naranja', color: '#fb923c' },
  { name: 'Morado', color: '#c084fc' },
  { name: 'Verde', color: '#4ade80' },
  { name: 'Azul', color: '#60a5fa' },
  { name: 'Rojo', color: '#f87171' },
];

// Initialize lowlight with common languages for syntax highlighting
const lowlight = createLowlight(common);
import { uploadPostAttachment } from '@/shared/lib/supabaseStorage';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { InputModal } from '@/shared/components/InputModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CarouselExtension } from './CarouselExtension';
import { ImageExtension } from './ImageExtension';
import { MultiVideoExtension } from './MultiVideoExtension';
import { useFocusModeSafe } from '@/shared/contexts/FocusModeContext';
import { FontSelector } from './FontSelector';

interface Attachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface PageEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
  initialAttachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
}

// Sortable image component for carousel modal
function SortableImage({ id, url, index, onRemove }: { id: string; url: string; index: number; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <img src={url} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded border-2 border-primary/20" />
      </div>
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 bg-error text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* Drag handle indicator */}
      <div className="absolute top-1 left-1 w-6 h-6 bg-primary/80 text-white rounded flex items-center justify-center text-xs font-bold">
        {index + 1}
      </div>
    </div>
  );
}

export function PageEditor({
  content,
  onChange,
  editable = true,
  initialAttachments = [],
  onAttachmentsChange,
}: PageEditorProps) {
  const { userProfile } = useUserProfile();
  const { isFocusMode } = useFocusModeSafe();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);

  // Sync attachments when initialAttachments changes (e.g., when switching lessons)
  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);

  // Track when we're programmatically setting content to avoid false change detection
  const isSyncingContent = useRef(false);

  // Modal states
  const [linkModal, setLinkModal] = useState(false);
  const [videoModal, setVideoModal] = useState(false);

  // Carousel modal
  const [carouselModal, setCarouselModal] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // DnD sensors for carousel reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCarouselImages((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle image upload
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!userProfile) {
      console.error('No user profile found');
      return null;
    }

    setIsUploading(true);
    try {
      const result = await uploadPostAttachment(userProfile.id, file);
      return result.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir imagen');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [userProfile]);

  // Global paste handler for carousel modal - captures Ctrl+V anywhere when modal is open
  useEffect(() => {
    if (!carouselModal) return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          e.stopPropagation();
          const file = items[i].getAsFile();
          if (file) {
            const url = await uploadImage(file);
            if (url) {
              setCarouselImages(prev => [...prev, url]);
            }
          }
        }
      }
    };

    // Use capture phase to intercept before editor gets it
    document.addEventListener('paste', handleGlobalPaste, true);
    return () => document.removeEventListener('paste', handleGlobalPaste, true);
  }, [carouselModal, uploadImage]);

  // Handle document upload (any file type)
  const uploadDocument = useCallback(async (file: File): Promise<string | null> => {
    if (!userProfile) {
      console.error('No user profile found');
      return null;
    }

    setIsUploadingDocument(true);
    try {
      const result = await uploadPostAttachment(userProfile.id, file);
      return result.url;
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error al subir archivo');
      return null;
    } finally {
      setIsUploadingDocument(false);
    }
  }, [userProfile]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        codeBlock: false, // Disable default code block to use CodeBlockLowlight
      }),
      TextStyle,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      FontSizeExtension,
      Highlight.configure({
        multicolor: true,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
      }).configure({ lowlight }),
      ImageExtension,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      MultiVideoExtension.configure({
        HTMLAttributes: {
          class: 'rounded-lg w-full aspect-video',
        },
      }),
      Placeholder.configure({
        placeholder: 'Empieza a escribir o pega una imagen...',
        showOnlyWhenEditable: true,
      }),
      CarouselExtension,
    ],
    content,
    editable,
    immediatelyRender: false, // Avoid SSR hydration mismatch
    onUpdate: ({ editor }) => {
      // Skip onChange during programmatic content sync to avoid false "dirty" state
      if (isSyncingContent.current) return;
      onChange(editor.getHTML());
    },
  });

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Mark as syncing to prevent onUpdate from triggering onChange
      isSyncingContent.current = true;

      // Use queueMicrotask to avoid flushSync error during render
      queueMicrotask(() => {
        editor.commands.setContent(content);

        // Reset sync flag after TipTap has processed the content
        // Use setTimeout to ensure onUpdate has fired and been ignored
        setTimeout(() => {
          isSyncingContent.current = false;
        }, 0);
      });
    }
  }, [editor, content]);


  // Handle paste event for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!editor || !editable) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const url = await uploadImage(file);
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }
      }
    }
  }, [editor, editable, uploadImage]);

  if (!editor) {
    return null;
  }

  // Trigger file input for image upload
  const addImage = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change (images)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = await uploadImage(file);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
      // Reset input
      e.target.value = '';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Handle document input change
  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = await uploadDocument(file);
      if (result) {
        // Add to attachments state
        const newAttachment = {
          url: result,
          name: file.name,
          size: file.size,
          type: file.type,
        };
        const updatedAttachments = [...attachments, newAttachment];
        setAttachments(updatedAttachments);

        // Notify parent component
        if (onAttachmentsChange) {
          onAttachmentsChange(updatedAttachments);
        }
      }
      // Reset input
      e.target.value = '';
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    const updatedAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(updatedAttachments);

    // Notify parent component
    if (onAttachmentsChange) {
      onAttachmentsChange(updatedAttachments);
    }
  };

  // Download attachment - force download instead of opening in new tab
  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name; // Force download with original filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url); // Clean up
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback: open in new tab if download fails
      window.open(attachment.url, '_blank');
    }
  };

  // Trigger document input
  const addDocument = () => {
    documentInputRef.current?.click();
  };

  const addLink = () => {
    setLinkModal(true);
  };

  const handleLinkConfirm = (url: string) => {
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addVideo = () => {
    setVideoModal(true);
  };

  const handleVideoConfirm = (url: string) => {
    if (url && editor) {
      editor.chain().focus().setMultiVideo({ src: url }).run();
    }
    setVideoModal(false);
  };

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden file input for document upload */}
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.json,.py,.js,.ts,.tsx,.jsx,.zip,.rar,.csv,.xlsx,.xls,.pptx,.ppt,.md,.html,.htm,.xml,.yaml,.yml,.toml,.env,.sh,.bash,.sql,.go,.rs,.rb,.php,.java,.c,.cpp,.h,.hpp,.css,.scss,.sass,.less,.svg,.webp,.gif,.mp3,.mp4,.wav,.mov,.avi,.mkv"
        onChange={handleDocumentChange}
        className="hidden"
      />

      {/* Toolbar - hidden in focus mode for clean presentation, scrollable on mobile */}
      {/* Headings via markdown: # H1, ## H2, ### H3, #### H4 */}
      {editable && !isFocusMode && (
        <div className="sticky top-0 z-10 flex items-center gap-1 p-2.5 bg-surface rounded-xl border border-primary/20 shadow-md overflow-x-auto scrollbar-hide md:flex-wrap">
          {/* Font Family Selector */}
          <FontSelector
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={(value) => {
              if (value) {
                editor.chain().focus().setFontFamily(value).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
            }}
          />

          {/* Font Size Selector */}
          <select
            value={editor.getAttributes('textStyle').fontSize || ''}
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().setFontSize(e.target.value).run();
              } else {
                editor.chain().focus().unsetFontSize().run();
              }
            }}
            className="px-2 py-1 text-xs rounded bg-surface border border-primary/20 hover:border-primary/40 focus:border-primary focus:outline-none transition-colors cursor-pointer min-w-[75px] flex-shrink-0"
            title="Tamaño de fuente"
          >
            <option value="">Tamaño</option>
            <option value="12px">12px</option>
            <option value="14px">14px</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="20px">20px</option>
            <option value="24px">24px</option>
            <option value="28px">28px</option>
            <option value="32px">32px</option>
            <option value="40px">40px</option>
            <option value="48px">48px</option>
          </select>

          <div className="w-px h-6 bg-primary/20 mx-1.5 flex-shrink-0" />

          {/* Formatting */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 text-sm font-bold rounded ${
              editor.isActive('bold')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Negrita (Ctrl+B)"
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 text-sm italic rounded ${
              editor.isActive('italic')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Cursiva (Ctrl+I)"
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`px-2 py-1 text-sm line-through rounded ${
              editor.isActive('strike')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Tachado (Ctrl+Shift+X)"
          >
            S
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`px-2 py-1 text-sm font-mono rounded ${
              editor.isActive('code')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Código inline (Ctrl+E)"
          >
            {'<>'}
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`px-2 py-1 text-sm font-mono rounded ${
              editor.isActive('codeBlock')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Bloque de código (Ctrl+Alt+C)"
          >
            {'{ }'}
          </button>

          <div className="w-px h-6 bg-primary/20 mx-1.5 flex-shrink-0" />

          {/* Highlight/Marker Tool */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Highlighter toggle button */}
            <button
              onClick={() => setShowHighlightColors(!showHighlightColors)}
              className={`p-1.5 rounded transition-colors ${
                showHighlightColors || editor.isActive('highlight')
                  ? 'bg-primary text-white'
                  : 'hover:bg-surface-hover text-muted hover:text-foreground'
              }`}
              title="Marcatextos"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18" />
              </svg>
            </button>

            {/* Color palette - only show when toggled */}
            {showHighlightColors && (
              <>
                {HIGHLIGHT_COLORS.map((hl) => (
                  <button
                    key={hl.color}
                    onClick={() => {
                      if (editor.isActive('highlight', { color: hl.color })) {
                        editor.chain().focus().unsetHighlight().run();
                      } else {
                        editor.chain().focus().toggleHighlight({ color: hl.color }).run();
                      }
                    }}
                    className={`w-6 h-6 rounded transition-all ${
                      editor.isActive('highlight', { color: hl.color })
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: hl.color }}
                    title={`Resaltar ${hl.name}`}
                  />
                ))}
                {/* Clear highlight button */}
                {editor.isActive('highlight') && (
                  <button
                    onClick={() => editor.chain().focus().unsetHighlight().run()}
                    className="w-6 h-6 rounded bg-surface border border-primary/30 flex items-center justify-center hover:bg-surface-hover transition-colors ml-0.5"
                    title="Quitar resaltado"
                  >
                    <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="w-px h-6 bg-primary/20 mx-1.5 flex-shrink-0" />

          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 text-sm rounded flex-shrink-0 ${
              editor.isActive('bulletList')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Lista con viñetas"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2 py-1 text-sm rounded flex-shrink-0 ${
              editor.isActive('orderedList')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Lista numerada"
          >
            1.
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-2 py-1 text-sm rounded flex-shrink-0 ${
              editor.isActive('blockquote')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover'
            }`}
            title="Cita / Bloque de texto"
          >
            &quot;
          </button>

          <div className="w-px h-6 bg-primary/20 mx-1.5 flex-shrink-0" />

          {/* Media */}
          <button
            onClick={addImage}
            disabled={isUploading}
            className={`p-1.5 rounded flex-shrink-0 hover:bg-surface-hover text-muted hover:text-foreground transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isUploading ? 'Subiendo imagen...' : 'Insertar imagen (clic o Ctrl+V)'}
          >
            {isUploading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <button
            onClick={addLink}
            className={`p-1.5 rounded flex-shrink-0 ${
              editor.isActive('link')
                ? 'bg-primary text-white'
                : 'hover:bg-surface-hover text-muted hover:text-foreground'
            }`}
            title="Insertar enlace web"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded flex-shrink-0 hover:bg-surface-hover text-muted hover:text-foreground"
            title="Insertar línea divisoria"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={addVideo}
            className="p-1.5 rounded flex-shrink-0 hover:bg-surface-hover text-muted hover:text-foreground"
            title="Insertar video (YouTube, Loom, Vimeo)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          <div className="w-px h-6 bg-primary/20 mx-1.5 flex-shrink-0" />

          {/* Carousel Button */}
          <button
            onClick={() => {
              // Save cursor position before opening modal
              if (editor) {
                savedSelectionRef.current = {
                  from: editor.state.selection.from,
                  to: editor.state.selection.to,
                };
              }
              setCarouselModal(true);
            }}
            className="p-1.5 rounded flex-shrink-0 hover:bg-surface-hover text-muted hover:text-foreground"
            title="Insertar carrousel de imágenes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>

          <div className="w-px h-6 bg-primary/20 mx-1.5 flex-shrink-0" />

          {/* Document Upload */}
          <button
            onClick={addDocument}
            disabled={isUploadingDocument}
            className={`p-1.5 rounded flex-shrink-0 hover:bg-surface-hover text-muted hover:text-foreground transition-colors ${isUploadingDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isUploadingDocument ? 'Subiendo archivo...' : 'Adjuntar documento (PDF, ZIP, código, etc.)'}
          >
            {isUploadingDocument ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Editor content - Notion-style */}
      <div>
        <EditorContent
          editor={editor}
          className={`
            font-sans
            prose prose-invert max-w-none
            prose-p:text-foreground
            prose-headings:text-foreground
            prose-h1:!text-[40px] prose-h1:!leading-[48px] prose-h1:!font-bold prose-h1:!mt-8 prose-h1:!mb-4
            prose-h2:!text-[32px] prose-h2:!leading-[40px] prose-h2:!font-semibold prose-h2:!mt-6 prose-h2:!mb-3
            prose-h3:!text-[24px] prose-h3:!leading-[32px] prose-h3:!font-semibold prose-h3:!mt-5 prose-h3:!mb-2
            prose-h4:!text-[20px] prose-h4:!leading-[28px] prose-h4:!font-medium prose-h4:!mt-4 prose-h4:!mb-2
            prose-strong:text-foreground
            prose-strong:font-black
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-code:text-foreground prose-code:bg-[var(--code-bg)] prose-code:border prose-code:border-[var(--code-border)]
            prose-pre:bg-[var(--code-bg)] prose-pre:border-2 prose-pre:border-[var(--code-border)] prose-pre:p-4 prose-pre:rounded-lg
            prose-blockquote:border-primary prose-blockquote:text-muted
            prose-li:text-foreground
            ${editable ? 'min-h-[300px] p-6 bg-surface rounded-xl border border-primary/20 focus-within:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-md' : ''}
            [&_.ProseMirror]:outline-none
            [&_.ProseMirror]:min-h-[250px]
            [&_.ProseMirror_p]:my-3
            [&_.ProseMirror_p]:text-foreground
            [&_.ProseMirror_p]:leading-relaxed
            [&_.ProseMirror_.is-editor-empty::before]:content-[attr(data-placeholder)]
            [&_.ProseMirror_.is-editor-empty::before]:text-muted/50
            [&_.ProseMirror_.is-editor-empty::before]:float-left
            [&_.ProseMirror_.is-editor-empty::before]:pointer-events-none
            [&_.ProseMirror_.is-editor-empty::before]:h-0
            [&_.ProseMirror_h1]:!text-3xl
            [&_.ProseMirror_h1]:!font-bold
            [&_.ProseMirror_h1]:text-foreground
            [&_.ProseMirror_h1]:!mt-8
            [&_.ProseMirror_h1]:!mb-4
            [&_.ProseMirror_h2]:!text-2xl
            [&_.ProseMirror_h2]:!font-semibold
            [&_.ProseMirror_h2]:text-foreground
            [&_.ProseMirror_h2]:!mt-6
            [&_.ProseMirror_h2]:!mb-3
            [&_.ProseMirror_h3]:!text-xl
            [&_.ProseMirror_h3]:!font-semibold
            [&_.ProseMirror_h3]:text-foreground
            [&_.ProseMirror_h3]:!mt-5
            [&_.ProseMirror_h3]:!mb-2
            [&_.ProseMirror_h4]:!text-lg
            [&_.ProseMirror_h4]:!font-medium
            [&_.ProseMirror_h4]:text-foreground
            [&_.ProseMirror_h4]:!mt-4
            [&_.ProseMirror_h4]:!mb-2
            [&_.ProseMirror_ul]:list-disc
            [&_.ProseMirror_ul]:pl-6
            [&_.ProseMirror_ul]:my-3
            [&_.ProseMirror_ol]:list-decimal
            [&_.ProseMirror_ol]:pl-6
            [&_.ProseMirror_ol]:my-3
            [&_.ProseMirror_li]:text-foreground
            [&_.ProseMirror_li]:my-1
            [&_.ProseMirror_blockquote]:border-l-4
            [&_.ProseMirror_blockquote]:border-primary
            [&_.ProseMirror_blockquote]:pl-4
            [&_.ProseMirror_blockquote]:py-2
            [&_.ProseMirror_blockquote]:my-4
            [&_.ProseMirror_blockquote]:italic
            [&_.ProseMirror_blockquote]:text-muted
            [&_.ProseMirror_strong]:font-black
            [&_.ProseMirror_code]:bg-[var(--code-bg)]
            [&_.ProseMirror_code]:border
            [&_.ProseMirror_code]:border-[var(--code-border)]
            [&_.ProseMirror_code]:px-1.5
            [&_.ProseMirror_code]:py-0.5
            [&_.ProseMirror_code]:rounded
            [&_.ProseMirror_code]:font-mono
            [&_.ProseMirror_code]:text-sm
            [&_.ProseMirror_code]:text-foreground
            [&_.ProseMirror_hr]:border-primary/20
            [&_.ProseMirror_hr]:my-6
            [&_.ProseMirror_mark]:px-1
            [&_.ProseMirror_mark]:py-0.5
            [&_.ProseMirror_mark]:rounded
            [&_.ProseMirror_mark]:text-gray-900
            [&_.ProseMirror_mark]:font-medium
            [&_.ProseMirror_[data-node-view-wrapper]]:my-6
            [&_.ProseMirror_[data-node-view-wrapper]]:block
            [&_.ProseMirror_img]:my-0
            [&_.ProseMirror_img]:rounded-xl
            [&_.ProseMirror_img]:border
            [&_.ProseMirror_img]:border-primary/20
            [&_.ProseMirror_img]:shadow-lg
            [&_.ProseMirror_img]:transition-all
            [&_.ProseMirror_img]:duration-200
            [&_.ProseMirror_img:hover]:shadow-glow-purple
            [&_.ProseMirror_img:hover]:border-primary/40
            [&_.ProseMirror_a]:text-primary
            [&_.ProseMirror_a]:transition-colors
            [&_.ProseMirror_a]:duration-150
            [&_.ProseMirror_a:hover]:text-primary-hover
            [&_.ProseMirror_a]:underline
            [&_.ProseMirror_a]:decoration-primary/30
            [&_.ProseMirror_a:hover]:decoration-primary
            [&_div[data-type="multi-video"]]:relative
            [&_div[data-type="multi-video"]]:w-full
            [&_div[data-type="multi-video"]]:pb-[56.25%]
            [&_div[data-type="multi-video"]]:h-0
            [&_div[data-type="multi-video"]]:overflow-hidden
            [&_div[data-type="multi-video"]]:rounded-xl
            [&_div[data-type="multi-video"]]:my-6
            [&_div[data-type="multi-video"]]:border
            [&_div[data-type="multi-video"]]:border-primary/30
            [&_div[data-type="multi-video"]]:bg-[#050505]
            [&_div[data-type="multi-video"]]:shadow-glow-purple
            [&_div[data-type="multi-video"]_iframe]:absolute
            [&_div[data-type="multi-video"]_iframe]:top-0
            [&_div[data-type="multi-video"]_iframe]:left-0
            [&_div[data-type="multi-video"]_iframe]:w-full
            [&_div[data-type="multi-video"]_iframe]:h-full
            [&_div[data-type="multi-video"]_iframe]:rounded-xl
            [&_div[data-type="multi-video"]_iframe]:border-0
          `}
        />
      </div>

      {/* Attachments Section - Below Editor */}
      {attachments.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-muted mb-3">Archivos adjuntos</h4>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                onClick={() => handleDownloadAttachment(attachment)}
                className="relative group flex-shrink-0 w-48 h-48 bg-surface-elevated rounded-lg overflow-hidden border border-primary/20 cursor-pointer hover:border-primary/50 transition-all"
              >
                {/* File Content */}
                <div className="w-full h-full flex flex-col items-center justify-center p-3">
                  {/* SVG Icon based on file type */}
                  <svg className="w-12 h-12 mb-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {attachment.type === 'application/pdf' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    ) : attachment.type.startsWith('image/') ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    )}
                  </svg>
                  <p className="text-xs text-center truncate w-full px-2 text-foreground">
                    {attachment.name.length > 15 ? attachment.name.substring(0, 12) + '...' : attachment.name}
                  </p>
                  <p className="text-3xs text-muted/70 mt-1">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>

                {/* Action Buttons - visible on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end gap-1.5 p-2">
                  {/* Download indicator */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>

                  {/* Remove Button - Only show in edit mode and not in focus mode */}
                  {editable && !isFocusMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent download when clicking X
                        handleRemoveAttachment(index);
                      }}
                      className="w-8 h-8 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <InputModal
        isOpen={linkModal}
        onClose={() => setLinkModal(false)}
        onConfirm={handleLinkConfirm}
        title="Insertar enlace"
        placeholder="https://ejemplo.com"
        label="URL"
        maxLength={500}
      />

      <InputModal
        isOpen={videoModal}
        onClose={() => setVideoModal(false)}
        onConfirm={handleVideoConfirm}
        title="Insertar Video"
        placeholder="YouTube, Loom o Vimeo URL..."
        label="URL del video"
        maxLength={500}
      />

      {/* Carousel Modal - captures all paste events when open */}
      {carouselModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onPaste={async (e) => {
            // Capture paste at modal level - prevents it from reaching editor
            e.stopPropagation();
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) {
                  const url = await uploadImage(file);
                  if (url) {
                    setCarouselImages(prev => [...prev, url]);
                  }
                }
              }
            }
          }}
        >
          <div className="bg-surface border border-primary/30 rounded-xl shadow-glass max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground">Insertar Carrousel de Imágenes</h3>
              <button
                onClick={() => {
                  setCarouselModal(false);
                  setCarouselImages([]);
                }}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Upload Area */}
            <div
              ref={(el) => el?.focus()} // Auto-focus to capture paste events
              tabIndex={0} // Make div focusable to receive paste events
              onClick={() => carouselInputRef.current?.click()}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation(); // ✅ Prevent event from bubbling to parent
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                for (const file of files) {
                  setIsUploading(true);
                  const url = await uploadImage(file);
                  if (url) {
                    setCarouselImages(prev => [...prev, url]);
                  }
                  setIsUploading(false);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onPaste={async (e) => {
                e.stopPropagation(); // ✅ Prevent event from bubbling to editor's handlePaste
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    setIsUploading(true);
                    const file = items[i].getAsFile();
                    if (file) {
                      const url = await uploadImage(file);
                      if (url) {
                        setCarouselImages(prev => [...prev, url]);
                      }
                    }
                    setIsUploading(false);
                  }
                }
              }}
              className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center mb-4 bg-surface-elevated hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer outline-none"
            >
              <svg className="w-12 h-12 mx-auto mb-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-foreground font-medium mb-1">Arrastra, pega (Ctrl+V) o haz clic</p>
              <p className="text-sm text-muted">Copia una imagen y pégala aquí directamente</p>
            </div>

            {/* Hidden file input */}
            <input
              ref={carouselInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                for (const file of files) {
                  const url = await uploadImage(file);
                  if (url) {
                    setCarouselImages(prev => [...prev, url]);
                  }
                }
                e.target.value = '';
              }}
              className="hidden"
            />

            {/* Preview Grid with Drag & Drop */}
            {carouselImages.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted mb-2">
                  {carouselImages.length} imagen(es) seleccionada(s) - Arrastra para reordenar
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={carouselImages} strategy={verticalListSortingStrategy}>
                    <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                      {carouselImages.map((url, index) => (
                        <SortableImage
                          key={url}
                          id={url}
                          url={url}
                          index={index}
                          onRemove={() => setCarouselImages(prev => prev.filter((_, i) => i !== index))}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setCarouselModal(false);
                  setCarouselImages([]);
                }}
                className="px-4 py-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (carouselImages.length > 0 && editor) {
                    // Restore cursor position before inserting
                    if (savedSelectionRef.current) {
                      editor.chain()
                        .focus()
                        .setTextSelection(savedSelectionRef.current.from)
                        .setCarousel(carouselImages)
                        .run();
                      savedSelectionRef.current = null;
                    } else {
                      editor.chain().focus().setCarousel(carouselImages).run();
                    }
                    setCarouselModal(false);
                    setCarouselImages([]);
                  }
                }}
                disabled={carouselImages.length === 0 || isUploading}
                className="btn-primary text-sm"
              >
                {isUploading ? 'Subiendo...' : 'Insertar Carrousel'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
