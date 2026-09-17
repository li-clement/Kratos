/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a2332',
        role: {
          system: '#f43f5e',
          user: '#3b82f6',
          reasoning: '#48bb78',
          content: '#ed8936',
        },
      },
      fontSize: {
        '2xs': '10px',
      },
    },
  },
  plugins: [],
};
