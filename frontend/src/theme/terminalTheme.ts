import { Platform } from "react-native";

export const terminalColors = {
  background: "#09090b", // zinc-950
  card: "#121215",       // high-density dark panel
  cardSecondary: "#18181b",
  border: "#27272a",     // zinc-800
  borderSubtle: "#1f1f23",
  bullish: "#10b981",    // emerald-500
  bullishBg: "rgba(16, 185, 129, 0.12)",
  bullishBorder: "rgba(16, 185, 129, 0.3)",
  bearish: "#ef4444",    // red-500
  bearishBg: "rgba(239, 68, 68, 0.12)",
  bearishBorder: "rgba(239, 68, 68, 0.3)",
  amber: "#f59e0b",      // amber-500
  amberBg: "rgba(245, 158, 11, 0.12)",
  cyan: "#06b6d4",       // cyan-500
  cyanBg: "rgba(6, 182, 212, 0.12)",
  text: "#f4f4f5",       // zinc-100
  textSecondary: "#a1a1aa", // zinc-400
  textMuted: "#71717a",  // zinc-500
};

export const terminalFonts = {
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "JetBrains Mono, Menlo, Consolas, monospace",
  }),
  sans: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
  }),
};
