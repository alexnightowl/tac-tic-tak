import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0d10',
          soft: '#12151a',
          softer: '#1a1e25',
          card: '#171b22',
          border: '#242a33',
        },
        accent: {
          DEFAULT: 'var(--accent, #22c55e)',
          fg: '#0b0d10',
        },
        board: {
          light: '#ebecd0',
          dark: '#739552',
          select: 'rgba(255, 255, 0, 0.4)',
          highlight: 'rgba(255, 255, 0, 0.35)',
          lastmove: 'rgba(155, 199, 0, 0.41)',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
