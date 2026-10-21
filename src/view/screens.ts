import type { Msg } from "../app/messages.ts";
import type { Model } from "../app/model.ts";
import { requiredElement } from "./required-element.ts";

export type Screens = Readonly<Record<Model["screen"], HTMLElement>>;

export function findScreens(root: ParentNode): Screens {
  return {
    menu: requiredElement(root, "#menu", HTMLElement),
    levels: requiredElement(root, "#levels", HTMLElement),
    game: requiredElement(root, "#game", HTMLElement),
  };
}

export function listenForBack(root: ParentNode, dispatch: (msg: Msg) => void): void {
  for (const button of root.querySelectorAll("[data-back]")) {
    button.addEventListener("click", (): void => {
      dispatch({ type: "BackPressed" });
    });
  }
}

/**
 * Shows only the model's screen. Focus moves to a screen as it appears, so keyboard and screen
 * reader users aren't left on a button that just vanished.
 */
export function renderScreens(screens: Screens, model: Model): void {
  for (const [screen, section] of Object.entries(screens)) {
    const shown: boolean = screen === model.screen;
    const appearing: boolean = shown && section.hidden === true;
    section.hidden = !shown;
    if (appearing) section.querySelector<HTMLElement>("[data-focus]")?.focus();
  }
}
