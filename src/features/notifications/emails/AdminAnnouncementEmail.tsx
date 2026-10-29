// ============================================
// Admin Announcement Email Template
// ============================================
// React Email component for admin post notifications
// Shows full post content + image (Skool-style)
// Branding: Dark header with amber glow, purple accents

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { BRAND } from '@/shared/config/brand';

interface AdminAnnouncementEmailProps {
  authorName: string;
  authorAvatar: string | null;
  postTitle: string;
  previewSnippet: string;
  postContent: string;
  postUrl: string;
  postImageUrl?: string | null;
  /** Tarjeta del video (GIF con el boton horneado). Ver getVideoCardUrl(). */
  videoCardUrl?: string | null;
  unsubscribeUrl: string;
}

/**
 * Convert TipTap HTML to email-safe plain text with line breaks
 */
function htmlToEmailText(html: string): string {
  return html
    // Convert <br> and <br/> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert closing block tags to newlines
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    // Convert <strong>/<b> content (keep text, mark with visual weight via bold prop)
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse 3+ newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Render post content as an array of Text elements with bold support
 */
function renderPostContent(html: string) {
  const text = htmlToEmailText(html);
  const lines = text.split('\n');

  return lines.map((line, i) => {
    if (line.trim() === '') {
      return <Text key={i} style={{ margin: '0', lineHeight: '12px' }}>&nbsp;</Text>;
    }

    // Parse **bold** markers into spans
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const elements = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={j} style={{ color: '#f4f4f5', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    return (
      <Text key={i} style={contentTextStyle}>
        {elements}
      </Text>
    );
  });
}

export function AdminAnnouncementEmail({
  authorName,
  authorAvatar,
  postTitle,
  previewSnippet,
  postContent,
  postUrl,
  postImageUrl,
  videoCardUrl,
  unsubscribeUrl,
}: AdminAnnouncementEmailProps) {
  const previewText = previewSnippet;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header - Dark with logo + text inline like the app header */}
          <Section style={headerStyle}>
            <table cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
              <tr>
                <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                  <Img
                    src={`${BRAND.siteUrl}/logo.png`}
                    alt={BRAND.name}
                    width="44"
                    height="44"
                    style={logoStyle}
                  />
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <Text style={headerTextStyle}>{BRAND.name}</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Author info */}
          <Section style={authorSectionStyle}>
            <table cellPadding="0" cellSpacing="0">
              <tr>
                {authorAvatar && (
                  <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                    <Img
                      src={authorAvatar}
                      alt={authorName}
                      width="44"
                      height="44"
                      style={avatarStyle}
                    />
                  </td>
                )}
                <td style={{ verticalAlign: 'middle' }}>
                  <Text style={authorNameStyle}>
                    <strong>{authorName}</strong> <span style={{ color: '#6b7280' }}>publico un anuncio</span>
                  </Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Post content - Full content like Skool */}
          <Section style={contentSectionStyle}>
            <Heading style={titleStyle}>{postTitle || 'Nuevo anuncio'}</Heading>

            {/* Full post body */}
            {postContent && renderPostContent(postContent)}

            {/* Video del post.
                No es el player: es la portada con el boton de play horneado,
                enlazada al post. Los clientes de correo no ejecutan iframes ni
                JS, asi que el unico embed honesto es una imagen que lleva al
                video. En Gmail y Apple Mail el GIF se mueve; donde no anima, el
                primer fotograma ya trae el boton. */}
            {videoCardUrl && (
              <Link href={postUrl} style={{ textDecoration: 'none' }}>
                <Img
                  src={videoCardUrl}
                  alt="Ver el video"
                  width="552"
                  style={videoCardStyle}
                />
              </Link>
            )}

            {/* Post image */}
            {postImageUrl && (
              <Img
                src={postImageUrl}
                alt="Imagen del post"
                width="552"
                style={postImageStyle}
              />
            )}

            <Link href={postUrl} style={ctaStyle}>
              Ver publicacion completa
            </Link>
          </Section>

          {/* Footer - Dark matching header */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Recibiste este email porque eres miembro de {BRAND.name}.
            </Text>
            <Link href={unsubscribeUrl} style={unsubscribeLinkStyle}>
              Desactivar notificaciones por email
            </Link>
            <Text style={addressStyle}>
              {BRAND.name} · {BRAND.siteUrl.replace(/^https?:\/\//, '')}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ============================================
// Inline Styles (required for email compatibility)
// Brand colors: Primary #683ACC, Amber glow, Dark #09090b
// ============================================

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#0f0f13',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: '40px 0',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#18181b',
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid rgba(139, 92, 246, 0.2)',
  boxShadow: '0 0 30px rgba(139, 92, 246, 0.1), 0 0 60px rgba(139, 92, 246, 0.05)',
};

const headerStyle: React.CSSProperties = {
  padding: '24px',
  textAlign: 'center' as const,
  backgroundColor: '#09090b',
  borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
};

const logoStyle: React.CSSProperties = {
  borderRadius: '10px',
};

const headerTextStyle: React.CSSProperties = {
  color: '#f4f4f5',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
  letterSpacing: '-0.01em',
};

const authorSectionStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
};

const avatarStyle: React.CSSProperties = {
  borderRadius: '50%',
  objectFit: 'cover',
  border: '2px solid rgba(139, 92, 246, 0.3)',
};

const authorNameStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#e4e4e7',
  margin: 0,
};

const contentSectionStyle: React.CSSProperties = {
  padding: '24px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#f4f4f5',
  margin: '0 0 16px 0',
  lineHeight: '1.3',
};

const contentTextStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#a1a1aa',
  lineHeight: '1.6',
  margin: '0',
};

// Borde dorado tenue: separa la tarjeta del video del resto del cuerpo y la
// hermana con el boton de play que lleva horneado.
const videoCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '552px',
  borderRadius: '10px',
  marginTop: '20px',
  marginBottom: '4px',
  display: 'block',
  border: '1px solid rgba(255, 145, 1, 0.22)',
  boxShadow: '0 0 24px rgba(255, 145, 1, 0.10)',
};

const postImageStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '552px',
  borderRadius: '8px',
  marginTop: '20px',
  marginBottom: '24px',
  objectFit: 'cover' as const,
  border: '1px solid rgba(139, 92, 246, 0.15)',
};

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#683ACC',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '600',
  fontSize: '15px',
  marginTop: '24px',
  boxShadow: '0 0 20px rgba(104, 58, 204, 0.3)',
};

const footerStyle: React.CSSProperties = {
  padding: '20px 24px',
  backgroundColor: '#09090b',
  textAlign: 'center' as const,
  borderTop: '1px solid rgba(139, 92, 246, 0.1)',
};

const footerTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#52525b',
  margin: '0 0 8px 0',
};

const unsubscribeLinkStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8B5CF6',
  textDecoration: 'underline',
};

const addressStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#3f3f46',
  margin: '12px 0 0 0',
};

export default AdminAnnouncementEmail;
