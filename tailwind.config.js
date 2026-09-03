/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        marble: {
          DEFAULT: '#f5f3f0',
          soft: '#faf9f7',
          dark: '#e8e5e0',
        },
        ink: {
          DEFAULT: '#0a0a0a',
          soft: '#1a1a1a',
          muted: '#2a2a2a',
        },
        wood: {
          DEFAULT: '#8b6f47',
          light: '#a0826d',
          dark: '#6b5340',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        app: '480px',
      },
    },
  },
  plugins: [],
};
