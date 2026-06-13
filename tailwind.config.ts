import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "22px",
      screens: { "2xl": "1220px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      colors: {
        // shadcn-semantic names → design tokens (raw var(), no hsl wrapper)
        border: "var(--line)",
        input: "var(--line)",
        ring: "var(--accent)",
        background: "var(--bg)",
        foreground: "var(--ink)",
        primary: { DEFAULT: "var(--accent)", foreground: "var(--accent-ink)" },
        secondary: { DEFAULT: "var(--panel)", foreground: "var(--ink)" },
        muted: { DEFAULT: "var(--panel)", foreground: "var(--muted)" },
        accent: { DEFAULT: "var(--panel)", foreground: "var(--ink)" },
        destructive: { DEFAULT: "var(--neg)", foreground: "#ffffff" },
        card: { DEFAULT: "var(--card)", foreground: "var(--ink)" },
        popover: { DEFAULT: "var(--card)", foreground: "var(--ink)" },
        // design-direct names for new components
        ink: "var(--ink)",
        panel: "var(--panel)",
        line: "var(--line)",
        track: "var(--track)",
        accent2: "var(--accent2)",
        accentInk: "var(--accent-ink)",
        win: "var(--pos)",
        draw: "var(--draw)",
        loss: "var(--neg)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      boxShadow: {
        kit: "var(--shadow)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
