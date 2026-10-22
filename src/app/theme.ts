/** The player's choice. System follows the device's light or dark setting. */
export type Theme = "system" | "light" | "dark";

export const themes: readonly Theme[] = ["system", "light", "dark"];

export function isTheme(value: unknown): value is Theme {
  return themes.some((theme: Theme): boolean => theme === value);
}
