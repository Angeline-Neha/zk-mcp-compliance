/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Case board palette
        paper:    "#EDE6D6",
        ink:      "#1F1B16",
        "case-red":      "#B23A2F",
        "verified-green":"#2F4A3B",
        brass:    "#B08D57",
        redact:   "#14110E",
        // Legacy aliases kept for existing components
        "ink-raised":  "#2A2318",
        "ink-panel":   "#261F14",
        slate: {
          structure: "#4A3F2E",
          line:      "#332C1F",
          500:       "#8A7A62",
          400:       "#A89A82",
          300:       "#C8B99A",
          200:       "#DDD0B8",
        },
        pass:  { DEFAULT: "#2F4A3B", light: "#4A8C6A", glow: "#7DC49A" },
        fail:  { DEFAULT: "#B23A2F", light: "#D45A4A", glow: "#E88070" },
        data:  { DEFAULT: "#B08D57", dim: "#7A6035" },
      },
      fontFamily: {
        stamp:   ["'Special Elite'", "serif"],
        display: ["'Archivo'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      transitionTimingFunction: {
        "snap":       "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "hard-stop":  "cubic-bezier(0, 0, 0.2, 1)",
        "freeze":     "cubic-bezier(0.4, 0, 0.6, 1)",
      },
      keyframes: {
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        "stamp-land": {
          "0%":   { transform: "scale(1.3) rotate(-3deg)", opacity: "0" },
          "60%":  { transform: "scale(0.95) rotate(1deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "pulse-seal": {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "0.8" },
        },
        "dash-march": {
          "to": { strokeDashoffset: "-20" },
        },
        "tab-forward": {
          "0%":   { transform: "translateX(0) translateY(0)" },
          "100%": { transform: "translateX(2px) translateY(-1px)" },
        },
        "telegraph-blink": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.2" },
        },
        "fracture-shard": {
          "0%":   { transform: "translate(0,0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translate(var(--shard-x), var(--shard-y)) rotate(var(--shard-r))", opacity: "0" },
        },
      },
      animation: {
        "cursor-blink":  "cursor-blink 1s step-end infinite",
        "stamp-land":    "stamp-land 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "pulse-seal":    "pulse-seal 2.5s ease-in-out infinite",
        "telegraph-blink":"telegraph-blink 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};