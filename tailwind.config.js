/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        /**
         * "Short viewport" — a phone held in landscape (~390px tall), which is
         * the ONLY orientation this app runs in on touch devices (LandscapeGate
         * blocks portrait). Deliberately height-based rather than the built-in
         * `landscape:` variant: every desktop window is landscape too, and
         * panel layouts tuned for a 390px-tall phone must not follow the user
         * onto a 900px-tall laptop.
         */
        short: { raw: "(max-height: 560px)" },
      },
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
