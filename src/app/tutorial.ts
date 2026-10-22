import { pegAt, type Peg, type Point } from "../core/puzzle.ts";
import type { Game } from "./model.ts";
import { withTipSeen, type Progress } from "./progress.ts";
import { isPegTied } from "./tie.ts";

/** One tip, shown over its level until done, then saved as seen by `id`. */
export interface TutorialStep {
  readonly id: string;
  readonly level: string;
  readonly text: string;
  /**
   * The only squares the player can touch, in the order the thread runs through them, as the
   * tutorial's hand traces them. Empty for a tip that's read and dismissed.
   */
  readonly window: readonly Point[];
  /** Pegs to tie to finish the step. Empty for a tip that's read and dismissed. */
  readonly tie: readonly Point[];
}

const row = (y: number, from: number, to: number): Point[] =>
  Array.from({ length: to - from + 1 }, (_: unknown, i: number): Point => ({ x: from + i, y }));

const column = (x: number, from: number, to: number): Point[] =>
  Array.from({ length: to - from + 1 }, (_: unknown, i: number): Point => ({ x, y: from + i }));

/** In play order. tests/tutorial.test.ts checks each against its level's solution. */
export const tutorialSteps: readonly TutorialStep[] = [
  {
    id: "lay-thread",
    level: "key",
    text: "Drag from one yellow 3 to the other to lay a thread.",
    window: row(0, 1, 3),
    tie: [
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ],
  },
  {
    id: "length",
    level: "key",
    text: "Join the two 5s. A thread can turn, and the number is its length in squares, pegs included.",
    window: [...row(2, 5, 8), { x: 8, y: 3 }],
    tie: [
      { x: 5, y: 2 },
      { x: 8, y: 3 },
    ],
  },
  {
    id: "one-peg",
    level: "key",
    text: "A peg marked 1 is a whole thread on its own. Tap it.",
    window: [{ x: 7, y: 3 }],
    tie: [{ x: 7, y: 3 }],
  },
  {
    id: "finish",
    level: "key",
    text: "Now finish the key. Blank squares take no thread.",
    window: [],
    tie: [],
  },
  {
    id: "red-rail",
    level: "ladder",
    text: "Lay the red thread down the rail.",
    window: column(1, 0, 3),
    tie: [
      { x: 1, y: 0 },
      { x: 1, y: 3 },
    ],
  },
  {
    id: "crossing",
    level: "ladder",
    text: "Orange is red and yellow. Cross the red thread with a yellow one, straight over.",
    window: row(2, 0, 3),
    tie: [
      { x: 0, y: 2 },
      { x: 3, y: 2 },
    ],
  },
  {
    id: "mixes",
    level: "ladder",
    text: "Where threads cross, their colours mix: red and blue make purple, blue and yellow make green.",
    window: [],
    tie: [],
  },
];

export function currentStep(game: Game): TutorialStep | undefined {
  return tutorialSteps.find(
    (step: TutorialStep): boolean =>
      step.level === game.puzzle.id && !game.progress.tipsSeen.includes(step.id),
  );
}

export function inWindow(step: TutorialStep, square: Point): boolean {
  return step.window.some((open: Point): boolean => open.x === square.x && open.y === square.y);
}

/** Marks each step seen once its pegs are tied, so the next one takes over. */
export function advanceTutorial(game: Game): Game {
  const step: TutorialStep | undefined = currentStep(game);
  if (!step || step.tie.length === 0 || !isStepTied(game, step)) return game;
  return advanceTutorial({ ...game, progress: withTipSeen(game.progress, step.id) });
}

export function skipTutorial(progress: Progress): Progress {
  return tutorialSteps.reduce<Progress>(
    (seen: Progress, step: TutorialStep): Progress => withTipSeen(seen, step.id),
    progress,
  );
}

function isStepTied(game: Game, step: TutorialStep): boolean {
  return step.tie.every((square: Point): boolean => {
    const peg: Peg | undefined = pegAt(game.puzzle, square);
    return peg !== undefined && isPegTied(game.puzzle, game.threads, peg);
  });
}
