import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas:   "var(--bg-canvas)",
        surface:  "var(--bg-surface)",
        well:     "var(--bg-well)",
        item: {
          hover:  "var(--bg-item-hover)",
          active: "var(--bg-item-active)",
        },
        line: {
          DEFAULT:  "var(--border-default)",
          hover:    "var(--border-hover)",
          divider:  "var(--border-divider)",
          soft:     "var(--border-soft)",
          selected: "var(--border-selected)",
        },
        ink: {
          DEFAULT:  "var(--text-primary)",
          secondary:"var(--text-secondary)",
          sub:      "var(--text-sub)",
          soft:     "var(--text-soft)",
          disabled: "var(--text-disabled)",
        },
        state: {
          success: "var(--success)", "success-bg": "var(--success-bg)",
          error:   "var(--error)",   "error-bg":   "var(--error-bg)",
          warning: "var(--warning)", "warning-bg": "var(--warning-bg)",
          info:    "var(--info)",    "info-bg":    "var(--info-bg)",
        },
        chart: {
          primary: "var(--chart-primary)",
          grid:    "var(--chart-grid)",
          axis:    "var(--chart-axis)",
          1: "var(--chart-1)",  2: "var(--chart-2)",  3: "var(--chart-3)",
          4: "var(--chart-4)",  5: "var(--chart-5)",  6: "var(--chart-6)",
          7: "var(--chart-7)",  8: "var(--chart-8)",  9: "var(--chart-9)",
          10:"var(--chart-10)", 11:"var(--chart-11)", 12:"var(--chart-12)",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)", sm: "var(--radius-sm)", md: "var(--radius-md)",
        lg: "var(--radius-lg)", xl: "var(--radius-xl)",
      },
      boxShadow: {
        s1: "var(--shadow-s1)", s2: "var(--shadow-s2)",
        s3: "var(--shadow-s3)", s5: "var(--shadow-s5)",
      },
      borderWidth: { hairline: "0.5px" },
      spacing: { 4.5: "18px", 13: "52px", 15: "60px", sidebar: "260px", "sidebar-collapsed": "72px" },
      fontFamily: { sans: ["Inter", "Inter Fallback", "system-ui", "sans-serif"] },
      transitionTimingFunction: { standard: "cubic-bezier(.4,0,.2,1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
