/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0d14',
        surface: '#111726',
        surfaceBorder: '#1e293b',
        localGreen: '#10b981',
        cloudBlue: '#3b82f6',
        relaxAmber: '#f59e0b',
        escalateRed: '#ef4444',
        simulatedGrey: '#64748b',
      },
    },
  },
  plugins: [],
};
