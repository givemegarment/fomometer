import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1440px' }
    },
    extend: {
      colors: {
        bg: {
          base: '#0E0F12',
          card: '#15161A',
          elev: '#1B1D22',
          chip: '#22242B'
        },
        border: {
          DEFAULT: '#26282E',
          strong: '#34373F'
        },
        text: {
          primary: '#F4F4F5',
          muted: '#8A8D94',
          dim: '#82858D'
        },
        accent: {
          DEFAULT: '#AB9FF2',
          strong: '#6E54CC',
          deep: '#221C4E'
        },
        success: { DEFAULT: '#1FC16B', soft: 'rgba(31,193,107,0.14)' },
        danger: { DEFAULT: '#FF4D4F', soft: 'rgba(255,77,79,0.14)' },
        warning: { DEFAULT: '#F2C94C', soft: 'rgba(242,201,76,0.14)' }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace']
      },
      fontSize: {
        'display-xl': ['clamp(2.75rem,6vw,4.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['clamp(1.5rem,2.5vw,2rem)', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }]
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        pill: '999px'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
