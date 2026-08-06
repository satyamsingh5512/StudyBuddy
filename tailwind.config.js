/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '475px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      /* RESPONSIVE FIX: Extended breakpoints for 4K and ultrawide displays */
      '3xl': '1920px',
      '4xl': '2560px',
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        'pastel-blue': '#c9daff',

        /* ---- StudyBuddy design language ----
         * Flat surfaces, one electric-blue accent, low-alpha ink hairlines.
         * Use these for anything authored in the current idiom; the HSL tokens
         * above are kept so pre-existing views keep compiling.
         */
        page: 'var(--page)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
        },
        /* Channel-based so opacity modifiers work: `bg-ink/[0.03]`, `ring-brand/20`. */
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        'muted-ink': 'var(--muted-ink)',
        brand: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          light: 'var(--accent-light)',
          subtle: 'var(--accent-subtle)',
        },
        'on-accent': {
          DEFAULT: 'var(--on-accent)',
          muted: 'var(--on-accent-muted)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--hairline-strong)',
          accent: 'var(--border-accent)',
          'accent-strong': 'var(--border-accent-strong)',
        },
      },
      fontFamily: {
        /* JetBrains Mono is the body face, not just for code. */
        sans: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        heading: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        mono: ['var(--font-mono)', 'monospace'],
        /* Editorial serif for pull quotes / empty states. */
        serif: ['var(--font-newsreader)', 'Georgia', 'serif'],
        /* Kept so anything still asking for Inter/Outfit renders deliberately. */
        inter: ['var(--font-inter)', 'sans-serif'],
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.16, 1, 0.3, 1)',
        pop: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-soft': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      transitionDuration: {
        400: '400ms',
        700: '700ms',
      },
      transitionDelay: {
        400: '400ms',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        neo: '4px 4px 0px 0px #000000',
        'neo-sm': '2px 2px 0px 0px #000000',
        'neo-lg': '8px 8px 0px 0px #000000',
        'neo-dark': '4px 4px 0px 0px #757373',
        'neo-sm-dark': '2px 2px 0px 0px #757373',
        'neo-lg-dark': '8px 8px 0px 0px #757373',
        /* iOS / glassmorphic soft shadows */
        glass: '0 8px 32px -8px rgba(17, 12, 46, 0.12), 0 2px 8px -2px rgba(17, 12, 46, 0.06)',
        'glass-lg':
          '0 24px 64px -16px rgba(17, 12, 46, 0.20), 0 8px 24px -8px rgba(17, 12, 46, 0.10)',
        'glass-sm': '0 2px 12px -4px rgba(17, 12, 46, 0.10)',
        ios: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(0,0,0,0.10)',
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '64px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        aurora: {
          from: {
            backgroundPosition: '50% 50%, 50% 50%',
          },
          to: {
            backgroundPosition: '350% 50%, 350% 50%',
          },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        spotlight: {
          '0%': {
            opacity: '0',
            transform: 'translate(-72%, -62%) scale(0.5)',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(-50%,-40%) scale(1)',
          },
        },

        /* ---- StudyBuddy motion set ---- */
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'cell-pop': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'task-check': {
          '0%': { opacity: '0', transform: 'scale(0)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'task-done': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(12px)' },
        },
        'tap-pulse': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '70%, 100%': { opacity: '0', transform: 'scale(1.08)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'blob-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(3%, -4%) scale(1.06)' },
          '66%': { transform: 'translate(-3%, 3%) scale(0.96)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        aurora: 'aurora 60s linear infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        spotlight: 'spotlight 2s ease .75s 1 forwards',

        /* ---- StudyBuddy motion set ---- */
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-up': 'sheet-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'cell-pop': 'cell-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'task-check': 'task-check 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'task-done': 'task-done 0.3s ease-out 0.4s forwards',
        'tap-pulse': 'tap-pulse 1.8s ease-out infinite',
        'toast-in': 'toast-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'toast-out': 'toast-out 0.3s ease-in forwards',
        'blob-drift': 'blob-drift 24s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
