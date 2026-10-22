import type { Game } from "../app/model.ts";
import { boardSummary } from "../app/narration.ts";
import { requiredElement } from "./required-element.ts";

/** The board canvas has no text of its own, so these stand in for it with screen readers. */
export interface BoardNarration {
  /** Part of the board's description, read whenever it gets focus. */
  readonly summary: HTMLElement;
  /** A live region, announced as the board changes. */
  readonly live: HTMLElement;
}

export function findBoardNarration(root: ParentNode): BoardNarration {
  return {
    summary: requiredElement(root, "#board-summary", HTMLElement),
    live: requiredElement(root, "#board-live", HTMLElement),
  };
}

export function renderBoardSummary(narration: BoardNarration, game: Game): void {
  const summary: string = boardSummary(game);
  if (narration.summary.textContent !== summary) narration.summary.textContent = summary;
}

export function announce(narration: BoardNarration, text: string | undefined): void {
  if (text === undefined) return;
  // A live region ignores text that hasn't changed, so a repeat ("Edge of the board.") would go
  // unheard. A trailing no-break space on every other announcement makes each one new.
  narration.live.textContent =
    narration.live.textContent === text ? text + String.fromCharCode(0xa0) : text;
}
