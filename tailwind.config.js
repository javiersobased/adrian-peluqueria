/** @type {import('tailwindcss').Config} */

// Los colores de marca leen tokens CSS (canales RGB) definidos en src/index.css.
// Sus valores por defecto son los del layout "classic"; cada layout o negocio los sobrescribe.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        marble: {
          DEFAULT: token('marble'),
          soft: token('marble-soft'),
          dark: token('marble-dark'),
        },
        ink: {
          DEFAULT: token('surface'),
          soft: token('surface-soft'),
          muted: token('surface-muted'),
        },
        wood: {
          DEFAULT: '#8b6f47',
          light: '#a0826d',
          dark: '#6b5340',
        },
        gold: {
          DEFAULT: token('accent'),
          light: token('accent-light'),
          dark: token('accent-dark'),
          soft: 'rgb(var(--color-accent) / 0.251)',
        },
        accent: {
          DEFAULT: token('accent'),
          light: token('accent-light'),
          dark: token('accent-dark'),
        },
        surface: {
          DEFAULT: token('surface'),
          soft: token('surface-soft'),
          muted: token('surface-muted'),
        },
        zinc: {
          850: '#1c1c1e',
          950: '#0c0c0e',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
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
