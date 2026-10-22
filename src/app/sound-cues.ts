import type { ThreadColour } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import type { Model } from "./model.ts";
import { isTied } from "./tie.ts";

/** Something worth hearing that changed from one model to the next. */
export type SoundCue =
  /** `length` is how many squares the dragged thread now covers. */
  | { readonly kind: "step"; readonly colour: ThreadColour; readonly length: number }
  | { readonly kind: "tie"; readonly colour: ThreadColour; readonly length: number }
  | { readonly kind: "undo" }
  | { readonly kind: "clear" }
  | { readonly kind: "solve" };

/**
 * Read off the models rather than the messages, so a sound only plays when the board really
 * changed: an Undo with nothing to undo stays silent. A thread is heard tied the moment the drag
 * reaches its peg, not on release, so letting go makes no second sound.
 */
export function soundCues(before: Model, after: Model): readonly SoundCue[] {
  if (before.screen !== "game" || after.screen !== "game" || before.puzzle !== after.puzzle) {
    return [];
  }
  if (before.solvedFor === undefined && after.solvedFor !== undefined) return [{ kind: "solve" }];
  if (after.history.length < before.history.length) return [{ kind: "undo" }];
  if (after.history.length > before.history.length && after.threads.length === 0) {
    return [{ kind: "clear" }];
  }
  const drag: Thread | undefined = after.drag;
  if (!drag || drag.squares.length <= (before.drag?.squares.length ?? 0)) return [];
  const length: number = drag.squares.length;
  return isTied(after.puzzle, drag)
    ? [{ kind: "tie", colour: drag.colour, length }]
    : [{ kind: "step", colour: drag.colour, length }];
}
