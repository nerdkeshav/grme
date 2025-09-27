/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#000000", // Black - main brand color
        secondary: "#FFFFFF", // White - for accents
        background: "rgb(var(--background))",
        surface: "rgb(var(--surface))",
        text: "rgb(var(--text))",
        accent: "rgb(var(--accent))",
        muted: "rgb(var(--muted))",
        border: "rgb(var(--border))",
        hover: "rgb(var(--hover))",
        buttonText: "rgb(var(--buttonText))",
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fadeIn': 'fadeIn 1s ease forwards',
        'slideUp': 'slideUp 1s ease forwards',
        'slideDown': 'slideDown 1s ease forwards',
        'floatUp': 'floatUp 1.2s ease forwards',
        'slideInLeft': 'slideInLeft 1s ease forwards',
        'slideInRight': 'slideInRight 1s ease forwards',
        'pulse': 'pulse 3s ease-in-out infinite',
        'wave': 'wave 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        floatUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '0.9' },
        },
        wave: {
          '0%, 100%': { height: '0.5rem' },
          '50%': { height: '1rem' },
        },
      },
    },
  },
  plugins: [],
} 