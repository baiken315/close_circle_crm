import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral + status palettes are driven by CSS variables (see index.css)
        // so the light/dark theme can swap them without `dark:` variants.
        slate: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [
            n,
            `rgb(var(--slate-${n}) / <alpha-value>)`,
          ])
        ),
        rose: { ...colors.rose, 300: 'rgb(var(--rose-300) / <alpha-value>)', 400: 'rgb(var(--rose-400) / <alpha-value>)' },
        emerald: { ...colors.emerald, 300: 'rgb(var(--emerald-300) / <alpha-value>)', 400: 'rgb(var(--emerald-400) / <alpha-value>)' },
        amber: { ...colors.amber, 300: 'rgb(var(--amber-300) / <alpha-value>)', 400: 'rgb(var(--amber-400) / <alpha-value>)' },
        accent: {
          DEFAULT: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l))',
          50: 'hsl(var(--accent-h) var(--accent-s) 95%)',
          100: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l-100))',
          200: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l-200))',
          300: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l-300))',
          400: 'hsl(var(--accent-h) var(--accent-s) 60%)',
          500: 'hsl(var(--accent-h) var(--accent-s) 50%)',
          600: 'hsl(var(--accent-h) var(--accent-s) 40%)',
          700: 'hsl(var(--accent-h) var(--accent-s) 30%)',
          800: 'hsl(var(--accent-h) var(--accent-s) 20%)',
          900: 'hsl(var(--accent-h) var(--accent-s) 10%)',
        },
      },
      fontFamily: {
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      spacing: {
        density: 'calc(var(--density) * 1rem)',
      },
    },
  },
  plugins: [],
} satisfies Config;
