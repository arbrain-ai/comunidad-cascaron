/**
 * Auto-detects plain-text URLs in HTML and wraps them in <a> tags.
 * Skips URLs that are already inside <a> tags (from TipTap autolink).
 * Should be applied AFTER sanitizeHtml().
 */
export function linkifyHtml(html: string): string {
  // Split HTML into tags and text nodes
  // This regex captures HTML tags as separators, keeping them in the result
  const parts = html.split(/(<a\s[^>]*>.*?<\/a>|<[^>]+>)/gi);

  let insideAnchor = false;

  return parts
    .map((part) => {
      // Skip HTML tags
      if (part.startsWith('<')) {
        if (/^<a\s/i.test(part)) insideAnchor = true;
        if (/^<\/a>/i.test(part)) insideAnchor = false;
        return part;
      }

      // Skip text inside existing <a> tags
      if (insideAnchor) return part;

      // Replace plain-text URLs with anchor tags
      return part.replace(
        /https?:\/\/[^\s<>"']+/gi,
        (url) =>
          `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      );
    })
    .join('');
}
