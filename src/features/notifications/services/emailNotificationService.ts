// ============================================
// Email Notification Service
// ============================================
// Handles sending batch email notifications via Resend

import { getResend, EMAIL_FROM, SITE_URL } from '@/shared/lib/resend';
import { isImageMedia, getMediaUrl, type MediaItem } from '@/shared/utils/mediaType';
import { render } from '@react-email/components';
import { AdminAnnouncementEmail } from '../emails/AdminAnnouncementEmail';
import { parseSelfVideoId, selfVideoCardUrl } from '@/shared/utils/selfVideo';
import { BRAND } from '@/shared/config/brand';

// ============================================
// Constants
// ============================================

const BATCH_SIZE = 100; // Resend batch limit
const DELAY_BETWEEN_BATCHES_MS = 1000; // 1 second delay to avoid rate limiting

// ============================================
// Types
// ============================================

interface EmailRecipient {
  user_id: string;
  email: string;
}

interface SendAdminAnnouncementParams {
  recipients: EmailRecipient[];
  authorName: string;
  authorAvatar: string | null;
  postId: string;
  postTitle: string;
  postContent: string;
  mediaUrls?: string[];
  /** URL del video del post (video propio o YouTube), si trae uno. */
  videoEmbedUrl?: string | null;
}

interface SendResult {
  sent: number;
  failed: number;
  errors: string[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip HTML tags and truncate text for email preview snippet
 */
function createPreviewSnippet(htmlContent: string, maxLength: number = 200): string {
  const textContent = decodeEntities(htmlContent.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

  if (textContent.length <= maxLength) {
    return textContent;
  }

  return textContent.substring(0, maxLength).trim() + '...';
}

/**
 * Decodifica las entidades HTML que deja TipTap.
 *
 * El editor guarda `&nbsp;` donde el autor puso un espacio. El cuerpo del correo
 * ya las decodificaba, pero el ASUNTO y el snippet no: sin esto el asunto
 * llega con "&nbsp;" literal en la bandeja.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Texto plano de un HTML: sin etiquetas, sin entidades, sin espacios dobles. */
function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract first image URL from media_urls array
 * Handles both string URLs and object format {url, name, size, type}
 */
function getFirstImageUrl(mediaUrls?: unknown[]): string | null {
  if (!mediaUrls || mediaUrls.length === 0) return null;

  // Solo una IMAGEN real. media_urls tambien trae videos embebidos
  // ({ type: 'video/embed' }) y archivos: tomar "la primera entrada" metia una
  // URL de YouTube o un PDF como <img> del correo.
  for (const item of mediaUrls) {
    const media = item as MediaItem;
    if (!isImageMedia(media)) continue;
    const url = getMediaUrl(media);
    if (url) return url;
  }

  return null;
}

/**
 * Imagen del video para el correo.
 *
 * El post lleva un player; el correo no puede (ningun cliente ejecuta iframes),
 * asi que el video viaja como IMAGEN enlazada al post. En video propio usamos la
 * tarjeta con el boton horneado y movimiento (`card.gif`); en YouTube, su
 * miniatura. Si el video es de otra plataforma, no se inventa nada: se devuelve
 * null y el correo sale sin imagen, como antes.
 */
function getVideoCardUrl(videoEmbedUrl?: string | null): string | null {
  if (!videoEmbedUrl) return null;

  const selfVideoId = parseSelfVideoId(videoEmbedUrl);
  if (selfVideoId) return selfVideoCardUrl(selfVideoId);

  const yt = videoEmbedUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  if (yt?.[1]) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;

  return null;
}

/**
 * Arma el cuerpo del correo de anuncio a partir de una fila de `posts`.
 *
 * Existe para que la PRUEBA y el ENVIO REAL no puedan divergir: el endpoint de
 * preview manda exactamente lo que recibiran los miembros, porque sale de aqui.
 * Una prueba que renderiza otra cosa no prueba nada.
 */
export function buildAnnouncementContent(post: {
  title?: string | null;
  content?: string | null;
  video_embed_url?: string | null;
  media_urls?: unknown[] | null;
}) {
  return {
    postTitle: stripHtml(post.title || '') || 'Nuevo anuncio',
    previewSnippet: createPreviewSnippet(post.content || ''),
    postContent: post.content || '',
    postImageUrl: getFirstImageUrl(post.media_urls ?? undefined),
    videoCardUrl: getVideoCardUrl(post.video_embed_url),
  };
}

// ============================================
// Main Function
// ============================================

/**
 * Send admin announcement emails to all recipients in batches
 *
 * @param params - Email parameters including recipients and post details
 * @returns Result object with sent/failed counts and errors
 */
export async function sendAdminAnnouncementEmails(
  params: SendAdminAnnouncementParams
): Promise<SendResult> {
  const {
    recipients,
    authorName,
    authorAvatar,
    postId,
    postTitle,
    postContent,
    mediaUrls,
    videoEmbedUrl,
  } = params;

  const result: SendResult = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  // Validate inputs
  if (!recipients || recipients.length === 0) {
    console.log('[EmailService] No recipients to send to');
    return result;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[EmailService] RESEND_API_KEY not configured, skipping email send');
    result.errors.push('RESEND_API_KEY not configured');
    result.failed = recipients.length;
    return result;
  }

  try {
    const resend = getResend();
    const cleanTitle = stripHtml(postTitle);
    const previewSnippet = createPreviewSnippet(postContent);
    const postUrl = `${SITE_URL}/community?post=${postId}`;
    const postImageUrl = getFirstImageUrl(mediaUrls);
    const videoCardUrl = getVideoCardUrl(videoEmbedUrl);

    // Split recipients into batches
    const batches = chunkArray(recipients, BATCH_SIZE);
    console.log(`[EmailService] Sending to ${recipients.length} recipients in ${batches.length} batch(es)`);

    for (const [index, batch] of batches.entries()) {
      try {
        // Prepare batch of emails
        const emails = batch.map(({ email }) => {
          // Los avisos por email se desactivan desde la pagina de ajustes.
          const unsubscribeUrl = `${SITE_URL}/settings`;

          return {
            from: EMAIL_FROM,
            to: email,
            subject: cleanTitle || `${authorName} publico un anuncio en ${BRAND.name}`,
            react: AdminAnnouncementEmail({
              authorName,
              authorAvatar,
              postTitle: cleanTitle || 'Nuevo anuncio',
              previewSnippet,
              postContent,
              postUrl,
              postImageUrl,
              videoCardUrl,
              unsubscribeUrl,
            }),
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
            },
          };
        });

        // Send batch via Resend
        const { data, error } = await resend.batch.send(emails);

        if (error) {
          console.error(`[EmailService] Batch ${index + 1} error:`, error);
          result.failed += batch.length;
          result.errors.push(`Batch ${index + 1}: ${error.message}`);
        } else {
          result.sent += batch.length;
          console.log(`[EmailService] Batch ${index + 1}/${batches.length} sent successfully:`, {
            count: batch.length,
            ids: data?.data?.map((d) => d.id).slice(0, 3), // Log first 3 IDs
          });
        }

        // Delay between batches (except for the last one)
        if (index < batches.length - 1) {
          await sleep(DELAY_BETWEEN_BATCHES_MS);
        }
      } catch (batchError) {
        console.error(`[EmailService] Batch ${index + 1} processing error:`, batchError);
        result.failed += batch.length;
        result.errors.push(
          `Batch ${index + 1}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`
        );
      }
    }

    console.log('[EmailService] Email send complete:', result);
    return result;
  } catch (error) {
    console.error('[EmailService] Fatal error:', error);
    result.failed = recipients.length;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}
