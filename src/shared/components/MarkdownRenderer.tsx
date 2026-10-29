'use client';

import { useRef, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
// GitHub Markdown CSS - Estilo exacto de GitHub/VS Code
import 'github-markdown-css/github-markdown-dark.css';
import 'highlight.js/styles/github-dark.css';
import { useMentionHover } from '@/shared/hooks/useMentionHover';
import { DiagramaMermaid } from './DiagramaMermaid';

/**
 * Aplana cualquier árbol de React a texto plano.
 *
 * Hace falta porque rehypeHighlight ya tokenizó el contenido del bloque en
 * <span>s antes de que lleguemos aquí: `children` no es un string, es un árbol.
 * Para mermaid necesitamos la fuente EXACTA que escribió el agente.
 */
function textoPlano(nodo: ReactNode): string {
  if (nodo == null || typeof nodo === 'boolean') return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoPlano).join('');
  if (isValidElement(nodo)) return textoPlano((nodo.props as { children?: ReactNode }).children);
  return '';
}

/** ¿Este <pre> envuelve un bloque ```mermaid? Devuelve su código, o null. */
function codigoMermaid(children: ReactNode): string | null {
  const hijos = Array.isArray(children) ? children : [children];
  for (const h of hijos) {
    if (!isValidElement(h)) continue;
    const props = h.props as { className?: string; children?: ReactNode };
    if (typeof props.className === 'string' && /\blanguage-mermaid\b/.test(props.className)) {
      return textoPlano(props.children);
    }
  }
  return null;
}

/**
 * Schema custom para preservar atributos de mention (TipTap output).
 * Default GitHub schema stripea class y data-* en spans, lo que rompe
 * los estilos `.mention` y el hover preview (useMentionHover).
 */
const mentionSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...((defaultSchema.attributes && defaultSchema.attributes.span) || []),
      'className',
      'dataType',
      'dataId',
      'dataLabel',
    ],
  },
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Si true, permite HTML dentro del markdown (sanitizado) */
  allowHtml?: boolean;
  /** Si true, agrega estilos para menciones (@user) */
  enableMentions?: boolean;
}

/**
 * Componente reutilizable para renderizar markdown de forma segura
 *
 * Usa github-markdown-css para replicar exactamente el estilo de GitHub/VS Code.
 *
 * Características:
 * - GitHub Flavored Markdown (tablas, strikethrough, etc.)
 * - Syntax highlighting para code blocks
 * - Sanitización de HTML para prevenir XSS
 * - Soporte opcional para HTML en markdown
 * - Estilos para menciones (@user)
 *
 * @example
 * ```tsx
 * // Uso básico
 * <MarkdownRenderer content="**bold** *italic*" />
 *
 * // Con HTML permitido (sanitizado)
 * <MarkdownRenderer content="<p>HTML content</p>" allowHtml />
 *
 * // Con estilos para menciones
 * <MarkdownRenderer
 *   content="@user mensaje"
 *   enableMentions
 * />
 * ```
 */
export function MarkdownRenderer({
  content,
  className = '',
  allowHtml = false,
  enableMentions = false
}: MarkdownRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const mentionClasses = enableMentions
    ? '[&_.mention]:text-primary [&_.mention]:font-semibold [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:rounded [&_.mention]:no-underline'
    : '';

  // Fix: Tailwind Preflight resetea list-style:none, necesitamos restaurarlo
  // Ref: https://tailwindcss.com/docs/preflight#lists-are-unstyled
  const listClasses = '[&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_li]:my-0.5';

  // Combinamos markdown-body (GitHub CSS) con clases adicionales
  const combinedClasses = `markdown-body ${listClasses} ${mentionClasses} ${className}`.trim();

  const plugins = allowHtml
    ? [rehypeRaw, [rehypeSanitize, mentionSchema], rehypeHighlight]
    : [rehypeHighlight];

  // Enable mention hover previews (Facebook/Skool-style)
  // Hook must be called unconditionally (React rules)
  useMentionHover(contentRef, enableMentions);

  return (
    <div
      ref={contentRef}
      className={combinedClasses}
      // Override background para usar nuestro theme en lugar del default de GitHub
      style={{
        backgroundColor: 'transparent',
        color: 'inherit',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={plugins as any}
        components={{
          // Personalizar renderizado de links para abrir en nueva pestaña
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // Personalizar pre blocks para scroll horizontal en code blocks largos
          // Usamos inline styles para ganarle a github-markdown-css en especificidad
          pre: ({ node, children, ...props }) => {
            // Un ```mermaid no es código para leer: es un dibujo. Se sale del <pre>
            // y se convierte en diagrama. Si falla, DiagramaMermaid muestra el código.
            const diagrama = codigoMermaid(children);
            if (diagrama) return <DiagramaMermaid codigo={diagrama} />;
            return (
            <pre
              {...props}
              style={{
                display: 'block',
                overflowX: 'auto',
                overflowY: 'visible',
                maxWidth: '100%',
                width: '100%',
                whiteSpace: 'pre',
                wordWrap: 'normal',
                WebkitOverflowScrolling: 'touch', // Smooth scroll en iOS
              }}
            >
              {children}
            </pre>
            );
          },
          // Personalizar code blocks para mejor estilo
          // react-markdown v10 YA NO pasa la prop `inline` (se quitó en v9). El código
          // viejo la leía igual, así que era siempre undefined y TODO code —incluido
          // el inline dentro de una frase— caía al `display:block`: por eso un
          // `nombre` en medio de un párrafo se estiraba como barra gris de ancho
          // completo. La forma correcta en v10 es mirar el className: solo un bloque
          // cercado trae `language-*`.
          code: ({ node, className, children, ...props }: any) => {
            const esBloque = typeof className === 'string' && /\blanguage-/.test(className);
            if (!esBloque) {
              return <code className={className} {...props}>{children}</code>;
            }
            return (
              <code
                className={className}
                style={{ display: 'block', whiteSpace: 'pre', wordWrap: 'normal' }}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
