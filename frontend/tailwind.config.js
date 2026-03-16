/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        steam: {
          bg: '#0d1117',
          surface: '#161b22',
          card: '#1e2a3a',
          'card-hover': '#253447',
          border: '#30363d',
          accent: '#4fc3f7',
          'accent-dark': '#0288d1',
          'accent-glow': 'rgba(79,195,247,0.15)',
          text: '#e6edf3',
          muted: '#8b949e',
          verified: '#3fb950',
          warning: '#d29922',
          danger: '#f85149',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'glow': '0 0 20px rgba(79,195,247,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
