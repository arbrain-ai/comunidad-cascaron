import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono, Playfair_Display, Lora } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { BRAND } from '@/shared/config/brand'
import './globals.css'
// La ley visual va DESPUÉS de globals: así gana la cascada.
import './ley.css'

// Professional default
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Modern, tech-forward, slightly creative
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

// For code/technical content
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

// Elegant serif for emphasis
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

// Readable, elegant serif
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})


const SUPABASE_ORIGIN = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null
  } catch {
    return null
  }
})()

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: BRAND.name,
  description: BRAND.tagline,
  generator: 'Next.js',
  manifest: '/manifest.json',
  applicationName: BRAND.name,
  icons: [
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png' },
    { rel: 'icon', url: '/favicon.png', type: 'image/png' },
    { rel: 'icon', url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    { rel: 'icon', url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRAND.shortName,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: BRAND.name,
    description: BRAND.tagline,
    url: BRAND.siteUrl,
    images: [{ url: '/logo.png' }],
  },
  twitter: {
    card: 'summary',
    title: BRAND.name,
    description: BRAND.tagline,
    images: ['/logo.png'],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Preconnect a Supabase: TODO dato del producto (auth, posts, realtime,
            storage) sale de aquí; ahorra DNS+TLS (~150-450ms en redes lentas)
            en el primer query de cada carga fría */}
        {SUPABASE_ORIGIN && (
          <>
            <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
          </>
        )}
      </head>
      <body className={`font-sans antialiased ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable} ${lora.variable}`} suppressHydrationWarning>
        <ThemeProvider defaultTheme="dark">
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </ThemeProvider>
        {/* Solo en Vercel: fuera de ahi sus scripts responden 404 */}
        {process.env.VERCEL && <Analytics />}
        {process.env.VERCEL && <SpeedInsights />}
      </body>
    </html>
  )
}
