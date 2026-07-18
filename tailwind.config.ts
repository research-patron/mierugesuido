import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1f4d",
        muted: "#64748b",
        line: "#cbddec",
        panel: "#f7fbfd",
        teal: "#0b9aa3",
        blue: "#2563eb",
        amber: "#d58917",
        danger: "#e5484d"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(21, 34, 56, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
