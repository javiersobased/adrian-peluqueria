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
          soft: '#121212',
          muted: '#1a1a1a',
        },
        wood: {
          DEFAULT: '#8b6f47',
          light: '#a0826d',
          dark: '#6b5340',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#e6c84e',
          dark: '#b8941f',
          soft: '#d4af3740',
        },
        zinc: {
          850: '#1c1c1e',
          950: '#0c0c0e',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        app: '480px',
      },
      borderRadius: {
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
