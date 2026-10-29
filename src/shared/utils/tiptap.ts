/**
 * Utilities for working with TipTap JSON content
 */

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, any>;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

interface TipTapDocument {
  type: 'doc';
  content?: TipTapNode[];
}

/**
 * Converts TipTap JSON content to plain text
 * Handles mentions by extracting the label
 */
export function tiptapToPlainText(content: string | TipTapDocument | null): string {
  if (!content) return '';

  let doc: TipTapDocument;

  // Parse if it's a string
  if (typeof content === 'string') {
    try {
      doc = JSON.parse(content);
    } catch {
      // If it's not JSON, return as-is
      return content;
    }
  } else {
    doc = content;
  }

  // Recursively extract text from nodes
  function extractText(node: TipTapNode): string {
    // Handle text nodes
    if (node.text) {
      return node.text;
    }

    // Handle mention nodes
    if (node.type === 'mention') {
      return `@${node.attrs?.label || node.attrs?.id || 'unknown'}`;
    }

    // Handle nodes with content
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('');
    }

    // Handle line breaks and paragraphs
    if (node.type === 'hardBreak') {
      return '\n';
    }

    if (node.type === 'paragraph') {
      // Add newline after paragraph if it has content
      const text = node.content ? (node.content as any[]).map(extractText).join('') : '';
      return text ? text + '\n' : '';
    }

    return '';
  }

  if (!doc.content) return '';

  return doc.content
    .map(extractText)
    .join('')
    .trim();
}

/**
 * Truncates plain text to a maximum length
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Converts TipTap content to truncated plain text preview
 */
export function tiptapToPreview(content: string | TipTapDocument | null, maxLength: number = 100): string {
  const plainText = tiptapToPlainText(content);
  return truncateText(plainText, maxLength);
}
