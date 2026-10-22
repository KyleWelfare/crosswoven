import type { Msg } from "../app/messages.ts";
import { isTheme, type Theme } from "../app/theme.ts";
import { requiredElement } from "./required-element.ts";

export function findThemePicker(root: ParentNode): HTMLSelectElement {
  return requiredElement(root, "#theme", HTMLSelectElement);
}

export function listenToThemePicker(picker: HTMLSelectElement, dispatch: (msg: Msg) => void): void {
  picker.addEventListener("change", (): void => {
    if (isTheme(picker.value)) dispatch({ type: "ThemeChosen", theme: picker.value });
  });
}

/**
 * System resolves to the device's setting here, so `data-theme` is always light or dark and
 * tokens.css keeps one dark block. The script in index.html's head does the same before first
 * paint. Runs every frame while something animates, so it writes only what changed.
 */
export function renderTheme(picker: HTMLSelectElement, theme: Theme): void {
  if (picker.value !== theme) picker.value = theme;
  const dark: boolean =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const root: HTMLElement = document.documentElement;
  const resolved: string = dark ? "dark" : "light";
  if (root.dataset.theme !== resolved) root.dataset.theme = resolved;
  // The browser bar's colour metas each match one system scheme, so a chosen theme overrides both.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (meta.dataset.theme === resolved) continue;
    meta.content = getComputedStyle(root).getPropertyValue("--page").trim();
    meta.dataset.theme = resolved;
  }
}
