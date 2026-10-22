import { describe, expect, it } from "vitest";
import type { Msg } from "../src/app/messages.ts";
import { levelList, menu, startLevel, type Game, type Model } from "../src/app/model.ts";
import { noProgress } from "../src/app/progress.ts";
import { soundCues } from "../src/app/sound-cues.ts";
import { update } from "../src/app/update.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { onlySolution } from "./fixtures/all-solutions.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { turningCrossingLevel } from "./fixtures/reference-puzzles.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

const lattice: Puzzle = decoded(examplePuzzle);
const fresh: Game = startLevel(lattice, noProgress);
const solution: readonly Thread[] = onlySolution(lattice);
const first: Thread = thread(0);
const last: Thread = thread(solution.length - 1);
const release: Msg = { type: "PointerReleased" };

function thread(index: number): Thread {
  const found: Thread | undefined = solution[index];
  if (!found) throw new Error(`no thread ${String(index)}`);
  return found;
}

function dragging(squares: number): Game {
  return { ...fresh, drag: { colour: first.colour, squares: first.squares.slice(0, squares) } };
}

describe("soundCues", (): void => {
  it("plucks each square a drag grows by, higher as it grows", (): void => {
    expect(soundCues(fresh, dragging(1))).toEqual([
      { kind: "step", colour: first.colour, length: 1 },
    ]);
    expect(soundCues(dragging(1), dragging(2))).toEqual([
      { kind: "step", colour: first.colour, length: 2 },
    ]);
  });

  it("stays quiet as a drag shrinks back", (): void => {
    expect(soundCues(dragging(3), dragging(2))).toEqual([]);
  });

  it("sounds the tie as the drag reaches the other peg, and not again on release", (): void => {
    const reached: Game = dragging(first.squares.length);
    expect(soundCues(dragging(first.squares.length - 1), reached)).toEqual([
      { kind: "tie", colour: first.colour, length: first.squares.length },
    ]);
    const released: Model = update(reached, release);
    expect(soundCues(reached, released)).toEqual([]);
  });

  it("hears undo and clear only when they change the board", (): void => {
    const laid: Model = update(dragging(first.squares.length), release);
    expect(soundCues(laid, update(laid, { type: "UndoPressed" }))).toEqual([{ kind: "undo" }]);
    expect(soundCues(laid, update(laid, { type: "ClearPressed" }))).toEqual([{ kind: "clear" }]);
    expect(soundCues(fresh, update(fresh, { type: "UndoPressed" }))).toEqual([]);
  });

  it("plays the solve, alone, when the last thread is laid", (): void => {
    const almost: Game = { ...fresh, threads: solution.slice(0, -1), drag: last };
    expect(soundCues(almost, update(almost, release))).toEqual([{ kind: "solve" }]);
  });

  it("previews the effects volume as its slider moves, on any screen, but not the music's", (): void => {
    const effects: Msg = { type: "VolumeChanged", channel: "effects", volume: 0.5 };
    const music: Msg = { type: "VolumeChanged", channel: "music", volume: 0.5 };
    for (const model of [menu, levelList, fresh]) {
      expect(soundCues(model, update(model, effects))).toEqual([{ kind: "preview" }]);
      expect(soundCues(model, update(model, music))).toEqual([]);
    }
  });

  it("stays quiet off the board and when a new level starts", (): void => {
    expect(soundCues(menu, levelList)).toEqual([]);
    expect(soundCues(levelList, fresh)).toEqual([]);
    const next: Game = startLevel(decoded(turningCrossingLevel), noProgress);
    expect(soundCues(dragging(2), next)).toEqual([]);
  });
});
