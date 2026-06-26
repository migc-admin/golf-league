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
          50:  '#fffbe6',
          100: '#ffe088',
          200: '#e9c349',
          300: '#cba72f',
          400: '#a08020',
          500: '#735c00',
          600: '#574500',
          700: '#4e3d00',
          800: '#3a2d00',
          900: '#241a00',
        },
      },
      fontFamily: {
        sans:    ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif:   ['Manrope', 'DM Sans', 'sans-serif'],
        display: ['Manrope', 'DM Sans', 'sans-serif'],
      },
      backgroundImage: {
        'augusta-gradient': 'linear-gradient(150deg, #0b2318 0%, #1B4332 45%, #1f5c3e 100%)',
      },
    },
  },
  plugins: [],
}
