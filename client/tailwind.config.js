/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: '#05070d',
          900: '#0a0e17',
          850: '#0f1420',
          800: '#141a28',
          700: '#1d2537',
          600: '#2a3449',
        },
        accent: {
          DEFAULT: '#38bdf8',
          soft: '#7dd3fc',
          deep: '#0284c7',
        },
        signal: {
          ok: '#34d399',
          warn: '#fbbf24',
          bad: '#f87171',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(56, 189, 248, 0.45)',
        inset: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
      },
      animation: {
        'pulse-slow': 'pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
