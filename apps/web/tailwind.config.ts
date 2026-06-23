import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        severity: {
          alta: "#dc2626",
          media: "#d97706",
          baja: "#2563eb",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
