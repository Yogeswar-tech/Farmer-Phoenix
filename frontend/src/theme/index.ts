// Global design system for Kisan Sethu (light theme only)

export const colors = {
  background: "#FBF9F1",
  surface: "#FFFFFF",
  surfaceTint: "#EAF5E4",
  primary: "#A8D5A2",
  primaryStrong: "#2F7D4F",
  onPrimary: "#1F3D2B",
  text: "#1F2A24",
  textMuted: "#5B6B61",
  border: "#E3E8DA",
  success: "#2E7D32",
  danger: "#C62828",
  warning: "#B26A00",
} as const;

// Single fontFamily entry defaulting to system font for reliable Indian script rendering.
// Changing font later only requires changing this entry (and loading the font in the root layout).
export const fontFamily = "System";

export const typography = {
  title: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
  },
  heading: {
    fontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontFamily,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "400" as const,
  },
  label: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  caption: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  price: {
    fontFamily,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
  },
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const minTouchTarget = 48;

export const theme = {
  colors,
  fontFamily,
  typography,
  spacing,
  radius,
  minTouchTarget,
} as const;

export type Theme = typeof theme;
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Radius = typeof radius;

export default theme;
