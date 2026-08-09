/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Live/dark register — forensic cryptography system
        bg:       "#0D0817",
        panel:    "#170F26",
        "panel-2":"#1E1530",
        ink:      "#E9E4F2",
        "ink-soft":"#7C7099",
        line:     "#2A2044",
        "line-bright": "#3C2E5C",

        alarm:    { DEFAULT: "#E15068", glow: "rgba(225,80,104,.20)" },
        verified: { DEFAULT: "#54C99A", glow: "rgba(84,201,154,.16)" },
        gold:     { DEFAULT: "#D9A94A", bright: "#F0C874", glow: "rgba(217,169,74,.22)" },
        lock:     { DEFAULT: "#8B7FE0", glow: "rgba(139,127,224,.25)" },
        threat:   { DEFAULT: "#C23856", glow: "rgba(194,56,86,.20)" },

        // Paper/exhibit register — filed records only
        paper:      "#E9E3CE",
        "paper-ink":"#1C1B16",

        // Legacy aliases kept for orphaned/unused components
        "case-red":      "#E15068",
        "verified-green":"#54C99A",
        brass:    "#D9A94A",
        redact:   "#05030A",
        "ink-raised":  "#170F26",
        "ink-panel":   "#1E1530",
        slate: {
          structure: "#3C2E5C",
          line:      "#2A2044",
          500:       "#7C7099",
          400:       "#948AB0",
          300:       "#B3A8CC",
          200:       "#D6CFE6",
        },
        pass:  { DEFAULT: "#54C99A", light: "#6EDBB0", glow: "#9BEAC9" },
        fail:  { DEFAULT: "#E15068", light: "#F0839A", glow: "#F5A8B8" },
        data:  { DEFAULT: "#D9A94A", dim: "#B08D57" },
      },
      fontFamily: {
        stamp:    ["'Special Elite'", "serif"],
        headline: ["'Newsreader'", "serif"],
        display:  ["'Newsreader'", "serif"],
        mono:     ["'IBM Plex Mono'", "monospace"],
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
        "pulse-ring": {
          "0%":   { transform: "scale(0.8)", opacity: "0.9" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "stamp-land-overshoot": {
          "0%":   { transform: "scale(2.2) rotate(-6deg)", opacity: "0" },
          "60%":  { transform: "scale(0.92) rotate(-3deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-4deg)", opacity: "0.9" },
        },
        "light-sweep": {
          "0%":   { left: "-60%", opacity: "0" },
          "15%":  { opacity: "1" },
          "85%":  { opacity: "1" },
          "100%": { left: "120%", opacity: "0" },
        },
        "threshold-trip": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(225,80,104,.20)" },
          "50%":      { boxShadow: "0 0 16px 4px rgba(225,80,104,.20)" },
        },
        "lock-scan": {
          "0%":   { transform: "rotate(0deg)", opacity: "0.3" },
          "50%":  { opacity: "0.9" },
          "100%": { transform: "rotate(360deg)", opacity: "0.3" },
        },
        "rise-in": {
          from: { transform: "translateY(6px)", opacity: "0" },
          to:   { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "cursor-blink":  "cursor-blink 1s step-end infinite",
        "stamp-land":    "stamp-land 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "pulse-seal":    "pulse-seal 2.5s ease-in-out infinite",
        "telegraph-blink":"telegraph-blink 0.8s ease-in-out infinite",
        "pulse-ring":    "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite",
        "stamp-land-overshoot": "stamp-land-overshoot 0.5s cubic-bezier(.2,1.6,.4,1) forwards",
        "light-sweep":   "light-sweep 0.5s ease-out",
        "threshold-trip":"threshold-trip 0.6s ease-in-out",
        "lock-scan":     "lock-scan 3s linear infinite",
        "rise-in":       "rise-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [],
};