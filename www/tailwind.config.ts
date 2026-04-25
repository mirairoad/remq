import type { Config } from "tailwindcss";

export default {
  content: [
    "./client/pages/**/*.{ts,tsx}",
    "./client/components/**/*.{ts,tsx}",
  ],
} satisfies Config;
