import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#215A6B',
          50: '#E8F4F6',
          100: '#C5E3E9',
          200: '#9ECFD9',
          300: '#77BBC9',
          400: '#4FA7B9',
          500: '#215A6B',
          600: '#1C4D5C',
          700: '#17404D',
          800: '#12333E',
          900: '#0D262F',
        },
        accent: {
          DEFAULT: '#F8AE00',
          50: '#FFF8E5',
          100: '#FFECB3',
          200: '#FFE080',
          300: '#FFD44D',
          400: '#FFC81A',
          500: '#F8AE00',
          600: '#CC8F00',
          700: '#997000',
          800: '#665100',
          900: '#333200',
        },
        dark: '#1A1A1A',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
