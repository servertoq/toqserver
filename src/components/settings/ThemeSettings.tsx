"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemeMode } from "@/lib/theme";

const OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  {
    value: "light",
    label: "Claro",
    description: "Fundo claro em todo o site",
  },
  {
    value: "dark",
    label: "Escuro",
    description: "Fundo escuro, ideal à noite",
  },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`settings-theme-option text-left ${
              active ? "settings-theme-option--active" : ""
            }`}
            aria-pressed={active}
          >
            <span className="block text-sm font-semibold text-[var(--toq-navy)]">
              {option.label}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--toq-text-muted)]">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
