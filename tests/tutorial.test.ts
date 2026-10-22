import { describe, expect, it } from "vitest";
import type { Msg } from "../src/app/messages.ts";
import { startLevel, type Game, type Model } from "../src/app/model.ts";
import { noProgress } from "../src/app/progress.ts";
import { endsAt } from "../src/app/tie.ts";
import { currentStep, inWindow, tutorialSteps, type TutorialStep } from "../src/app/tutorial.ts";
import { update } from "../src/app/update.ts";
import { pegAt, type Point, type Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import order from "../src/levels/order.json";
import { onlySolution } from "./fixtures/all-solutions.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import keyJson from "../src/levels/key.json";
import ladderJson from "../src/levels/ladder.json";

const key: Puzzle = decoded(keyJson);
const ladder: Puzzle = decoded(ladderJson);
const puzzles: Readonly<Record<string, Puzzle>> = { key, ladder };

const press = (x: number, y: number): Msg => ({ type: "SquarePressed", x, y });
const enter = (x: number, y: number): Msg => ({ type: "SquareEntered", x, y });
const release: Msg = { type: "PointerReleased" };

function run(model: Game, ...msgs: readonly Msg[]): Game {
  const next: Model = msgs.reduce<Model>(update, model);
  if (next.screen !== "game") throw new Error(`expected a level, on the ${next.screen} screen`);
  return next;
}

function windowOf(id: string): readonly Point[] {
  const step: TutorialStep | undefined = tutorialSteps.find(
    (s: TutorialStep): boolean => s.id === id,
  );
  if (!step) throw new Error(`no step ${id}`);
  return step.window;
}

/** Drags along a thread's squares, as a player would. */
function lay(thread: readonly Point[]): readonly Msg[] {
  const [first, ...rest]: readonly Point[] = thread;
  if (!first) return [];
  return [press(first.x, first.y), ...rest.map((p: Point): Msg => enter(p.x, p.y)), release];
}

describe("tutorial steps", (): void => {
  it("belong to shipped levels, in play order", (): void => {
    const levels: readonly number[] = tutorialSteps.map((step: TutorialStep): number =>
      order.indexOf(step.level),
    );
    expect(levels.every((index: number): boolean => index >= 0)).toBe(true);
    expect([...levels].sort((a: number, b: number): number => a - b)).toEqual(levels);
  });

  it("each either opens a window and ties pegs in it, or opens nothing and ties nothing", (): void => {
    for (const step of tutorialSteps) {
      expect(step.window.length > 0).toBe(step.tie.length > 0);
      const puzzle: Puzzle | undefined = puzzles[step.level];
      if (!puzzle) throw new Error(`no puzzle for ${step.level}`);
      for (const square of step.tie) {
        expect(pegAt(puzzle, square), `${step.id} ties a peg`).toBeDefined();
        expect(inWindow(step, square)).toBe(true);
      }
    }
  });

  it("each ties threads that lie inside its window in the level's solution", (): void => {
    for (const step of tutorialSteps) {
      const puzzle: Puzzle | undefined = puzzles[step.level];
      if (!puzzle) throw new Error(`no puzzle for ${step.level}`);
      const threads: readonly Thread[] = onlySolution(puzzle).filter((thread: Thread): boolean =>
        step.tie.some((peg: Point): boolean => endsAt(thread, peg)),
      );
      for (const thread of threads) {
        expect(
          thread.squares.every((square: Point): boolean => inWindow(step, square)),
          `${step.id} window holds its thread`,
        ).toBe(true);
      }
    }
  });

  it("each window runs from a peg to tie, one neighbouring square at a time", (): void => {
    for (const step of tutorialSteps) {
      const [first]: readonly Point[] = step.window;
      if (!first) continue;
      expect(step.tie, `${step.id} starts at a peg`).toContainEqual(first);
      step.window.slice(1).forEach((square: Point, i: number): void => {
        const before: Point = step.window[i] ?? first;
        expect(
          Math.abs(square.x - before.x) + Math.abs(square.y - before.y),
          `${step.id} square ${String(i + 1)}`,
        ).toBe(1);
      });
    }
  });
});

describe("tutorial in play", (): void => {
  const fresh: Game = startLevel(key, noProgress);

  it("starts the first level on its first step, and other levels on none of theirs", (): void => {
    expect(currentStep(fresh)?.id).toBe("lay-thread");
    expect(currentStep(startLevel(ladder, noProgress))?.id).toBe("red-rail");
  });

  it("ignores presses outside the window", (): void => {
    expect(update(fresh, press(0, 1))).toBe(fresh);
    expect(update(fresh, press(1, 0))).not.toBe(fresh);
  });

  it("keeps a drag inside the window", (): void => {
    const dragging: Game = run(fresh, press(1, 0));
    expect(update(dragging, enter(1, 1))).toBe(dragging);
  });

  it("locks Undo and Clear while a step is shown", (): void => {
    const laid: Game = run(
      fresh,
      ...lay([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    );
    expect(update(laid, { type: "UndoPressed" })).toBe(laid);
    expect(update(laid, { type: "ClearPressed" })).toBe(laid);
  });

  it("moves on as each step's thread is tied, and waits on OK for a tip", (): void => {
    const first: Game = run(fresh, ...lay(windowOf("lay-thread")));
    expect(first.progress.tipsSeen).toEqual(["lay-thread"]);
    expect(currentStep(first)?.id).toBe("length");
    const second: Game = run(first, ...lay(windowOf("length")));
    expect(currentStep(second)?.id).toBe("one-peg");
    const third: Game = run(second, press(7, 3), release);
    expect(currentStep(third)?.id).toBe("finish");
    expect(update(third, press(0, 1))).toBe(third);
    const done: Game = run(third, { type: "TipDismissed" });
    expect(currentStep(done)).toBeUndefined();
    expect(run(done, press(0, 1)).drag).toBeDefined();
  });

  it("doesn't move on for a thread that isn't tied", (): void => {
    const partway: Game = run(
      fresh,
      ...lay([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    );
    expect(currentStep(partway)?.id).toBe("lay-thread");
  });

  it("crosses the red rail with yellow on the second level", (): void => {
    const start: Game = startLevel(ladder, { ...noProgress, cleared: ["key"] });
    const rail: Game = run(start, ...lay(windowOf("red-rail")));
    expect(currentStep(rail)?.id).toBe("crossing");
    const crossed: Game = run(rail, ...lay(windowOf("crossing")));
    expect(currentStep(crossed)?.id).toBe("mixes");
    expect(crossed.threads).toHaveLength(2);
  });

  it("skips every step at once", (): void => {
    const skipped: Game = run(fresh, { type: "TutorialSkipped" });
    expect(currentStep(skipped)).toBeUndefined();
    expect(currentStep({ ...skipped, puzzle: ladder })).toBeUndefined();
    expect(update(skipped, { type: "TutorialSkipped" })).toBe(skipped);
  });
});
