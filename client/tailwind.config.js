/**
 * Celá paleta ide cez CSS premenné, ktoré nastavuje `applySkin()` zo
 * src/lib/skins.ts. Vďaka tomu prepnutie skinu neprekresľuje žiadne triedy -
 * `bg-base-900`, `text-slate-400` aj `border-white/10` len ukážu na inú farbu.
 */
const c = (token) => `rgb(var(--c-${token}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', ':is([data-skin="noir"], [data-skin="gray"])'],
  theme: {
    extend: {
      colors: {
        // `white` je v celom UI použitá ako vlasová linka / jemný prekryv, nie
        // ako doslovná biela - na svetlých skinoch preto ukazuje na takmer čiernu.
        white: c('overlay'),
        page: c('bg'),
        base: {
          950: c('base-950'),
          900: c('base-900'),
          850: c('base-850'),
          800: c('base-800'),
          700: c('base-700'),
          600: c('base-600'),
        },
        slate: {
          50: c('slate-50'),
          100: c('slate-100'),
          200: c('slate-200'),
          300: c('slate-300'),
          400: c('slate-400'),
          500: c('slate-500'),
          600: c('slate-600'),
          700: c('slate-700'),
          800: c('slate-800'),
          900: c('slate-900'),
        },
        accent: {
          DEFAULT: c('accent'),
          soft: c('accent-soft'),
          deep: c('accent-deep'),
        },
        signal: {
          ok: c('ok'),
          warn: c('warn'),
          bad: c('bad'),
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgb(var(--c-accent) / 0.45)',
        inset: 'inset 0 1px 0 0 rgb(var(--c-overlay) / 0.05)',
        panel: '0 1px 2px 0 rgb(var(--c-overlay) / 0.06)',
      },
      animation: {
        'pulse-slow': 'pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
