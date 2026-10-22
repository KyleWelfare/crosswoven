import { describe, expect, it } from "vitest";
import type { Msg } from "../src/app/messages.ts";
import { levelList, menu, startLevel, type Game, type Model } from "../src/app/model.ts";
import { noProgress, type Progress } from "../src/app/progress.ts";
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
const fresh: Game = startLevel(lattice, noProgress);

function run(model: Game, ...msgs: readonly Msg[]): Game {
  return played(msgs.reduce<Model>(update, model));
}

function played(model: Model): Game {
  if (model.screen !== "game") throw new Error(`expected a level, on the ${model.screen} screen`);
  return model;
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
      progress: noProgress,
      screen: "game",
      puzzle: lattice,
      threads: [],
      drag: undefined,
      history: [],
      solvedFor: undefined,
      rulesOpen: false,
    });
  });

  it("lays a thread from peg to peg in one drag", (): void => {
    const model: Game = run(fresh, press(2, 0), enter(1, 0), enter(1, 4), release);
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
    const dragging: Game = run(fresh, press(2, 0), enter(2, 1));
    expect(update(dragging, press(3, 0))).toBe(dragging);
  });

  it("returns the same model when the pointer stays on the end of the thread", (): void => {
    const dragging: Game = run(fresh, press(2, 0), enter(2, 1));
    expect(update(dragging, enter(2, 1))).toBe(dragging);
  });

  it("ignores moves and releases with no drag", (): void => {
    expect(update(fresh, enter(2, 1))).toBe(fresh);
    expect(update(fresh, release)).toBe(fresh);
    expect(update(fresh, cancel)).toBe(fresh);
  });

  it("keeps the laid threads when a drag is cancelled", (): void => {
    const laid: Game = run(fresh, press(2, 0), enter(2, 1), release);
    const cancelled: Game = run(laid, press(2, 0), enter(1, 0), cancel);
    expect(cancelled).toEqual(laid);
  });

  it("reroutes a thread from the square it's picked up at", (): void => {
    const laid: Game = run(fresh, press(2, 0), enter(1, 0), enter(1, 4), release);
    const rerouted: Game = run(laid, press(1, 1), enter(2, 1), release);
    expect(rerouted.threads).toEqual([threadOf("red", [2, 0], [1, 0], [1, 1], [2, 1])]);
  });

  it("joins threads drawn from both pegs where they meet", (): void => {
    const half: Game = run(fresh, press(1, 4), enter(1, 2), release);
    const joined: Game = run(half, press(2, 0), enter(1, 0), enter(1, 2), release);
    expect(joined.threads).toEqual([
      threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]),
    ]);
  });

  it("undoes a join when the drag moves back off it", (): void => {
    const half: Game = run(fresh, press(1, 4), enter(1, 2), release);
    const backedOff: Game = run(half, press(2, 0), enter(1, 0), enter(1, 2), enter(1, 1), release);
    expect(backedOff.threads).toEqual([
      threadOf("red", [1, 4], [1, 3], [1, 2]),
      threadOf("red", [2, 0], [1, 0], [1, 1]),
    ]);
  });
});

