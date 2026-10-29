'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MentionEditor, MentionEditorRef } from '@/shared/components/MentionEditor';
import { GifPicker } from '@/shared/components/GifPicker';
import { EmojiPicker } from '@/shared/components/EmojiPicker';
import { useCategories } from '../hooks/useCategories';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { CreatePostInput, PostAttachment, CreatePollInput } from '../types';
import { AttachmentUploader } from './AttachmentUploader';
import { VideoUrlModal } from './VideoUrlModal';
import { PollCreator } from './PollCreator';
import { uploadPostAttachment } from '@/shared/lib/supabaseStorage';
import { usePostDraft, draftMediaAttachments } from '../hooks/usePostDraft';
import { firstVideoEmbedUrl, isVideoEmbedMedia, videoEmbedAttachment } from '@/shared/utils/mediaType';
import { enrichPlainMentions, hasUnresolvedPlainMention } from '../services/mentionEnrichment';
import { TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, htmlTextLength } from '../utils/postContentLimits';

// Video icon SVG
const VideoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// GIF icon
const GifIcon = () => (
  <span className="text-xs font-bold">GIF</span>
);

interface PostFormProps {
  onSubmit: (input: CreatePostInput) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  defaultCategorySlug?: string;
  /** Prellenado desde una lección del Classroom (cursos v2): título y cuerpo iniciales */
  defaultTitle?: string;
  defaultContent?: string;
}

// Attachment icon
const AttachmentIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
);

// Poll icon
const PollIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

