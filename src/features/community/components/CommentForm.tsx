'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CreateCommentInput, PostAttachment } from '../types';
import { MentionEditor, MentionEditorRef } from '@/shared/components/MentionEditor';
import { enrichPlainMentions, hasUnresolvedPlainMention } from '../services/mentionEnrichment';
import { GifPicker } from '@/shared/components/GifPicker';
import { EmojiPicker } from '@/shared/components/EmojiPicker';
import { AttachmentUploader } from './AttachmentUploader';
import { VideoUrlModal } from './VideoUrlModal';
import { firstVideoEmbedUrl, isVideoEmbedMedia, videoEmbedAttachment } from '@/shared/utils/mediaType';
import { uploadPostAttachment } from '@/shared/lib/supabaseStorage';
import { useUserProfile } from '@/contexts/UserProfileContext';

// Mención inicial para pre-llenar cuando se responde a una respuesta
interface InitialMention {
  userId: string;
  userName: string;
}

// Info para header contextual "Respondiendo a X"
interface ReplyingTo {
  userName: string;
}

interface CommentFormProps {
  postId?: string;                        // For community posts (Exclusive Arc)
  lessonId?: string;                      // For classroom lessons (Exclusive Arc)
  parentId?: string | null;
  userId?: string;
  onSubmit: (input: CreateCommentInput) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  categoryId?: string | null;
  initialMention?: InitialMention | null;
  replyingTo?: ReplyingTo | null;        // Header contextual
  onCancelReply?: () => void;             // Callback para cerrar header
  isPinned?: boolean;                     // Si el post está fijado (para color del botón)
}

