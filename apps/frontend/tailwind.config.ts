import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fade baked in (scripts/bake-fade.py): pure black/white as they used to render under the overlay.
        black: '#110f11',
        white: '#fffffe',
        // Warm "graphite" ramp: existing screens use zinc-* for text and
        // surfaces; remapping it lets them inherit the stone palette.
        zinc: {
          50: '#f9f4ed', 100: '#f2ebe2', 200: '#e7e0d7', 300: '#cbc5bf',
          400: '#a5a0a4', 500: '#807c81', 600: '#615e64', 700: '#413f46',
          800: '#2f2d32', 900: '#222025', 950: '#1d1b20',
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
          DEFAULT: 'var(--accent, #38c169)',
          fg: '#f5eee5',
        },
        board: {
          // Stone board: textures come from .sq-marble / .sq-slate,
          // these are the fallback fills underneath.
          light: '#cdcfd5',
          dark: '#505059',
          select: 'rgba(58,98,150,0.45)',
          highlight: 'rgba(58,98,150,0.35)',
          lastmove: 'rgba(58,98,150,0.35)',
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
