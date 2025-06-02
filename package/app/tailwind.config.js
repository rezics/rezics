/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': {
          'main': 'var(--mui-palette-primary-main)',
          'light': 'var(--mui-palette-primary-light)',
          'dark': 'var(--mui-palette-primary-dark)',
        },
        'secondary': {
          'main': 'var(--mui-palette-secondary-main)',
          'light': 'var(--mui-palette-secondary-light)',
          'dark': 'var(--mui-palette-secondary-dark)',
        },
      },
    },
  },
  plugins: [],
} 