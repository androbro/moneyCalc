/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand: Orange accent (replaces sky-blue)
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Dark glass design system
        neo: {
          bg:      '#0b0f19',
          surface: '#131926',
          raised:  '#182030',
          sunken:  '#070b11',
          border:  '#252e42',
          text:    '#e2e8f4',
          muted:   '#8897b5',
          subtle:  '#4a5b7a',
          icon:    '#5f7494',
        },
      },
      boxShadow: {
        'neo-sm':       '0 2px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        'neo':          '0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
        'neo-lg':       '0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
        'neo-inset':    'inset 0 2px 10px rgba(0,0,0,0.55)',
        'neo-inset-sm': 'inset 0 1px 6px rgba(0,0,0,0.45)',
        'neo-pressed':  'inset 0 3px 14px rgba(0,0,0,0.65)',
        'glow-accent':  '0 0 24px rgba(234,88,12,0.55), 0 0 48px rgba(234,88,12,0.2)',
        'glow-sm':      '0 0 14px rgba(234,88,12,0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
