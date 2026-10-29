import type { NextConfig } from 'next';

// Host de tu proyecto de Supabase (para optimizar imagenes de Storage).
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost').hostname;
  } catch {
    return 'localhost';
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Directorio de build configurable: NEXT_DIST_DIR=.next-verify npm run build
  // permite verificar un build sin pisar el `.next` de un `next start` activo.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // React Compiler: Enable for automatic memoization
  // Next.js 16 moved this out of experimental
  reactCompiler: true,

  // Turbopack enabled for dev (super fast)
  // Build uses --webpack flag due to Turbopack canary bug with react-hook-form
  turbopack: {},

  // Enable MCP Server for next-devtools MCP (required for AI agent access)
  experimental: {
    mcpServer: true,
    // Router cache del cliente: reusar el payload RSC de rutas ya visitadas o
    // prefetcheadas en vez de refetchearlo en cada navegación. dynamic=180s es
    // el mismo valor medido en la referencia (x-nextjs-stale-time: 180): junto
    // con prefetch={true} en el nav, el click a otra tab no espera red.
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },

  // Image Optimization Configuration
  images: {
    // Allow images from Supabase Storage and Google (OAuth avatars)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: SUPABASE_HOST,
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // Supabase Image Transformations (sbImage). Ver shared/lib/sbImage.ts
      {
        protocol: 'https',
        hostname: SUPABASE_HOST,
        port: '',
        pathname: '/storage/v1/render/image/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      // Giphy CDN (GIFs en posts/comentarios)
      {
        protocol: 'https',
        hostname: '*.giphy.com',
        port: '',
        pathname: '/**',
      },
      // YouTube thumbnails
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
    ],
    // Automatic WebP/AVIF conversion
    formats: ['image/avif', 'image/webp'],
    // Responsive breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 1 year
    minimumCacheTTL: 31536000,
  },

  // Cache headers for static assets
  async headers() {
    return [
      {
        // La geometría del mundo la genera el build y no cambia entre deploys.
        // Revalidarla en cada visita costaba un viaje de red para nada.
        source: '/map/:file(world-geometry.json|grain.png)',
        locale: false,
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|webp|avif)',
        locale: false,
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
