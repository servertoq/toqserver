export type ThemeMode = "light" | "dark";

export type ResolvedTheme = ThemeMode;

export const THEME_STORAGE_KEY = "toq-theme";

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode;
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    if (stored === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  } catch {
    /* ignore */
  }
  return "dark";
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.style.colorScheme = mode;
  return mode;
}
