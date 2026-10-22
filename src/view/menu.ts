import type { Msg } from "../app/messages.ts";
import type { Model } from "../app/model.ts";
import type { StepScene, TourFrame } from "../app/tour.ts";
import { requiredElement } from "./required-element.ts";
import type { SpriteCache } from "./sprite-cache.ts";
import { drawScene } from "./tour-scenes.ts";

export interface MenuControls {
  readonly board: HTMLCanvasElement;
  readonly play: HTMLButtonElement;
  readonly howToPlay: HTMLButtonElement;
  readonly howPuzzlesAreMade: HTMLButtonElement;
  readonly rules: HTMLDialogElement;
}

export function findMenu(root: ParentNode): MenuControls {
  return {
    board: requiredElement(root, "#menu-board", HTMLCanvasElement),
    play: requiredElement(root, "#play", HTMLButtonElement),
    howToPlay: requiredElement(root, "#how-to-play", HTMLButtonElement),
    howPuzzlesAreMade: requiredElement(root, "#how-puzzles-are-made", HTMLButtonElement),
    rules: requiredElement(root, "#rules", HTMLDialogElement),
  };
}

/**
 * The tour's certified sailboat, laid thread by thread. It's not a shipped level, so weaving it on
 * the menu gives no solution away.
 */
export function menuScene(frames: readonly TourFrame[]): StepScene | undefined {
  for (const frame of frames) {
    if (frame.scene.kind === "reveal") {
      return { kind: "lay", puzzle: frame.scene.puzzle, threads: frame.scene.threads };
    }
  }
  return undefined;
}

/** `tourSteps` is how many steps How the Puzzles Are Made has. */
export function listenToMenu(
  menu: MenuControls,
  dispatch: (msg: Msg) => void,
  tourSteps: number,
): void {
  menu.play.addEventListener("click", (): void => {
    dispatch({ type: "PlayPressed" });
  });
  menu.howToPlay.addEventListener("click", (): void => {
    dispatch({ type: "HowToPlayPressed" });
  });
  menu.howPuzzlesAreMade.addEventListener("click", (): void => {
    dispatch({ type: "HowPuzzlesAreMadePressed", steps: tourSteps });
  });
  // Fires for the dialog's own button and for Escape alike.
  menu.rules.addEventListener("close", (): void => {
    dispatch({ type: "RulesClosed" });
  });
}

/** A modal dialog traps focus and hands it back to How to Play when it closes. */
export function renderMenu(
  menu: MenuControls,
  model: Model,
  scene: StepScene | undefined,
  sprites: SpriteCache,
): void {
  const open: boolean = model.screen === "menu" && model.rulesOpen;
  if (open && !menu.rules.open) menu.rules.showModal();
  if (!open && menu.rules.open) menu.rules.close();
  if (model.screen === "menu" && scene) {
    const still: boolean = matchMedia("(prefers-reduced-motion: reduce)").matches;
    drawScene(menu.board, scene, model.elapsed, still, sprites);
  }
}
