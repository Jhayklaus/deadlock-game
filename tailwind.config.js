// package.json sets "type": "module", so this config is ESM — the plugin is
// imported rather than require()'d.
import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Body copy.
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // UI headings — geometric, modern, legible at every size.
        heading: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        // Per-mode display faces (also available as `.font-display`, which
        // resolves to whichever face the active theme declares).
        creepster: ['Creepster', 'cursive'],
        nosifer: ['Nosifer', 'cursive'],
        playfair: ['Playfair Display', 'Georgia', 'serif'],
        oswald: ['Oswald', 'sans-serif'],
        'share-tech': ['Share Tech Mono', 'monospace'],
      },
      colors: {
        // ── Themed tokens ──────────────────────────────────────────────────
        // Driven by the `data-theme` attribute (see src/index.css). Stored as
        // RGB triplets so every opacity modifier works: `bg-surface/60`,
        // `border-accent/30`, `text-ink-muted/70`.
        base: 'rgb(var(--bg-base) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        edge: 'rgb(var(--edge) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },

        // ── Fixed semantic tokens ──────────────────────────────────────────
        // Deliberately NOT themed: danger must read as danger in every mode.
        background: '#020617',
        primary: '#f59e0b',
        secondary: '#64748b',
        danger: '#ef4444',
        success: '#22c55e',
        warning: '#eab308',
        info: '#38bdf8',
      },
      fontSize: {
        // Tighter tracking as type scales up, so large titles stay cohesive.
        'display-sm': ['2rem',   { lineHeight: '1.1',  letterSpacing: '-0.01em' }],
        'display':    ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-lg': ['3.75rem', { lineHeight: '1',    letterSpacing: '-0.025em' }],
        'display-xl': ['5rem',    { lineHeight: '0.95', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        // Accent-tinted elevation, so raised surfaces pick up the mode colour.
        'accent-sm': '0 2px 10px -2px rgb(var(--accent) / 0.25)',
        'accent': '0 8px 30px -6px rgb(var(--accent) / 0.3)',
        'accent-lg': '0 16px 50px -10px rgb(var(--accent) / 0.4)',
        'inner-top': 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      },
      transitionTimingFunction: {
        // Decelerating ease — motion that settles instead of stopping dead.
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'zoom-in': 'zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        // Referenced by the game-over replay icons and the Medium's ghost.
        // Both were in the markup long before they were ever defined here, so
        // five usages were silently doing nothing.
        'spin-slow': 'spin 6s linear infinite',
        'bounce-slow': 'bounce 2.4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.2s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'shake': 'shake 0.4s ease-in-out',
        'flip-in': 'flipIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'sweep': 'sweep 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        zoomIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        // Accent halo that swells and recedes — for live/urgent states.
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--accent) / 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgb(var(--accent) / 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        // Barely-there scale, to keep idle screens feeling alive.
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.03)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
        // Card turning over — role reveals.
        flipIn: {
          '0%': { opacity: '0', transform: 'rotateY(-90deg) scale(0.9)' },
          '100%': { opacity: '1', transform: 'rotateY(0) scale(1)' },
        },
        // Indeterminate progress bar.
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'card-gradient': 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        // Faint accent-tinted grid, for map and board surfaces.
        'grid-faint':
          'linear-gradient(rgb(var(--edge) / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--edge) / 0.35) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-sm': '24px 24px',
        'grid-md': '40px 40px',
      },
    },
  },
  plugins: [
    // Supplies the `animate-in` / `fade-in-0` / `slide-in-from-*` utilities
    // that 24 components already reference. Without it those 65 class usages
    // silently did nothing.
    tailwindcssAnimate,
  ],
}
