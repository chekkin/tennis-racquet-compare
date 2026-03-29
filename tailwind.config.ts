import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        court: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          700: '#15803d',
          900: '#14532d',
          950: '#052e16',
        },
      },
    },
  },
  plugins: [],
}

export default config
