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
          bg: "#0B0C0E",
          card: "#16181F",
          cardHover: "#1E202A",
          lightBg: "#F5F5F7",
          lightCard: "#FFFFFF",
          blue: "#0A84FF",
          blueHover: "#0071E3",
          green: "#30D158",
          amber: "#FF9F0A",
          red: "#FF453A",
          border: "rgba(255, 255, 255, 0.08)",
          lightBorder: "rgba(0, 0, 0, 0.08)",
          subtext: "#8E8E93",
          text: "#F5F5F7",
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
        apple: "0 4px 20px rgba(0, 0, 0, 0.25)",
        "apple-light": "0 4px 20px rgba(0, 0, 0, 0.04)",
        modal: "0 20px 60px rgba(0, 0, 0, 0.5)",
      },
      borderRadius: {
        "2xl": "16px",
        xl: "12px",
      }
    },
  },
  plugins: [],
}
