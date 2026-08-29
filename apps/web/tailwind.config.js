/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4f46e5', dark: '#4338ca', foreground: '#ffffff' },
        secondary: { DEFAULT: '#0ea5e9', foreground: '#ffffff' },
        neutral: { DEFAULT: '#64748b', foreground: '#0f172a' },
        success: { DEFAULT: '#16a34a', foreground: '#ffffff' },
        warning: { DEFAULT: '#d97706', foreground: '#ffffff' },
        error: { DEFAULT: '#dc2626', foreground: '#ffffff' },
      },
    },
  },
  plugins: [],
};
