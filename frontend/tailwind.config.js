/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: "#0C0D0F",
          card: "#16171B",
          cardHover: "#1E2026",
          lightBg: "#F5F5F7",
          lightCard: "#FFFFFF",
          blue: "#0A84FF",
          blueHover: "#0071E3",
          green: "#30D158",
          amber: "#FF9F0A",
          red: "#FF453A",
          border: "rgba(255, 255, 255, 0.08)",
          lightBorder: "rgba(0, 0, 0, 0.08)",
          subtext: "#9CA3AF",
          text: "#F3F4F6",
          lightText: "#1D1D1F"
        }
      },
      fontFamily: {
        sans: [
          "Montserrat",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif"
        ],
      },
      boxShadow: {
        apple: "0 4px 20px rgba(0, 0, 0, 0.35)",
        "apple-light": "0 4px 20px rgba(0, 0, 0, 0.04)",
        modal: "0 20px 60px rgba(0, 0, 0, 0.65)",
      },
      borderRadius: {
        "2xl": "16px",
        xl: "12px",
      }
    },
  },
  plugins: [],
}
