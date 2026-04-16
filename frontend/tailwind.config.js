/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#071824",
          900: "#0c2535",
          800: "#173952",
          700: "#2a4f6b"
        },
        mint: {
          500: "#22c58b",
          600: "#15a373",
          700: "#0f7e5a"
        },
        amber: {
          400: "#f4bf4f",
          500: "#df9f2f"
        }
      },
      boxShadow: {
        glow: "0 24px 50px rgba(9, 29, 46, 0.24)"
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        floatIn: "floatIn 420ms ease-out both"
      }
    }
  },
  plugins: []
};
