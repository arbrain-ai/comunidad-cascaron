'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { MentionEditor, MentionEditorRef } from '@/shared/components/MentionEditor';
import { GifPicker } from '@/shared/components/GifPicker';
import { EmojiPicker } from '@/shared/components/EmojiPicker';
import { useCategories } from '../hooks/useCategories';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { PostWithAuthor, UpdatePostInput, PostAttachment } from '../types';
import { AttachmentUploader } from './AttachmentUploader';
import { VideoUrlModal } from './VideoUrlModal';
import { firstVideoEmbedUrl, isVideoEmbedMedia, videoEmbedAttachment } from '@/shared/utils/mediaType';
import { uploadPostAttachment } from '@/shared/lib/supabaseStorage';
import { enrichPlainMentions } from '../services/mentionEnrichment';
import { TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, htmlTextLength } from '../utils/postContentLimits';

interface PostEditModalProps {
  post: PostWithAuthor;
  onSave: (postId: string, input: UpdatePostInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function PostEditModal({ post, onSave, onCancel, isSubmitting = false }: PostEditModalProps) {
  const { categories } = useCategories();
  const { userProfile } = useUserProfile();
  const contentEditorRef = useRef<MentionEditorRef>(null);

  // MODO PUBLICACIÓN: un borrador no se "edita", se REVISA ANTES DE ENVIAR.
  // Es la misma pantalla que ves al crear un post (título · cuerpo · categoría ·
  // toggle de email · Publicar), no la de un post que ya salió. La diferencia
  // importa: publicar manda push a ~570 personas y, si el toggle está prendido,
  // también el correo. Eso no puede quedar detrás de un botón de un solo clic.
  const isDraft = post.is_draft === true;
  const isAdminOrOwner = userProfile?.role === 'admin' || userProfile?.role === 'owner';
  const [sendEmailNotification, setSendEmailNotification] = useState(
    post.send_email_notification === true
  );

  // Initialize with post data
  const [title, setTitle] = useState(post.title || '');
  const [content, setContent] = useState(post.content || '');
  const [categoryId, setCategoryId] = useState(post.category_id || '');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bandeja de medios: imagenes, GIFs, videos y archivos en UNA lista ordenable.
  // Un post anterior a la bandeja unificada trae el video solo en la columna
  // `video_embed_url`: se pliega como primera ficha (que es donde se pintaba).
  const [attachments, setAttachments] = useState<PostAttachment[]>(() => {
    const list: PostAttachment[] = [...(((post as any).attachments || []) as PostAttachment[])];
    if (post.video_embed_url && !list.some(isVideoEmbedMedia)) {
      list.unshift(videoEmbedAttachment(post.video_embed_url));
    }
    return list;
  });
  const [showAttachments, setShowAttachments] = useState(attachments.length > 0);
  const hasVideo = attachments.some(isVideoEmbedMedia);
  const addMedia = useCallback((item: PostAttachment) => {
    setAttachments(prev => (prev.some(a => a.url === item.url) ? prev : [...prev, item]));
    setShowAttachments(true);
  }, []);

  // Longitud en vivo del cuerpo para feedback inmediato (botón + aviso).
  const contentLength = useMemo(() => htmlTextLength(content), [content]);
  const isContentOverLimit = contentLength > CONTENT_MAX_LENGTH;

  // Candado del scroll del fondo (mismo patrón iOS-safe que PostDetailModal):
  // con el modal abierto, la rueda/el dedo scrolleaban el FEED por detrás en
  // vez del post. Anidado: si el body ya está fijado (abierto desde el detalle del
  // post, que pone su propio candado) no se toca ni se suelta al cerrar.
  useEffect(() => {
    const body = document.body;
    if (body.style.position === 'fixed') return;
    const scrollY = window.scrollY;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Adaptar el modal al visualViewport cuando abre el teclado móvil (mismo
  // patrón que PostDetailModal). Sin esto, el teclado tapaba el editor y el
  // botón Guardar quedaba inalcanzable (hallazgo #6 del audit).
  const [keyboardStyle, setKeyboardStyle] = useState<React.CSSProperties>({});
  const isKeyboardOpen = Object.keys(keyboardStyle).length > 0;
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame: number | null = null;

    const handleViewport = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const kbOpen = keyboardInset > 80 || vv.height < window.innerHeight * 0.85;
        if (kbOpen) {
          const availableHeight = Math.max(320, vv.height - 16);
          setKeyboardStyle({
            height: `${availableHeight}px`,
            maxHeight: `${availableHeight}px`,
            marginTop: `${Math.max(8, vv.offsetTop + 8)}px`,
            marginBottom: '8px',
          });
        } else {
          setKeyboardStyle({});
        }
      });
    };

    handleViewport();
    vv.addEventListener('resize', handleViewport);
    vv.addEventListener('scroll', handleViewport);
    window.addEventListener('orientationchange', handleViewport);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      vv.removeEventListener('resize', handleViewport);
      vv.removeEventListener('scroll', handleViewport);
      window.removeEventListener('orientationchange', handleViewport);
    };
  }, []);

  // Handle clipboard paste for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !userProfile) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
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
    }
  }, [userProfile]);

  // `publicar` solo lo manda el botón Publicar de un borrador. Guardar (o guardar
  // borrador) NUNCA cambia is_draft: el envío es una decisión aparte del guardado.
  const [publishing, setPublishing] = useState(false);
  const handleSubmit = async (e: React.FormEvent, publicar = false) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('El contenido es requerido');
      return;
    }

    // Hard gate de longitud: o el post entra completo dentro del límite, o no se
    // guarda. Nunca se persiste un post truncado.
    const contentLen = htmlTextLength(content);
    if (contentLen > CONTENT_MAX_LENGTH) {
      setError(
        `El contenido tiene ${contentLen.toLocaleString('es-MX')} caracteres y el máximo es ${CONTENT_MAX_LENGTH.toLocaleString('es-MX')}. Acórtalo o divídelo antes de guardar.`
      );
      return;
    }

    const titleLen = htmlTextLength(title);
    if (titleLen > TITLE_MAX_LENGTH) {
      setError(`El título tiene ${titleLen} caracteres y el máximo es ${TITLE_MAX_LENGTH}.`);
      return;
    }

    if (!categoryId) {
      setError('Debes seleccionar una categoría');
      return;
    }

    try {
      const trimmedTitle = title.trim();
      const enrichedTitle = trimmedTitle ? await enrichPlainMentions(trimmedTitle) : undefined;
      const enrichedContent = await enrichPlainMentions(content.trim());

      if (publicar) setPublishing(true);
      await onSave(post.id, {
        title: enrichedTitle || undefined,
        content: enrichedContent,
        category_id: categoryId,
        // La columna se espeja con el PRIMER video de la bandeja; media_urls
        // guarda los objetos completos (antes solo la url: los PDFs perdian
        // nombre y tamaño al editar).
        video_embed_url: firstVideoEmbedUrl(attachments),
        media_urls: attachments,
        // Publicar un borrador: is_draft true -> false dispara el trigger que manda
        // push + in-app y, si el toggle está prendido, el correo. created_at se refresca
        // para que el post entre al feed por arriba y no por su fecha de borrador.
        ...(publicar && {
          is_draft: false,
          created_at: new Date().toISOString(),
          ...(isAdminOrOwner && { send_email_notification: sendEmailNotification }),
        }),
      });
    } catch (err) {
      console.error('Error updating post:', err);
      setError(publicar ? 'Error al publicar el post' : 'Error al actualizar el post');
      setPublishing(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex justify-center p-4 pt-[max(1rem,var(--sat))] ${isKeyboardOpen ? 'items-start' : 'items-center'}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      <div
        className={`relative w-full max-w-2xl overflow-y-auto overscroll-contain glass-panel-strong rounded-xl border border-glass-strong depth-modal ${isKeyboardOpen ? '' : 'max-h-[90vh]'}`}
        style={keyboardStyle}
      >
        <form onSubmit={handleSubmit} onPaste={handlePaste} className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">
                {isDraft ? 'Publicar post' : 'Editar post'}
              </h3>
              {isDraft && (
                <p className="text-xs text-muted mt-0.5">
                  Borrador. Todavía no lo ha visto nadie.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 hover:bg-surface rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Title */}
          <div className="[&_.ProseMirror]:text-lg [&_.ProseMirror]:font-semibold [&_.ProseMirror]:py-0 [&_.ProseMirror_p]:my-0">
            <MentionEditor
              content={title}
              onChange={setTitle}
              placeholder="Título"
              minHeight="28px"
              maxLength={TITLE_MAX_LENGTH}
              categoryId={categoryId || null}
            />
          </div>

          {/* Content + toolbar de formato descubrible */}
          <MentionEditor
            ref={contentEditorRef}
            content={content}
            onChange={setContent}
            placeholder="Escribe algo..."
            showToolbar
            minHeight="120px"
            maxLength={CONTENT_MAX_LENGTH}
            categoryId={categoryId || null}
          />

          {/* Bandeja de medios: una sola lista ordenable, fichas iguales */}
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

          {/* Over-limit live warning */}
          {isContentOverLimit && (
            <p className="text-sm text-error">
              Te pasaste por {(contentLength - CONTENT_MAX_LENGTH).toLocaleString('es-MX')} caracteres
              ({contentLength.toLocaleString('es-MX')}/{CONTENT_MAX_LENGTH.toLocaleString('es-MX')}).
              Acorta el texto para guardar.
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          {/* Bottom bar */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-glass">
            <div className="flex items-center gap-1">
              {/* Emoji picker */}
              <EmojiPicker onSelect={(emoji) => contentEditorRef.current?.insertContent(emoji)} />

              {/* Video button */}
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                className={`p-2 rounded-lg transition-colors ${hasVideo ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground hover:bg-surface'}`}
                title="Añadir video"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>

              {/* GIF button */}
              <button
                type="button"
                onClick={() => setShowGifPicker(true)}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                title="Añadir GIF"
              >
                <span className="text-xs font-bold">GIF</span>
              </button>

              {/* Attachment button */}
              <button
                type="button"
                onClick={() => setShowAttachments(!showAttachments)}
                className={`p-2 rounded-lg transition-colors flex items-center ${attachments.length > 0 ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground hover:bg-surface'}`}
                title="Adjuntar archivos"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {attachments.length > 0 && (
                  <span className="ml-1 text-xs text-primary">{attachments.length}</span>
                )}
              </button>

              {/* Category select */}
              <select
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
                  let hasAccess = true;
                  if (permissions === 'vip') {
                    hasAccess = userTier === 'vip';
                  }
                  const lockIcon = hasAccess ? '' : '🔒 ';
                  const categoryLabel = (cat as any).emoji ? `${lockIcon}${(cat as any).emoji} ${cat.name}` : `${lockIcon}${cat.name}`;

                  return (
                    <option
                      key={cat.id}
                      value={cat.id}
                      className="bg-background text-foreground"
                      disabled={!hasAccess}
                    >
                      {categoryLabel}{!hasAccess ? ' (VIP)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !content.trim() || !categoryId || isContentOverLimit}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isSubmitting || !content.trim() || !categoryId || isContentOverLimit
                    ? 'bg-muted/30 text-muted cursor-not-allowed'
                    : isDraft
                    ? 'border border-glass-strong text-foreground hover:bg-surface'
                    : 'btn-primary'
                }`}
              >
                {isSubmitting && !publishing
                  ? 'Guardando...'
                  : isDraft
                  ? 'Guardar borrador'
                  : 'Guardar'}
              </button>
              {isDraft && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={isSubmitting || !content.trim() || !categoryId || isContentOverLimit}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isSubmitting || !content.trim() || !categoryId || isContentOverLimit
                      ? 'bg-muted/30 text-muted cursor-not-allowed'
                      : 'btn-primary'
                  }`}
                >
                  {publishing ? 'Publicando...' : 'Publicar'}
                </button>
              )}
            </div>
          </div>

          {/* Toggle de correo — SOLO en un borrador y SOLO para admin/owner.
              Es la última compuerta antes de mandar el anuncio por email a todos.
              El modal de edición normal no lo muestra: un post ya publicado no
              debe poder re-disparar el broadcast desde aquí. */}
          {isDraft && isAdminOrOwner && (
            <div className="flex items-center gap-2 pt-1">
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
        </form>

        {/* Video: modal compartido (portal a body, valida la URL) */}
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
      </div>
    </div>
  );
}
