import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(217 33% 17%)',
        background: 'hsl(222 47% 7%)',
        foreground: 'hsl(210 40% 96%)',
        primary: { DEFAULT: 'hsl(174 72% 40%)', foreground: 'hsl(0 0% 100%)' },
        muted: { DEFAULT: 'hsl(217 33% 17%)', foreground: 'hsl(215 20% 65%)' },
        card: { DEFAULT: 'hsl(222 47% 9%)', foreground: 'hsl(210 40% 96%)' }
      },
      borderRadius: { lg: '0.75rem', md: '0.5rem' }
    }
  },
  plugins: []
};

export default config;