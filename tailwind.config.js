import { heroui } from "@heroui/react";
import tailwindAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Block gradient colors
    'from-orange-50', 'to-red-50', 'border-orange-200', 'dark:from-slate-800', 'dark:to-orange-950', 'dark:border-orange-900',
    'from-blue-50', 'to-cyan-50', 'border-blue-200', 'dark:to-blue-950', 'dark:border-blue-900',
    'from-yellow-50', 'to-amber-50', 'border-yellow-200', 'dark:to-yellow-950', 'dark:border-yellow-900',
    'from-green-50', 'to-emerald-50', 'border-green-200', 'dark:to-green-950', 'dark:border-green-900',
    'from-purple-50', 'to-indigo-50', 'border-purple-200', 'dark:to-purple-950', 'dark:border-purple-900',
    'from-pink-50', 'to-rose-50', 'border-pink-200', 'dark:to-pink-950', 'dark:border-pink-900',
    'from-teal-50', 'to-cyan-50', 'border-teal-200', 'dark:to-teal-950', 'dark:border-teal-900',
    'from-indigo-50', 'to-violet-50', 'border-indigo-200', 'dark:to-indigo-950', 'dark:border-indigo-900',
    'from-emerald-50', 'to-teal-50', 'border-emerald-200', 'dark:to-emerald-950', 'dark:border-emerald-900',
    'from-slate-50', 'to-gray-50', 'border-slate-200', 'dark:to-slate-900', 'dark:border-slate-700',
    'from-amber-50', 'to-orange-50', 'border-amber-200', 'dark:to-amber-950', 'dark:border-amber-900',
    // With opacity
    'from-orange-50/50', 'to-red-50/50', 'border-orange-200/50', 'dark:from-slate-800/50', 'dark:to-orange-950/50', 'dark:border-orange-900/50',
    'from-blue-50/50', 'to-cyan-50/50', 'border-blue-200/50', 'dark:to-blue-950/50', 'dark:border-blue-900/50',
    'from-yellow-50/50', 'to-amber-50/50', 'border-yellow-200/50', 'dark:to-yellow-950/50', 'dark:border-yellow-900/50',
    'from-green-50/50', 'to-emerald-50/50', 'border-green-200/50', 'dark:to-green-950/50', 'dark:border-green-900/50',
    'from-purple-50/50', 'to-indigo-50/50', 'border-purple-200/50', 'dark:to-purple-950/50', 'dark:border-purple-900/50',
    'from-pink-50/50', 'to-rose-50/50', 'border-pink-200/50', 'dark:to-pink-950/50', 'dark:border-pink-900/50',
    'from-teal-50/50', 'to-cyan-50/50', 'border-teal-200/50', 'dark:to-teal-950/50', 'dark:border-teal-900/50',
    'from-indigo-50/50', 'to-violet-50/50', 'border-indigo-200/50', 'dark:to-indigo-950/50', 'dark:border-indigo-900/50',
    'from-emerald-50/50', 'to-teal-50/50', 'border-emerald-200/50', 'dark:to-emerald-950/50', 'dark:border-emerald-900/50',
    'from-slate-50/50', 'to-gray-50/50', 'border-slate-200/50', 'dark:to-slate-900/50', 'dark:border-slate-700/50',
    'from-amber-50/50', 'to-orange-50/50', 'border-amber-200/50', 'dark:to-amber-950/50', 'dark:border-amber-900/50',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      backgroundImage: {
        striped:
          "linear-gradient(135deg,#eeeeee 10%,#0000 0,#0000 50%,#eeeeee 0,#eeeeee 60%,#0000 0,#0000)",
        "dark-striped":
          "linear-gradient(135deg,#222222 10%,#0000 0,#0000 50%,#222222 0,#222222 60%,#0000 0,#0000)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindAnimate, heroui()],
};
