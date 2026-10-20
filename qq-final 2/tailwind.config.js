/** Tailwind, compiled at build time (replaces cdn.tailwindcss.com).
 *  The purple and fuchsia scales are remapped to the Q² brand purple (#5B3BEA at 600),
 *  so every existing class in the platform adopts the new brand without a rewrite. */
const brand = {
  50: "#F4F2FE", 100: "#EBE6FD", 200: "#D9D0FC", 300: "#C9BDFF", 400: "#AE9CFF",
  500: "#8E78F6", 600: "#5B3BEA", 700: "#4A2BD6", 800: "#3B22A8", 900: "#2E1C7E", 950: "#1C1250",
};
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // Built at runtime in Governed Movement: text-${c.c}-400
  safelist: [{ pattern: /^text-(emerald|blue|purple|fuchsia|indigo|yellow|red)-400$/ }],
  theme: {
    extend: {
      colors: { purple: brand, fuchsia: brand },
      fontFamily: {
        display: ["Schibsted Grotesk", "Helvetica Neue", "Arial", "sans-serif"],
        sans: ["IBM Plex Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
