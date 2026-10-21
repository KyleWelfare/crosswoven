import type { Puzzle } from "../core/puzzle.ts";

/** Squares are board coordinates. Only the first pointer down on the board sends these. */
export type Msg =
  | { readonly type: "SquarePressed"; readonly x: number; readonly y: number }
  | { readonly type: "SquareEntered"; readonly x: number; readonly y: number }
  | { readonly type: "PointerReleased" }
  | { readonly type: "PointerCancelled" }
  | { readonly type: "UndoPressed" }
  | { readonly type: "ClearPressed" }
  | { readonly type: "LevelStarted"; readonly puzzle: Puzzle }
  /** Milliseconds since the last animation frame. */
  | { readonly type: "Tick"; readonly dt: number };
