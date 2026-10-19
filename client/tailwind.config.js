/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#163D2B',
          50: '#EAF1ED',
          100: '#C8D9CF',
          200: '#9AB8A7',
          300: '#6B967F',
          400: '#3D7557',
          500: '#246B45',
          600: '#1E5A3A',
          700: '#163D2B',
          800: '#102B1F',
          900: '#0A1B14',
        },
        agri: {
          green: '#246B45',
          emerald: '#38A169',
        },
        ivory: {
          DEFAULT: '#F7F5ED',
          50: '#FDFCF8',
          100: '#F7F5ED',
          200: '#EFEAD9',
          300: '#E0D9C2',
        },
        soil: {
          DEFAULT: '#75533A',
          light: '#9A7252',
          dark: '#5A3E29',
        },
        charcoal: '#18231C',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        'ultra-wide': '0.25em',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '100rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'draw-stroke': {
          from: { strokeDashoffset: '1000' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
};
