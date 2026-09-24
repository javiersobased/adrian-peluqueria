/** @type {import('tailwindcss').Config} */

// Los colores de marca leen tokens CSS (canales RGB) definidos en src/index.css.
// Sus valores por defecto son los del layout "classic"; cada layout o negocio los sobrescribe.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

// La escala neutra (zinc) y el blanco también leen variables: sus valores por defecto son los de
// Tailwind y el motor de temas los tiñe con la marca de cada negocio (ver src/themes/engine).
const neutral = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const zincSteps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '850', '900', '950'];

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        white: neutral('white'),
        fg: {
          DEFAULT: token('text'),
          muted: token('text-muted'),
        },
        line: token('border'),
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
          contrast: token('accent-contrast'),
        },
        surface: {
          DEFAULT: token('surface'),
          soft: token('surface-soft'),
          muted: token('surface-muted'),
        },
        zinc: Object.fromEntries(zincSteps.map((step) => [step, neutral(`zinc-${step}`)])),
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
        theme: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },
      boxShadow: {
        theme: 'var(--shadow-card)',
      },
      spacing: {
        section: 'var(--section-py)',
      },
    },
  },
  plugins: [],
};
