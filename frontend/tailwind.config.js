/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        steam: {
          bg: '#171a21',
          'bg-deep': '#0e1015',
          surface: '#1b2838',
          'surface-light': '#2a475e',
          card: '#1e2a3a',
          'card-hover': '#274060',
          border: 'rgba(255,255,255,0.08)',
          'border-light': 'rgba(255,255,255,0.15)',
          blue: '#1a9fff',
          'blue-dim': '#417a9b',
          'blue-glow': 'rgba(26,159,255,0.2)',
          green: '#4c6b22',
          'green-light': '#a4d007',
          text: '#c7d5e0',
          white: '#ffffff',
          muted: '#8f98a0',
          dim: '#5c6773',
          verified: '#4ade80',
          warning: '#d29922',
          danger: '#f85149',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.5)',
        'glow': '0 0 20px rgba(26,159,255,0.4)',
        'hover': '0 8px 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-right': 'slideRight 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideRight: { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