export function CommentForm({
  postId,
  lessonId,
  parentId,
  userId,
  onSubmit,
  onCancel,
  isSubmitting = false,
  placeholder = 'Comentar...',
  autoFocus = false,
  categoryId = null,
  initialMention = null,
  replyingTo = null,
  onCancelReply,
  isPinned = false,
}: CommentFormProps) {
  // Determine context (for form ID and submission)
  const contextId = lessonId || postId || 'unknown';
  const contextType = lessonId ? 'lesson' : 'post';
  const { userProfile } = useUserProfile();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Ref for editor (to insert emojis)
  const editorRef = useRef<MentionEditorRef>(null);

  // Draft persistence: clave única por contexto + parent (top-level vs reply)
  const draftKey = `comment-draft:${contextType}:${contextId}:${parentId || 'root'}`;
  const [draftHydrated, setDraftHydrated] = useState(false);

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  // Hidratar draft al montar (skip si es un reply nuevo con mención pre-llenada)
  useEffect(() => {
    if (typeof window === 'undefined') {
      setDraftHydrated(true);
      return;
    }
    if (initialMention) {
      setDraftHydrated(true);
      return;
    }
    const saved = window.localStorage.getItem(draftKey);
    if (!saved) {
      setDraftHydrated(true);
      return;
    }

    let cancelled = false;
    enrichPlainMentions(saved)
      .then((enriched) => {
        if (cancelled) return;
        // TipTap mention only triggers on real keystrokes, not setContent.
        // If the draft still has plain "@nombre" after enrichment, restoring
        // it would render text that looks like a mention but never becomes
        // one. Discard the draft so the editor starts empty and the next
        // keystroke can re-trigger the suggestion popup.
        if (hasUnresolvedPlainMention(enriched)) {
          window.localStorage.removeItem(draftKey);
          setContent('');
        } else {
          setContent(enriched);
        }
        setDraftHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setContent(saved);
        setDraftHydrated(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Persistir cambios silenciosamente (solo después de hidratar para evitar borrar el draft recién leído)
  useEffect(() => {
    if (!draftHydrated || typeof window === 'undefined') return;
    const text = content.replace(/<[^>]*>/g, '').trim();
    if (text) {
      window.localStorage.setItem(draftKey, content);
    } else {
      window.localStorage.removeItem(draftKey);
    }
  }, [content, draftKey, draftHydrated]);

  // Pre-llenar con mención cuando se responde a una respuesta
  // Single effect: eliminates the race condition of the dual-effect approach
  useEffect(() => {
    if (initialMention) {
      const mentionHtml = `<span data-type="mention" data-id="${initialMention.userId}" data-label="${initialMention.userName}" class="mention">@${initialMention.userName}</span>&nbsp;`;
      setContent(mentionHtml);
      // Wait for editor to sync the content, then focus at end
      const timer = setTimeout(() => {
        editorRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [initialMention?.userId]);

  // Media state: una sola bandeja (imagenes, GIFs, videos, archivos) ordenable.
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const hasVideo = attachments.some(isVideoEmbedMedia);
  const hasGif = attachments.some(a => a.type === 'image/gif');
  const addMedia = useCallback((item: PostAttachment) => {
    setAttachments(prev => (prev.some(a => a.url === item.url) ? prev : [...prev, item]));
    setShowAttachments(true);
  }, []);

  // Handle clipboard paste for images only - text pastes handled by MentionEditor
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!userId) return;

    // Only intercept if clipboard contains image files
    const files: File[] = [];
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
    }

    // No images = let MentionEditor handle the paste (text, HTML, etc.)
    if (files.length === 0) return;

    e.preventDefault();
    e.stopPropagation();
    try {
      const newAttachments: PostAttachment[] = [];
      for (const file of files) {
        const result = await uploadPostAttachment(userId, file);
        newAttachments.push(result);
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      setShowAttachments(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al pegar imagen');
    }
  }, [userId]);

  // Handle submit from editor (Enter key)
  const handleEditorSubmit = useCallback(() => {
    if (content.trim() || attachments.length) {
      const form = document.getElementById(`comment-form-${contextId}-${parentId || 'root'}`) as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }
  }, [content, attachments.length, contextId, parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim() && !attachments.length) {
      setError('El comentario no puede estar vacío');
      return;
    }

    try {
      // Convert any plain "@nombre" with a unique profile match into a chip.
      // No-op when the user already picked from the dropdown.
      const enrichedContent = await enrichPlainMentions(content.trim());

      // Build input with correct context (Exclusive Arc)
      const input: CreateCommentInput = {
        content: enrichedContent,
        parent_id: parentId || null,
        media_urls: attachments.length > 0 ? attachments : undefined,
        // Espejo del PRIMER video de la bandeja (lo que ya lee CommentCard y demas)
        video_embed_url: firstVideoEmbedUrl(attachments),
      };

      // Set the appropriate context ID (post_id OR lesson_id)
      if (contextType === 'lesson' && lessonId) {
        input.lesson_id = lessonId;
      } else if (postId) {
        input.post_id = postId;
      }

      await onSubmit(input);

      // Reset form
      setContent('');
      setAttachments([]);
      setShowAttachments(false);
      clearDraft();
    } catch (err) {
      console.error('Error creating comment:', err);
      const code = (err as Record<string, unknown>)?.code;
      if (code === '42501' || code === 'PGRST301') {
        setError('Tu sesión expiró. Recarga la página para continuar.');
      } else {
        setError('Error al publicar el comentario. Inténtalo de nuevo.');
      }
    }
  };

  const hasMedia = attachments.length > 0;

  // Check if there's content to send (for showing send button)
  // Strip HTML tags to check actual text content
  const textContent = content.replace(/<[^>]*>/g, '').trim();
  const hasContent = textContent || attachments.length > 0;

  // Handler para cancelar reply (limpia form completo)
  const handleCancelReplyClick = () => {
    setContent('');
    setAttachments([]);
    setShowAttachments(false);
    clearDraft();
    onCancelReply?.();
  };

  return (
    <div className="space-y-0">
      {/* Header contextual "Respondiendo a X" */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-surface/80 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>
              Respondiendo a{' '}
              <span className="text-foreground font-medium">{replyingTo.userName}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelReplyClick}
            className="p-1 text-muted hover:text-foreground hover:bg-surface rounded transition-colors"
            title="Cancelar respuesta"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form
        id={`comment-form-${contextId}-${parentId || 'root'}`}
        onSubmit={handleSubmit}
        onPaste={handlePaste}
        className="space-y-2 px-3 py-2"
      >
        {/* Main input container - Skool style 2-row layout */}
        <div className="comment-composer space-y-2 rounded-xl border border-border bg-card p-2.5 shadow-elevation-xs backdrop-blur-sm transition-all duration-fast ease-out-expo focus-within:bg-card">
          {/* Row 1: Avatar + Input (input takes full width) */}
          <div className="flex items-start gap-3">
            {/* User Avatar with level badge - hidden on mobile (user sees their avatar in bottom nav) */}
            <div className="relative flex-shrink-0 hidden sm:block">
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={userProfile.full_name || 'User'}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary text-sm font-semibold">
                    {userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              {/* Level badge - Skool style */}
              {userProfile?.current_level && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center border-2 border-surface">
                  <span className="text-3xs font-bold text-white">{userProfile.current_level}</span>
                </div>
              )}
            </div>

            {/* Input area - takes full remaining width */}
            <div className="flex-1 min-w-0">
              <MentionEditor
                ref={editorRef}
                content={content}
                onChange={setContent}
                placeholder={placeholder}
                minHeight="20px"
                maxLength={1000}
                autoFocus={autoFocus}
                onSubmit={handleEditorSubmit}
                compact
                categoryId={categoryId}
              />
            </div>
          </div>

          {/* Row 2: Icons + Buttons (Skool style) */}
          <div className="flex items-center justify-between sm:pl-11">
            {/* Left side: Action icons */}
            <div className="flex items-center gap-1">
              {/* Attachment - visible on all screens */}
              <button
                type="button"
                onClick={() => setShowAttachments(!showAttachments)}
                className={`p-1.5 rounded-lg transition-all duration-fast ease-out-expo ${attachments.length > 0 ? 'text-foreground bg-card-active border border-border' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
                title="Adjuntar archivo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Link - hidden on mobile */}
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                className={`hidden sm:block p-1.5 rounded-lg transition-all duration-fast ease-out-expo ${hasVideo ? 'text-foreground bg-card-active border border-border' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
                title="Añadir enlace"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>

              {/* Video camera - hidden on mobile */}
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                className={`hidden sm:block p-1.5 rounded-lg transition-all duration-fast ease-out-expo ${hasVideo ? 'text-foreground bg-card-active border border-border' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
                title="Añadir video"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"/>
                </svg>
              </button>

              {/* Emoji picker - hidden on mobile */}
              <div className="hidden sm:block [&_button]:p-1.5 [&_button]:rounded-lg [&_button]:text-muted [&_button]:transition-all [&_button]:duration-fast [&_button]:ease-out-expo [&_button:hover]:text-foreground [&_button:hover]:bg-card-hover [&_svg]:w-4 [&_svg]:h-4">
                <EmojiPicker onSelect={(emoji) => editorRef.current?.insertContent(emoji)} />
              </div>

              {/* GIF - visible on all screens */}
              <button
                type="button"
                onClick={() => setShowGifPicker(true)}
                className={`px-2 py-1 rounded-lg transition-all duration-fast ease-out-expo text-xs font-semibold ${hasGif ? 'text-foreground bg-card-active border border-border' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
                title="Añadir GIF"
              >
                GIF
              </button>
            </div>

            {/* Right side: Different layouts for mobile vs desktop */}
            {hasContent && (
              <>
                {/* Mobile: Simple send arrow */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="sm:hidden flex items-center justify-center rounded-full border border-border bg-surface p-2 text-foreground shadow-elevation-xs transition-all duration-fast ease-out-expo active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Enviar comentario"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>

                {/* Desktop: Cancel + Comment buttons */}
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContent('');
                      setAttachments([]);
                      setShowAttachments(false);
                      clearDraft();
                      onCancel?.();
                    }}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 btn-primary"
                  >
                    {isSubmitting ? 'POSTING...' : 'COMMENT'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      {/* Bandeja de medios: una sola lista ordenable, fichas iguales */}
      {(hasMedia || showAttachments) && userId && (
        <div className="flex gap-2 overflow-x-auto sm:pl-11">
          <AttachmentUploader
            userId={userId}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            maxFiles={5}
            inline
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-error sm:pl-11">{error}</p>
      )}

        {/* Video: modal compartido (valida la URL antes de entrar) */}
        <VideoUrlModal
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          onAdd={(url) => addMedia(videoEmbedAttachment(url))}
        />

        {/* GIF Picker */}
        <GifPicker
          isOpen={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          onSelect={(url) => addMedia({ url, name: 'GIF', size: 0, type: 'image/gif' })}
        />
      </form>
    </div>
  );
}
