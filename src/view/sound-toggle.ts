import type { Msg } from "../app/messages.ts";

/** The menu and each level have their own mute button, both showing the one setting. */
export function findSoundToggles(root: ParentNode): readonly HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>("button[data-mute]")];
}

export function listenToSoundToggles(
  toggles: readonly HTMLButtonElement[],
  dispatch: (msg: Msg) => void,
): void {
  for (const toggle of toggles) {
    toggle.addEventListener("click", (): void => {
      dispatch({ type: "MuteToggled" });
    });
  }
}

export function renderSoundToggles(toggles: readonly HTMLButtonElement[], muted: boolean): void {
  const pressed: string = String(muted);
  for (const toggle of toggles) {
    if (toggle.getAttribute("aria-pressed") !== pressed)
      toggle.setAttribute("aria-pressed", pressed);
  }
}
