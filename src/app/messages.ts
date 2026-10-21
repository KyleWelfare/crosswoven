import type { Puzzle } from "../core/puzzle.ts";

export type Msg = ScreenMsg | GameMsg;

/** Moves between screens. */
export type ScreenMsg =
  | { readonly type: "PlayPressed" }
  | { readonly type: "HowToPlayPressed" }
  /** `steps` is how many steps How the Puzzles Are Made has. */
  | { readonly type: "HowPuzzlesAreMadePressed"; readonly steps: number }
  | { readonly type: "NextStepPressed" }
  | { readonly type: "PreviousStepPressed" }
  | { readonly type: "RulesClosed" }
  /** Leaves the level for the list, and the list or How the Puzzles Are Made for the menu. */
  | { readonly type: "BackPressed" }
  | { readonly type: "LevelStarted"; readonly puzzle: Puzzle };

/** Only a level being played responds to these. */
export type GameMsg =
  /** Squares are board coordinates. Only the first pointer down on the board sends these. */
  | { readonly type: "SquarePressed"; readonly x: number; readonly y: number }
  | { readonly type: "SquareEntered"; readonly x: number; readonly y: number }
  | { readonly type: "PointerReleased" }
  | { readonly type: "PointerCancelled" }
  | { readonly type: "UndoPressed" }
  | { readonly type: "ClearPressed" }
  /** Milliseconds since the last animation frame. */
  | { readonly type: "Tick"; readonly dt: number };
