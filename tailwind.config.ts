import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contexts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
          hover: 'var(--card-hover)',
        },
        card: {
          DEFAULT: 'var(--card)',
          hover: 'var(--card-hover)',
          active: 'var(--card-active)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
          accent: 'var(--border-accent)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted)',
        },
        secondary: {
          DEFAULT: 'var(--card-hover)',
          foreground: 'var(--foreground)',
        },
        accent: {
          DEFAULT: 'var(--card-hover)',
          foreground: 'var(--foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
        },
        neon: {
          purple: 'var(--neon-purple)',
          accent: 'var(--accent-purple)',
        },
        gold: {
          DEFAULT: 'rgb(var(--gold-rgb) / <alpha-value>)',
          bright: 'rgb(var(--gold-bright-rgb) / <alpha-value>)',
          dark: 'rgb(var(--gold-dark-rgb) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: '#ffffff',
        },
        error: {
          DEFAULT: 'var(--error)',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: '#0f172a',
        },
        glass: {
          border: 'var(--glass-border)',
          'border-strong': 'var(--glass-border-strong)',
        },
      },
      // La escala baja que faltaba. Tailwind no trae nada bajo `text-xs` (12px), así

      // que 242 lugares del código lo inventaron a mano: 154 `text-[10px]` y 88

      // `text-[11px]`. No era desorden — era un escalón inexistente. Ahora tiene

      // nombre, y de paso la guía deja de pedir valores arbitrarios.

      fontSize: {

        '3xs': ['0.625rem', { lineHeight: '0.875rem' }],  // 10px · micro-etiquetas, sellos, contadores

        '2xs': ['0.6875rem', { lineHeight: '1rem' }],     // 11px · metadatos, timestamps, ayudas

      },

      // Los radios, con el nombre de la ley. `rounded-xl` (12px) sigue siendo la

      // superficie base y no se toca: ya era el 96% de los usos del JSX.

      borderRadius: {

        sello: 'var(--r-sello)',

        control: 'var(--r-control)',

        base: 'var(--r-base)',

        mayor: 'var(--r-mayor)',

      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
        inter: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        'space-grotesk': ['var(--font-space-grotesk)', 'Space Grotesk', 'system-ui', 'sans-serif'],
        'jetbrains': ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
        playfair: ['var(--font-playfair)', 'Playfair Display', 'serif'],
        lora: ['var(--font-lora)', 'Lora', 'serif'],
        // Alias semantico Titaniumorphism: serif elegante para hero / manifesto
        display: ['var(--font-playfair)', 'Playfair Display', 'Garamond', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        // Elevation system (Stripe-inspired layered shadows)
        'elevation-xs': 'var(--shadow-xs)',
        'elevation-sm': 'var(--shadow-sm)',
        'elevation-md': 'var(--shadow-md)',
        'elevation-lg': 'var(--shadow-lg)',
        // Glow system (standardized)
        'glow-purple': 'var(--glow-purple)',
        'glow-purple-strong': 'var(--glow-purple-strong)',
        'glow-gold': 'var(--glow-gold)',
        'glow-gold-strong': 'var(--glow-gold-strong)',
        // Glass shadows
        'glass': '0 8px 32px 0 var(--glass-shadow), inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 -1px 0 0 rgba(0, 0, 0, 0.04)',
        'glass-strong': '0 12px 48px 0 var(--glass-shadow), inset 0 1px 0 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 0 rgba(0, 0, 0, 0.06)',
        'glass-glow': '0 0 20px var(--glass-glow), 0 0 40px var(--glass-shadow)',
        // Legacy compat (mapped to new system)
        'neon-purple': 'var(--glow-purple)',
        'neon-purple-lg': 'var(--glow-purple-strong)',
        'purple-glow': 'var(--glow-purple-strong)',
        'card': 'var(--shadow-xs)',
        'card-hover': 'var(--shadow-md)',
        'card-elevated': 'var(--shadow-lg)',
        'notification': 'var(--shadow-sm)',
        'notification-hover': 'var(--shadow-md)',
      },
      borderColor: {
        // Color por defecto para `border` - morado premium en lugar de gris
        DEFAULT: 'var(--glass-border)',
        glass: 'var(--glass-border)',
        'glass-strong': 'var(--glass-border-strong)',
      },
      backdropBlur: {
        'glass': '24px',
        'glass-strong': '40px',
      },
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'theme': '300ms',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out-expo)',
        'out-back': 'var(--ease-out-back)',
        'standard': 'var(--ease-standard)',
      },
      animation: {
        'glow': 'glow 3s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'float-up': 'float-up 3s ease-out forwards',
      },
      keyframes: {
        glow: {
          'from': { textShadow: '0 2px 10px rgba(var(--primary-rgb), 0.3)' },
          'to': { textShadow: '0 2px 20px rgba(var(--primary-rgb), 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.3)' },
          '50%': { boxShadow: '0 0 35px rgba(var(--primary-rgb), 0.5)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.15)' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '70%': { transform: 'translateY(-200px) scale(1.1)', opacity: '0.8' },
          '100%': { transform: 'translateY(-280px) scale(0.8)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
