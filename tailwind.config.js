/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // MIGC brand palette
        augusta: {
          50:  '#f0f7f4',
          100: '#dceee6',
          200: '#b5d9c8',
          300: '#7dbfa3',
          400: '#4a9f7e',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#163727',
          800: '#0f2a1d',
          900: '#0b2318',
        },
        fairway: {
          50:  '#f0f7f4',
          100: '#dceee6',
          200: '#b5d9c8',
          300: '#7dbfa3',
          400: '#4a9f7e',
          500: '#2D6A4F',
          600: '#2D6A4F',
          700: '#1B4332',
          800: '#163727',
          900: '#0b2318',
          950: '#071a10',
        },
        gold: {
          50:  '#fdf9e7',
          100: '#F7EAB5',
          200: '#f0d97a',
          300: '#e8c84a',
          400: '#D4AF37',
          500: '#b8961e',
          600: '#9a7c17',
          700: '#7a6213',
          800: '#5c4a0f',
          900: '#3d310a',
        },
      },
      fontFamily: {
        sans:  ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'augusta-gradient': 'linear-gradient(150deg, #0b2318 0%, #1B4332 45%, #1f5c3e 100%)',
      },
    },
  },
  plugins: [],
}