describe("update: Undo and Clear", (): void => {
  const laid: Game = run(fresh, press(2, 0), enter(1, 0), enter(1, 4), release);

  it("undoes the last change to the board", (): void => {
    const two: Game = run(laid, press(3, 0), enter(3, 1), release);
    expect(run(two, undo).threads).toEqual(laid.threads);
    expect(run(two, undo, undo).threads).toEqual([]);
  });

  it("has nothing to undo for a drag that changed nothing", (): void => {
    const tapped: Game = run(laid, press(0, 0), press(3, 0), cancel);
    expect(tapped.history).toEqual(laid.history);
  });

  it("clears every thread, and Clear itself can be undone", (): void => {
    const cleared: Game = run(laid, clear);
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
  const almost: Game = { ...fresh, threads: solution.slice(0, -1), drag: last };
  const won: Game = run(almost, release);

  it("starts the win once the last thread is laid", (): void => {
    expect(won.solvedFor).toBe(0);
  });

  it("doesn't start the win on a board that isn't solved", (): void => {
    expect(run(fresh, press(2, 0), enter(1, 0), release).solvedFor).toBeUndefined();
  });

  it("clears the level once solved, and only then", (): void => {
    expect(won.progress.cleared).toEqual([lattice.id]);
    expect(run(fresh, press(2, 0), enter(1, 0), release).progress).toBe(noProgress);
  });

  it("keeps the progress as it was when solving a level cleared before", (): void => {
    const progress: Progress = { ...noProgress, cleared: [lattice.id] };
    expect(run({ ...almost, progress }, release).progress).toBe(progress);
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
    expect(update(won, { type: "LevelStarted", puzzle: other })).toEqual(
      startLevel(other, won.progress),
    );
  });
});

describe("update: screens", (): void => {
  const play: Msg = { type: "PlayPressed" };
  const back: Msg = { type: "BackPressed" };
  const howToPlay: Msg = { type: "HowToPlayPressed" };
  const rulesClosed: Msg = { type: "RulesClosed" };

  it("goes from the menu to the level list and back", (): void => {
    expect(update(menu, play)).toEqual(levelList);
    expect(update(levelList, back)).toEqual(menu);
    expect(update(menu, back)).toBe(menu);
  });

  it("opens a level from the list and leaves it for the list", (): void => {
    expect(update(levelList, { type: "LevelStarted", puzzle: lattice })).toEqual(fresh);
    const laid: Game = run(fresh, press(2, 0), enter(1, 0), release);
    expect(update(laid, back)).toEqual(levelList);
  });

  it("leaves a level mid-drag without laying the thread", (): void => {
    const left: Model = [back, release].reduce<Model>(update, run(fresh, press(2, 0)));
    expect(left).toEqual(levelList);
  });

  it("opens and closes the rules over a level, keeping the board", (): void => {
    const laid: Game = run(fresh, press(2, 0), enter(1, 0), release);
    const open: Model = update(laid, howToPlay);
    expect(open).toEqual({ ...laid, rulesOpen: true });
    expect(update(open, howToPlay)).toBe(open);
    expect(update(open, rulesClosed)).toEqual(laid);
    expect(update(laid, rulesClosed)).toBe(laid);
  });

  it("starts the next level with the rules closed", (): void => {
    const open: Model = update(fresh, howToPlay);
    expect(update(open, { type: "LevelStarted", puzzle: lattice })).toEqual(fresh);
  });

  it("opens How the Puzzles Are Made from the menu and steps through it within its steps", (): void => {
    const opened: Model = update(menu, { type: "HowPuzzlesAreMadePressed", steps: 3 });
    expect(opened).toEqual({ screen: "tour", step: 0, steps: 3, elapsed: 0, progress: noProgress });
    const next: Msg = { type: "NextStepPressed" };
    const previous: Msg = { type: "PreviousStepPressed" };
    expect(update(opened, previous)).toBe(opened);
    const last: Model = [next, next].reduce<Model>(update, opened);
    expect(last).toEqual({ screen: "tour", step: 2, steps: 3, elapsed: 0, progress: noProgress });
    expect(update(last, next)).toBe(last);
    expect(update(last, previous)).toEqual({
      screen: "tour",
      step: 1,
      steps: 3,
      elapsed: 0,
      progress: noProgress,
    });
    expect(update(last, back)).toEqual(menu);
  });

  it("runs How the Puzzles Are Made' clock on ticks, restarting it on each step", (): void => {
    const opened: Model = update(menu, { type: "HowPuzzlesAreMadePressed", steps: 3 });
    const ticked: Model = [tick(100), tick(250)].reduce<Model>(update, opened);
    expect(ticked).toMatchObject({ step: 0, elapsed: 350 });
    expect(update(ticked, { type: "NextStepPressed" })).toMatchObject({ step: 1, elapsed: 0 });
  });

  it("runs the menu's clock on ticks, and restarts it on return", (): void => {
    const ticked: Model = [tick(100), tick(250)].reduce<Model>(update, menu);
    expect(ticked).toEqual({ ...menu, elapsed: 350 });
    expect(update(update(ticked, play), back)).toEqual(menu);
  });

  it("carries progress from screen to screen", (): void => {
    const progress: Progress = {
      cleared: ["key"],
      tipsSeen: ["drag"],
      theme: "dark",
      muted: true,
      volume: { effects: 0.5, music: 0.2 },
    };
    const opened: Msg = { type: "HowPuzzlesAreMadePressed", steps: 3 };
    const started: Msg = { type: "LevelStarted", puzzle: lattice };
    const route: readonly Msg[] = [play, started, back, back, opened, back];
    let model: Model = { ...menu, progress };
    for (const msg of route) {
      model = update(model, msg);
      expect(model.progress).toBe(progress);
    }
  });

  it("remembers a tip once seen, on any screen", (): void => {
    const seen: Msg = { type: "TipSeen", tip: "drag" };
    for (const model of [menu, levelList, fresh]) {
      const after: Model = update(model, seen);
      expect(after).toEqual({ ...model, progress: { ...noProgress, tipsSeen: ["drag"] } });
      expect(update(after, seen)).toBe(after);
    }
  });

  it("remembers the chosen theme, on any screen", (): void => {
    const chosen: Msg = { type: "ThemeChosen", theme: "dark" };
    for (const model of [menu, levelList, fresh]) {
      const after: Model = update(model, chosen);
      expect(after).toEqual({ ...model, progress: { ...noProgress, theme: "dark" } });
      expect(update(after, chosen)).toBe(after);
    }
  });

  it("toggles mute on any screen", (): void => {
    const toggled: Msg = { type: "MuteToggled" };
    for (const model of [menu, levelList, fresh]) {
      const muted: Model = update(model, toggled);
      expect(muted).toEqual({ ...model, progress: { ...noProgress, muted: true } });
      expect(update(muted, toggled)).toEqual(model);
    }
  });

  it("changes a volume on any screen", (): void => {
    const changed: Msg = { type: "VolumeChanged", channel: "music", volume: 0.25 };
    for (const model of [menu, levelList, fresh]) {
      const after: Model = update(model, changed);
      expect(after.progress.volume).toEqual({ effects: 1, music: 0.25 });
      expect(update(after, changed)).toBe(after);
    }
  });

  it("ignores level messages outside a level", (): void => {
    const levelMsgs: readonly Msg[] = [
      press(2, 0),
      enter(2, 1),
      release,
      cancel,
      undo,
      clear,
      howToPlay,
      rulesClosed,
    ];
    for (const msg of levelMsgs) {
      expect(update(menu, msg)).toBe(menu);
    }
    for (const msg of [...levelMsgs, tick(100)]) {
      expect(update(levelList, msg)).toBe(levelList);
    }
  });
});
