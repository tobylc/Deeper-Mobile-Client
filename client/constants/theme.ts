import { Platform } from "react-native";

const primaryLight = "#2563EB";
const primaryDark = "#3B82F6";

export const Colors = {
  light: {
    text: "#111827",
    textSecondary: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#687076",
    tabIconSelected: primaryLight,
    link: primaryLight,
    primary: primaryLight,
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F9FAFB",
    backgroundSecondary: "#F3F4F6",
    backgroundTertiary: "#E5E7EB",
    border: "#E5E7EB",
    error: "#DC2626",
    success: "#10B981",
    inputBackground: "#F9FAFB",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: primaryDark,
    link: primaryDark,
    primary: primaryDark,
    backgroundRoot: "#111827",
    backgroundDefault: "#1F2937",
    backgroundSecondary: "#374151",
    backgroundTertiary: "#4B5563",
    border: "#374151",
    error: "#EF4444",
    success: "#34D399",
    inputBackground: "#1F2937",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 56,
  inputHeight: 48,
  buttonHeight: 48,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "500" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
