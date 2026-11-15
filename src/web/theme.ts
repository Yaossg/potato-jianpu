import { readStoredValue } from "./storage.js";
export type ThemeName = "light" | "dark";

const LIGHT_THEME = {
  scoreColor: "#111827",
  pageBackground: "#ffffff",
};

const DARK_THEME = {
  scoreColor: "#f8fafc",
  pageBackground: "#111827",
};

export const THEME_STORAGE_KEY = "potato-jianpu-theme";

export function themeColors(theme: ThemeName) {
  return theme === "light" ? LIGHT_THEME : DARK_THEME;
}

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark";
}

function storedTheme(): ThemeName | null {
  try {
    const value = readStoredValue(THEME_STORAGE_KEY);
    return isThemeName(value) ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemeName {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function initialTheme(): ThemeName {
  if (typeof window === "undefined") {
    return "light";
  }
  return storedTheme() ?? systemTheme();
}
