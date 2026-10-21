import { describe, expect, it } from "vitest";
import type { Msg } from "../src/app/messages.ts";
import { startLevel, type Model } from "../src/app/model.ts";
import { update } from "../src/app/update.ts";
import { WIN_FADE } from "../src/app/win.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { onlySolution } from "./fixtures/all-solutions.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { turningCrossingLevel } from "./fixtures/reference-puzzles.ts";
import { threadOf } from "./fixtures/thread-of.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

const lattice: Puzzle = decoded(examplePuzzle);
const fresh: Model = startLevel(lattice);

function run(model: Model, ...msgs: readonly Msg[]): Model {
  return msgs.reduce(update, model);
}

const press = (x: number, y: number): Msg => ({ type: "SquarePressed", x, y });
const enter = (x: number, y: number): Msg => ({ type: "SquareEntered", x, y });
const release: Msg = { type: "PointerReleased" };
const cancel: Msg = { type: "PointerCancelled" };
const undo: Msg = { type: "UndoPressed" };
const clear: Msg = { type: "ClearPressed" };
const tick = (dt: number): Msg => ({ type: "Tick", dt });

describe("update", (): void => {
  it("starts a level with no threads, no drag and nothing to undo", (): void => {
    expect(fresh).toEqual({
      puzzle: lattice,
      threads: [],
      drag: undefined,
      history: [],
      solvedFor: undefined,
    });
  });

  it("lays a thread from peg to peg in one drag", (): void => {
    const model: Model = run(fresh, press(2, 0), enter(1, 0), enter(1, 4), release);
    expect(model.threads).toEqual([
      threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]),
    ]);
    expect(model.drag).toBeUndefined();
  });

  it("drags from a press on a peg", (): void => {
    expect(run(fresh, press(2, 0), enter(2, 1)).drag).toEqual(threadOf("red", [2, 0], [2, 1]));
  });

  it("returns the same model for a press that starts nothing", (): void => {
    expect(update(fresh, press(0, 0))).toBe(fresh);
  });

  it("ignores a second press while dragging, as from a second finger", (): void => {
    const dragging: Model = run(fresh, press(2, 0), enter(2, 1));
    expect(update(dragging, press(3, 0))).toBe(dragging);
  });

  it("returns the same model when the pointer stays on the end of the thread", (): void => {
    const dragging: Model = run(fresh, press(2, 0), enter(2, 1));
    expect(update(dragging, enter(2, 1))).toBe(dragging);
  });

  it("ignores moves and releases with no drag", (): void => {
    expect(update(fresh, enter(2, 1))).toBe(fresh);
    expect(update(fresh, release)).toBe(fresh);
    expect(update(fresh, cancel)).toBe(fresh);
  });

  it("keeps the laid threads when a drag is cancelled", (): void => {
    const laid: Model = run(fresh, press(2, 0), enter(2, 1), release);
    const cancelled: Model = run(laid, press(2, 0), enter(1, 0), cancel);
    expect(cancelled).toEqual(laid);
  });

  it("reroutes a thread from the square it's picked up at", (): void => {
    const laid: Model = run(fresh, press(2, 0), enter(1, 0), enter(1, 4), release);
    const rerouted: Model = run(laid, press(1, 1), enter(2, 1), release);
    expect(rerouted.threads).toEqual([threadOf("red", [2, 0], [1, 0], [1, 1], [2, 1])]);
  });

  it("joins threads drawn from both pegs where they meet", (): void => {
    const half: Model = run(fresh, press(1, 4), enter(1, 2), release);
    const joined: Model = run(half, press(2, 0), enter(1, 0), enter(1, 2), release);
    expect(joined.threads).toEqual([
      threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]),
    ]);
  });

  it("undoes a join when the drag moves back off it", (): void => {
    const half: Model = run(fresh, press(1, 4), enter(1, 2), release);
    const backedOff: Model = run(half, press(2, 0), enter(1, 0), enter(1, 2), enter(1, 1), release);
    expect(backedOff.threads).toEqual([
      threadOf("red", [1, 4], [1, 3], [1, 2]),
      threadOf("red", [2, 0], [1, 0], [1, 1]),
    ]);
  });
});

describe("update: Undo and Clear", (): void => {
  const laid: Model = run(fresh, press(2, 0), enter(1, 0), enter(1, 4), release);

  it("undoes the last change to the board", (): void => {
    const two: Model = run(laid, press(3, 0), enter(3, 1), release);
    expect(run(two, undo).threads).toEqual(laid.threads);
    expect(run(two, undo, undo).threads).toEqual([]);
  });

  it("has nothing to undo for a drag that changed nothing", (): void => {
    const tapped: Model = run(laid, press(0, 0), press(3, 0), cancel);
    expect(tapped.history).toEqual(laid.history);
  });

  it("clears every thread, and Clear itself can be undone", (): void => {
    const cleared: Model = run(laid, clear);
    expect(cleared.threads).toEqual([]);
    expect(run(cleared, undo).threads).toEqual(laid.threads);
  });

  it("returns the same model when there's nothing to undo or clear", (): void => {
    expect(update(fresh, undo)).toBe(fresh);
    expect(update(fresh, clear)).toBe(fresh);
  });
});

describe("update: winning", (): void => {
  const solution: readonly Thread[] = onlySolution(lattice);
  const last: Thread | undefined = solution.at(-1);
  if (!last) throw new Error("empty solution");
  // Every thread but one laid, and the last one under the pointer.
  const almost: Model = { ...fresh, threads: solution.slice(0, -1), drag: last };
  const won: Model = run(almost, release);

  it("starts the win once the last thread is laid", (): void => {
    expect(won.solvedFor).toBe(0);
  });

  it("doesn't start the win on a board that isn't solved", (): void => {
    expect(run(fresh, press(2, 0), enter(1, 0), release).solvedFor).toBeUndefined();
  });

  it("counts time once solved, up to the end of the fade", (): void => {
    expect(run(won, tick(100), tick(200)).solvedFor).toBe(300);
    expect(run(won, tick(5000)).solvedFor).toBe(WIN_FADE);
    expect(update(fresh, tick(100))).toBe(fresh);
  });

  it("locks the board once solved", (): void => {
    expect(update(won, press(2, 0))).toBe(won);
    expect(update(won, undo)).toBe(won);
    expect(update(won, clear)).toBe(won);
  });

  it("starts the next level fresh", (): void => {
    const other: Puzzle = decoded(turningCrossingLevel);
    expect(update(won, { type: "LevelStarted", puzzle: other })).toEqual(startLevel(other));
  });
});
