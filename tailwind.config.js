/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0E14',
        surface: {
          DEFAULT: '#131824',
          muted: '#1A2130',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: '#222B3D'
        },
        mint: {
          400: '#10F0A0',
          500: '#00E599',
          600: '#00C782',
        },
        ice: {
          400: '#38BDF8',
          500: '#0EA5E9',
        },
        rose: {
          400: '#FB7185',
          500: '#F43F5E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'mint-glow': '0 0 25px -5px rgba(16, 240, 160, 0.3)',
        'ice-glow': '0 0 25px -5px rgba(56, 189, 248, 0.3)',
        'rose-glow': '0 0 25px -5px rgba(251, 113, 133, 0.3)',
      }
    },
  },
  plugins: [],
}
