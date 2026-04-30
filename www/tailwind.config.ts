import type { Config } from "tailwindcss";
import daisyui from "daisyui";

export default {
  content: [
    "client/{pages,islands,components,layouts}/**/*.{ts,tsx}",
    "./**/*.{js,jsx,ts,tsx}",
  ],
  plugins: [daisyui],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      keyframes: {
        bounceOnce: {
          "0%, 100%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.1)" },
          "60%": { transform: "scale(0.95)" },
        },
      },
      animation: {
        "bounce-once": "bounceOnce 0.4s cubic-bezier(.68,-0.55,.27,1.55)",
      },
    },
  },
} satisfies Config;
