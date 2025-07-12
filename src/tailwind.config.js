/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Scans all specified files for Tailwind classes
  ],
  theme: {
    extend: {
      // Define a custom color palette for a professional look
      colors: {
        'brand-bg': '#121827',      // Dark blue-gray background
        'brand-surface': '#1A2233', // Lighter surface color for cards/modals
        'brand-border': '#2A344A', // Subtle border color
        'brand-primary': '#FACC15', // Yellow/Gold for primary actions and highlights
        'brand-primary-hover': '#EAB308',
        'brand-secondary': '#38BDF8', // Light blue for secondary info
        'brand-player': '#0EA5E9',   // Specific color for Player
        'brand-banker': '#F43F5E',   // Specific color for Banker
        'brand-tie': '#22C55E',      // Specific color for Tie
        'brand-text-primary': '#F8FAFC', // Main text color (almost white)
        'brand-text-secondary': '#94A3B8', // Lighter text for subtitles
      },
      // Use the 'Inter' font family
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      // Add custom animations
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%, 100%': { 'box-shadow': '0 0 5px rgba(250, 204, 21, 0.5)' },
          '50%': { 'box-shadow': '0 0 20px rgba(250, 204, 21, 0.8)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        scaleIn: 'scaleIn 0.3s ease-out',
        glow: 'glow 2.5s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
