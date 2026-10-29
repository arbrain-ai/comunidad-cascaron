import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Allows safe TipTap editor tags (p, span, a, img, mentions, etc.)
 * while stripping scripts, iframes, and event handlers.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-type', 'data-id', 'data-label', 'target'],
  });
}
