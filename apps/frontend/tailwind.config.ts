import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm "graphite" ramp: existing screens use zinc-* for text and
        // surfaces; remapping it lets them inherit the stone palette.
        zinc: {
          50: '#f6f2ec', 100: '#efe9e1', 200: '#e4ded5', 300: '#c8c2bd',
          400: '#a19da3', 500: '#7c7880', 600: '#5d5a62', 700: '#3d3b43',
          800: '#2a282f', 900: '#1b1a1f', 950: '#141317',
        },
        // Ember on stone — mirrors the --eos-* CSS variables in globals.css
        eos: {
          ink: 'var(--eos-ink)',
          shade: 'var(--eos-shade)',
          slate: 'var(--eos-slate)',
          rise: 'var(--eos-rise)',
          seam: 'var(--eos-seam)',
          well: 'var(--eos-well)',
          bone: 'var(--eos-bone)',
          ash: 'var(--eos-ash)',
          dust: 'var(--eos-dust)',
          ember: 'var(--eos-ember)',
          embers: 'var(--eos-embers)',
          rose: 'var(--eos-rose)',
          sage: 'var(--eos-sage)',
          hl: 'var(--eos-hl)',
        },
        bg: {
          DEFAULT: 'var(--eos-ink)',
          soft: 'var(--eos-shade)',
          softer: 'var(--eos-rise)',
          card: 'var(--eos-slate)',
          border: 'var(--eos-seam)',
        },
        accent: {
          DEFAULT: 'var(--accent, #22c55e)',
          fg: '#f3ece4',
        },
        board: {
          // Stone board: textures come from .sq-marble / .sq-slate,
          // these are the fallback fills underneath.
          light: '#c9ccd6',
          dark: '#4b4c57',
          select: 'rgba(47, 95, 158, 0.45)',
          highlight: 'rgba(47, 95, 158, 0.35)',
          lastmove: 'rgba(47, 95, 158, 0.35)',
        },
      },
      borderRadius: {
        control: '6px',
        card: '10px',
        sheet: '16px',
      },
      fontFamily: {
        serif: ['var(--font-cinzel)', 'Times New Roman', 'serif'],
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
