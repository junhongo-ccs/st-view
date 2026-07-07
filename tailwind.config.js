/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#004386',
      },
      boxShadow: {
        float: '0 18px 60px rgb(15 23 42 / 0.22)',
      },
    },
  },
  plugins: [],
};
