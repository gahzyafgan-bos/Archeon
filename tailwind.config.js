/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        museum: {
          void: "#0a0a0b",
          charcoal: "#141416",
          slate: "#1e1e22",
          stone: "#3a3a40",
          mist: "#8a8a92",
          bone: "#e8e6e1",
          gold: "#c9a961",
          "gold-dim": "#8f7940",
        },
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionTimingFunction: {
        museum: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
