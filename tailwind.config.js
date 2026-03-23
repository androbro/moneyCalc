/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        neo: {
          bg: '#dde4ee',
          surface: '#e8eef6',
          raised: '#ecf0f8',
          sunken: '#d5dce8',
          border: '#b8c4d4',
          text: '#1e293b',
          muted: '#64748b',
          subtle: '#94a3b8',
          icon: '#475569',
        },
      },
      boxShadow: {
        'neo-sm': '4px 4px 10px rgba(163, 177, 198, 0.55), -4px -4px 10px rgba(255, 255, 255, 0.92)',
        'neo': '8px 8px 18px rgba(163, 177, 198, 0.58), -8px -8px 18px rgba(255, 255, 255, 0.95)',
        'neo-lg': '12px 12px 28px rgba(163, 177, 198, 0.52), -12px -12px 28px rgba(255, 255, 255, 0.92)',
        'neo-inset': 'inset 5px 5px 12px rgba(163, 177, 198, 0.55), inset -5px -5px 12px rgba(255, 255, 255, 0.95)',
        'neo-inset-sm': 'inset 3px 3px 8px rgba(163, 177, 198, 0.5), inset -3px -3px 8px rgba(255, 255, 255, 0.9)',
        'neo-pressed': 'inset 6px 6px 14px rgba(163, 177, 198, 0.58), inset -6px -6px 14px rgba(255, 255, 255, 0.88)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
