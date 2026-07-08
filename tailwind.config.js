/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Forest Green — the one accent color
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
        // Warm off-white surface family (Bone)
        surface: {
          DEFAULT:   '#fbfaf8',
          dim:       '#f4f3f0',
          low:       '#fbfaf8',
          container: '#f4f3f0',
          high:      '#eceae5',
          highest:   '#e3e1dc',
          outline:   '#a8a8a4',
          border:    '#ebe9e4',
        },
        // Ink — all text
        ink: {
          DEFAULT: '#1d1d1f',
          muted:   '#86868b',
        },
        // Status tints only — no third hue
        status: {
          'active-bg':    '#eaf1ec',
          'active-text':  '#1B4332',
          'upcoming-bg':  '#f4f1e4',
          'upcoming-text':'#8a6d1a',
        },
      },
      fontFamily: {
        sans:    ['Schibsted Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif:   ['Schibsted Grotesk', 'sans-serif'],
        display: ['Schibsted Grotesk', 'sans-serif'],
      },
      borderRadius: {
        sm:      '0.5rem',
        DEFAULT: '0.875rem',
        md:      '1rem',
        lg:      '1.25rem',
        xl:      '1.5rem',
        full:    '9999px',
      },
      boxShadow: {
        card:    '0 6px 24px rgba(0,0,0,.05)',
        float:   '0 20px 60px rgba(0,0,0,.35)',
        'card-sm': '0 2px 8px rgba(0,0,0,.04)',
      },
      maxWidth: {
        container: '1120px',
      },
    },
  },
  plugins: [],
}
