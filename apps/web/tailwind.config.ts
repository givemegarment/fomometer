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
        // Matched to the reference look: near-black #141415, white type, one green.
        bg: {
          base: '#141415',
          card: '#1B1B1D',
          elev: '#222225',
          chip: '#2A2A2E'
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)'
        },
        text: {
          primary: '#FFFFFF',
          muted: '#9A9EA5',
          dim: '#8A8E95'
        },
        // Brand green: primary buttons, live state, the score scale, price up.
        accent: {
          DEFAULT: '#00B24B',
          strong: '#009A41',
          deep: 'rgba(0,178,75,0.14)',
          // Button fill: the brand green darkened until white text passes WCAG AA (4.76:1).
          button: '#00853A',
          'button-hover': '#007A34'
        },
        success: { DEFAULT: '#1FCB64', soft: 'rgba(31,203,100,0.14)' },
        danger: { DEFAULT: '#FF5A5F', soft: 'rgba(255,90,95,0.14)' },
        warning: { DEFAULT: '#F1BA4A', soft: 'rgba(241,186,74,0.14)' }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace']
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px', letterSpacing: '0.04em' }],
        // Display scale taken from the reference: weight 600, tight tracking.
        'display-2xl': ['clamp(3rem,8vw,6rem)', { lineHeight: '0.95', letterSpacing: '-0.035em', fontWeight: '600' }],
        'display-xl': ['clamp(2.25rem,4.5vw,3.5rem)', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display-lg': ['clamp(1.75rem,3vw,2.75rem)', { lineHeight: '1.12', letterSpacing: '-0.022em', fontWeight: '600' }],
        'display-md': ['clamp(1.5rem,2.2vw,2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }]
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '28px',
        '3xl': '40px',
        pill: '999px'
      },
      transitionTimingFunction: {
        // The reference's easing for reveals and hovers.
        snap: 'cubic-bezier(0.5, 0, 0, 1)',
        out: 'cubic-bezier(0.165, 0.84, 0.44, 1)'
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'bar-fill': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'nudge-down': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(4px)' } },
        breathe: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.045)' } }
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'nudge-down': 'nudge-down 1.6s ease-in-out infinite',
        breathe: 'breathe 20s ease-in-out infinite'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
