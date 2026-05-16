import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        panel: '#0f172a',
        accent: '#0ea5e9',
        signal: '#22c55e'
      },
      boxShadow: {
        glow: '0 0 40px rgba(14, 165, 233, 0.18)'
      }
    }
  },
  plugins: []
};

export default config;