export function PostForm({ onSubmit, onCancel, isSubmitting = false, defaultCategorySlug, defaultTitle, defaultContent }: PostFormProps) {
  const { categories } = useCategories();
  const { userProfile } = useUserProfile();
  const { draft, saveDraft, clearDraft, hasDraft, lastSaved, isSaving } = usePostDraft();

  // Ref for content editor (to insert emojis)
  const contentEditorRef = useRef<MentionEditorRef>(null);

  // Initialize state - will be populated from draft in useEffect
  const [title, setTitle] = useState(defaultTitle || '');
  const [content, setContent] = useState(defaultContent || '');
  const [categoryId, setCategoryId] = useState('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // New state for attachments and polls
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [poll, setPoll] = useState<CreatePollInput | null>(null);
  const [showPoll, setShowPoll] = useState(false);
  const [sendEmailNotification, setSendEmailNotification] = useState(false);
  const [dropStatus, setDropStatus] = useState<string | null>(null);

  const isAdminOrOwner = userProfile?.role === 'admin' || userProfile?.role === 'owner';

  // Video y GIF son fichas de la MISMA bandeja que las imagenes (se arrastran y
  // reordenan juntas). Entran por aqui; el orden final es el que el autor deja.
  const hasVideo = attachments.some(isVideoEmbedMedia);
  const hasGif = attachments.some(a => a.type === 'image/gif');
  const addMedia = useCallback((item: PostAttachment) => {
    setAttachments(prev => (prev.some(a => a.url === item.url) ? prev : [...prev, item]));
    setShowAttachments(true);
  }, []);

  // Drag & drop de archivos sobre el composer. El AttachmentUploader corre en
  // modo `inline` y ahi no hay zona de drop para archivos NUEVOS, asi que el
  // arrastre se maneja aqui a nivel del form y se reusa uploadPostAttachment.
  const handleComposerDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
  }, []);

  const handleComposerDrop = useCallback(async (e: React.DragEvent) => {
    const dropped = e.dataTransfer?.files;
    if (!dropped || dropped.length === 0) return; // deja pasar drops de texto/reorden
    e.preventDefault();
    if (!userProfile) return;
    const files = Array.from(dropped);
    if (attachments.length + files.length > 10) {
      setError('Máximo 10 archivos permitidos');
      return;
    }
    setShowAttachments(true);
    setError(null);
    try {
      const uploaded: PostAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        setDropStatus(files.length > 1 ? `Subiendo archivo ${i + 1}/${files.length}...` : 'Subiendo archivo...');
        uploaded.push(await uploadPostAttachment(userProfile.id, files[i]));
      }
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
    } finally {
      setDropStatus(null);
    }
  }, [userProfile, attachments.length]);

  // Longitud en vivo del cuerpo para feedback inmediato (botón + aviso).
  const contentLength = useMemo(() => htmlTextLength(content), [content]);
  const isContentOverLimit = contentLength > CONTENT_MAX_LENGTH;

  // Restore draft on mount (only once).
  // TipTap mention only triggers on real keystrokes, not on setContent. So if a
  // restored title/content has a plain "@nombre" that we can't auto-convert to
  // a chip, we drop that field rather than render text that looks like a
  // mention but never becomes one.
  useEffect(() => {
    if (!draft || draftRestored) return;

    let cancelled = false;
    const restore = async () => {
      const [enrichedTitle, enrichedContent] = await Promise.all([
        draft.title ? enrichPlainMentions(draft.title) : Promise.resolve(''),
        draft.content ? enrichPlainMentions(draft.content) : Promise.resolve(''),
      ]);
      if (cancelled) return;

      setTitle(hasUnresolvedPlainMention(enrichedTitle) ? '' : enrichedTitle);
      setContent(hasUnresolvedPlainMention(enrichedContent) ? '' : enrichedContent);
      setCategoryId(draft.categoryId);
      const media = draftMediaAttachments(draft);
      setAttachments(media);
      setPoll(draft.poll);
      if (media.length > 0) setShowAttachments(true);
      if (draft.poll) setShowPoll(true);
      setDraftRestored(true);
    };

    restore().catch(() => {
      if (cancelled) return;
      setTitle(draft.title);
      setContent(draft.content);
      setCategoryId(draft.categoryId);
      const media = draftMediaAttachments(draft);
      setAttachments(media);
      setPoll(draft.poll);
      if (media.length > 0) setShowAttachments(true);
      if (draft.poll) setShowPoll(true);
      setDraftRestored(true);
    });

    return () => {
      cancelled = true;
    };
  }, [draft, draftRestored]);

  // Pre-select category from prop (e.g., from Knowledge Base "Contribute" button)
  useEffect(() => {
    if (defaultCategorySlug && categories.length > 0 && !categoryId && !hasDraft) {
      const matchedCategory = categories.find(c => c.slug === defaultCategorySlug);
      if (matchedCategory) {
        setCategoryId(matchedCategory.id);
        // Apply KB template if it's the knowledge base category
        if (defaultCategorySlug === 'base-de-conocimiento' && !content) {
          setContent(`<h3>🎯 Problema que resuelve</h3><p></p><h3>⚙️ Contexto (dónde aplica y dónde NO)</h3><p></p><h3>📋 Pasos exactos</h3><ol><li><p></p></li></ol><h3>✅ Cómo validar que funcionó</h3><p></p>`);
        }
      }
    }
  }, [defaultCategorySlug, categories, categoryId, hasDraft, content]);

  // Auto-save draft when content changes
  useEffect(() => {
    // Skip if there's a draft pending restoration
    // This prevents overwriting a saved draft with empty values on remount
    if (hasDraft && !draftRestored) return;

    saveDraft({
      title,
      content,
      categoryId,
      videoUrl: '', // legado: el video ya viaja dentro de attachments
      gifUrl: '',
      attachments,
      poll,
    });
  }, [title, content, categoryId, attachments, poll, saveDraft, draftRestored, hasDraft]);

  // Handle clipboard paste for images
  // Handle clipboard paste for images only - text pastes handled by MentionEditor
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!userProfile) return;

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
        const result = await uploadPostAttachment(userProfile.id, file);
        newAttachments.push(result);
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      setShowAttachments(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al pegar imagen');
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!content.trim()) {
      setError('El contenido es requerido');
      return;
    }

    // Hard gate de longitud: o el post entra completo dentro del límite, o no se
    // publica. Nunca se envía/guarda un post truncado (regla anti-bug del email
    // de anuncio cortado).
    const contentLength = htmlTextLength(content);
    if (contentLength > CONTENT_MAX_LENGTH) {
      setError(
        `El contenido tiene ${contentLength.toLocaleString('es-MX')} caracteres y el máximo es ${CONTENT_MAX_LENGTH.toLocaleString('es-MX')}. Acórtalo o divídelo en varios posts antes de publicar.`
      );
      return;
    }

    const titleLength = htmlTextLength(title);
    if (titleLength > TITLE_MAX_LENGTH) {
      setError(`El título tiene ${titleLength} caracteres y el máximo es ${TITLE_MAX_LENGTH}.`);
      return;
    }

    if (!categoryId) {
      setError('Debes seleccionar una categoría');
      return;
    }

    try {
      // Convert plain "@nombre" with a unique profile match into a chip.
      // No-op when the user already picked from the dropdown.
      const trimmedTitle = title.trim();
      const enrichedTitle = trimmedTitle ? await enrichPlainMentions(trimmedTitle) : undefined;
      const enrichedContent = await enrichPlainMentions(content.trim());

      await onSubmit({
        title: enrichedTitle || undefined,
        content: enrichedContent,
        category_id: categoryId,
        // La columna se espeja con el PRIMER video de la bandeja: todo lo que ya
        // la lee (feed, correo, webhook, agentes) sigue funcionando igual.
        video_embed_url: firstVideoEmbedUrl(attachments),
        attachments: attachments.length > 0 ? attachments : undefined,
        poll: poll || undefined,
        send_email_notification: isAdminOrOwner ? sendEmailNotification : undefined,
      });

      // Clear draft and reset form
      clearDraft();
      setTitle('');
      setContent('');
      setCategoryId('');
      setShowVideoModal(false);
      setShowGifPicker(false);
      setAttachments([]);
      setShowAttachments(false);
      setPoll(null);
      setShowPoll(false);
      setDraftRestored(false);
      setSendEmailNotification(false);
    } catch (err) {
      // Better error serialization for debugging
      const errorDetails = err && typeof err === 'object'
        ? {
            message: (err as Record<string, unknown>).message,
            code: (err as Record<string, unknown>).code,
            details: (err as Record<string, unknown>).details,
          }
        : err;
      console.error('Error creating post:', errorDetails);
      const errorMessage = (err as Record<string, unknown>)?.message || 'Error al crear el post';
      setError(String(errorMessage));
    }
  };

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste} onDragOver={handleComposerDragOver} onDrop={handleComposerDrop} className="solid-card p-4 space-y-3">
      {/* Title - with mentions support. autoFocus: escribir arranca al instante
          al abrir el composer (tap en "¿Qué quieres compartir?" o FAB) */}
      <div className="[&_.ProseMirror]:text-lg [&_.ProseMirror]:font-semibold [&_.ProseMirror]:py-0 [&_.ProseMirror_p]:my-0">
        <MentionEditor
          content={title}
          onChange={setTitle}
          placeholder="Título"
          autoFocus
          minHeight="28px"
          maxLength={TITLE_MAX_LENGTH}
          categoryId={categoryId || null}
        />
      </div>

      {/* Content - with mentions support + toolbar de formato descubrible */}
      <MentionEditor
        ref={contentEditorRef}
        content={content}
        onChange={setContent}
        placeholder="Escribe algo..."
        showToolbar
        minHeight="80px"
        maxLength={CONTENT_MAX_LENGTH}
        categoryId={categoryId || null}
      />

      {/* Bandeja de medios: UNA lista ordenable con imagenes, GIFs, videos y
          archivos como fichas iguales (192px). El video ya no es un caso aparte
          pegado despues del "+": se arrastra y reordena como cualquier imagen. */}
      {(attachments.length > 0 || showAttachments) && userProfile && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          <AttachmentUploader
            userId={userProfile.id}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            inline
          />
        </div>
      )}

      {/* Poll Section */}
      <PollCreator
        isActive={showPoll}
        onActiveChange={setShowPoll}
        onPollChange={setPoll}
      />

      {/* Over-limit live warning (antes de intentar publicar) */}
      {isContentOverLimit && (
        <p className="text-sm text-error">
          Te pasaste por {(contentLength - CONTENT_MAX_LENGTH).toLocaleString('es-MX')} caracteres
          ({contentLength.toLocaleString('es-MX')}/{CONTENT_MAX_LENGTH.toLocaleString('es-MX')}).
          Acorta el texto o divídelo en varios posts para publicar.
        </p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      {/* Estado de subida por drag & drop */}
      {dropStatus && (
        <p className="text-sm text-muted">{dropStatus}</p>
      )}

      {/* Bottom bar - attachments & actions */}
      <div className="flex flex-col gap-2 pt-3 border-t border-glass">
        {/* Row 1: Attachment icons + Category */}
        <div className="flex items-center gap-1">
          {/* Emoji picker */}
          <EmojiPicker onSelect={(emoji) => contentEditorRef.current?.insertContent(emoji)} />

          {/* Video button */}
          <button
            type="button"
            onClick={() => setShowVideoModal(true)}
            className={`p-2 rounded-lg transition-colors ${hasVideo ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground hover:bg-surface'}`}
            title="Añadir video (video propio, YouTube, Vimeo, Loom)"
          >
            <VideoIcon />
          </button>

          {/* GIF button */}
          <button
            type="button"
            onClick={() => setShowGifPicker(true)}
            className={`p-2 rounded-lg transition-colors ${hasGif ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground hover:bg-surface'}`}
            title="Añadir GIF animado"
          >
            <GifIcon />
          </button>

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            className={`p-2 rounded-lg transition-colors flex items-center ${attachments.length > 0 ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground hover:bg-surface'}`}
            title="Adjuntar archivos (imágenes, PDFs, código)"
          >
            <AttachmentIcon />
            {attachments.length > 0 && (
              <span className="ml-1 text-xs text-primary">{attachments.length}</span>
            )}
          </button>

          {/* Poll button */}
          <button
            type="button"
            onClick={() => setShowPoll(!showPoll)}
            className={`p-2 rounded-lg transition-colors ${showPoll || poll ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground hover:bg-surface'}`}
            title="Crear encuesta"
          >
            <PollIcon />
          </button>

          {/* Category select */}
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className={`min-w-0 flex-1 max-w-[120px] sm:max-w-[160px] px-2 py-1.5 text-xs bg-transparent border rounded-lg focus:outline-none truncate ${
              error && !categoryId
                ? 'border-error text-error focus:border-error'
                : 'border-glass text-muted focus:border-glass-strong'
            }`}
          >
            <option value="">Categoría *</option>
            {categories.map((cat) => {
              const userTier = userProfile?.tier || 'no-paid';
              const permissions = cat.permissions;

              // Una categoría donde NO puedes publicar no se enseña con candado:
              // simplemente no existe en tu selector.
              let hasAccess = true;
              if (permissions === 'admins') {
                hasAccess = isAdminOrOwner;
              } else if (permissions === 'vip') {
                hasAccess = userTier === 'vip' || isAdminOrOwner;
              }
              if (!hasAccess) return null;

              const categoryLabel = (cat as any).emoji ? `${(cat as any).emoji} ${cat.name}` : cat.name;

              return (
                <option key={cat.id} value={cat.id} className="bg-background text-foreground">
                  {categoryLabel}
                </option>
              );
            })}
          </select>
        </div>

        {/* Row 2: Email toggle (admin/owner only) */}
        {isAdminOrOwner && (
          <div className="flex items-center gap-2 py-1">
            <button
              type="button"
              onClick={() => setSendEmailNotification(!sendEmailNotification)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                sendEmailNotification ? 'bg-primary' : 'bg-muted/30'
              }`}
              role="switch"
              aria-checked={sendEmailNotification}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  sendEmailNotification ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs ${sendEmailNotification ? 'text-primary font-medium' : 'text-muted'}`}>
              Enviar por email a miembros
            </span>
          </div>
        )}

        {/* Row 3: Draft indicator + Action buttons */}
        <div className="flex items-center justify-between gap-2">
          {/* Draft indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted min-h-[24px]">
            {isSaving && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                Guardando...
              </span>
            )}
            {!isSaving && hasDraft && lastSaved && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Borrador guardado
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !content.trim() || !categoryId || isContentOverLimit}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isSubmitting || !content.trim() || !categoryId || isContentOverLimit
                  ? 'bg-muted/30 text-muted cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isSubmitting ? '...' : 'Publicar'}
            </button>
          </div>
        </div>
      </div>

      {/* Video: un solo modal para los tres composers; valida la URL antes de
          entrar y la deja como ficha en la bandeja */}
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
  );
}
