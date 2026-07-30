/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0F14",
          raised: "#10151C",
          panel: "#141B23",
        },
        slate: {
          structure: "#2A3540",
          line: "#1E2731",
        },
        pass: {
          DEFAULT: "#3DFFB0",
          dim: "#1F8F63",
        },
        fail: {
          DEFAULT: "#FF4757",
          dim: "#8F2530",
        },
        data: {
          DEFAULT: "#7FDBFF",
          dim: "#4A7A8C",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};