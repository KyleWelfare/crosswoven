import { describe, expect, it } from "vitest";
import type { BoardKey, Msg } from "../src/app/messages.ts";
import {
  levelList,
  levelNumber,
  menu,
  nextLevel,
  startLevel,
  type Game,
  type Model,
} from "../src/app/model.ts";
import { noProgress, type Progress } from "../src/app/progress.ts";
import { update } from "../src/app/update.ts";
import { WIN_FADE } from "../src/app/win.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { onlySolution } from "./fixtures/all-solutions.ts";
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
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
const key = (pressed: BoardKey): Msg => ({ type: "BoardKeyPressed", key: pressed });
const focus: Msg = { type: "BoardFocused" };
const blur: Msg = { type: "BoardBlurred" };
const repeat = (times: number, msg: Msg): Msg[] => Array.from({ length: times }, (): Msg => msg);

describe("update", (): void => {
  it("starts a level with no threads, no drag and nothing to undo", (): void => {
    expect(fresh).toEqual({
      progress: noProgress,
      levels: [lattice],
      screen: "game",
      puzzle: lattice,
      threads: [],
      drag: undefined,
      history: [],
      solvedFor: undefined,
      rulesOpen: false,
      cursor: { x: 0, y: 0 },
      cursorShown: false,
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

describe("update: keyboard", (): void => {
  const focused: Game = run(fresh, focus);
  const holding: Game = run(focused, ...repeat(2, key("right")), key("lay"));

  it("lays a thread from peg to peg a square at a time", (): void => {
    const model: Game = run(holding, key("left"), ...repeat(4, key("down")), key("lay"));
    expect(model.threads).toEqual([
      threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]),
    ]);
    expect(model.drag).toBeUndefined();
    expect(model.cursor).toEqual({ x: 1, y: 4 });
  });

  it("shows the cursor on keyboard focus, and hides it on blur or a press on the board", (): void => {
    expect(focused.cursorShown).toBe(true);
    expect(run(focused, blur).cursorShown).toBe(false);
    expect(run(focused, press(0, 0)).cursorShown).toBe(false);
  });

  it("shows the cursor where it was on the first key after a press, without acting", (): void => {
    const pressed: Game = run(focused, key("right"), press(0, 0));
    expect(run(pressed, key("right"))).toEqual({ ...pressed, cursorShown: true });
  });

  it("keeps the cursor on the board", (): void => {
    expect(update(focused, key("left"))).toBe(focused);
    expect(update(focused, key("up"))).toBe(focused);
  });

  it("holds the cursor where the thread can't go", (): void => {
    // (3, 0) is a red peg of another length.
    expect(update(holding, key("right"))).toBe(holding);
  });

  it("takes back a square, and drops a thread taken back to its peg", (): void => {
    const two: Game = run(holding, key("down"), key("shorten"));
    expect(two.drag).toEqual(threadOf("red", [2, 0]));
    expect(two.cursor).toEqual({ x: 2, y: 0 });
    expect(run(two, key("shorten")).drag).toBeUndefined();
  });

  it("drops the thread on Escape or blur, keeping those laid", (): void => {
    const laid: Game = run(holding, key("down"), key("lay"));
    const lifted: Game = run(laid, key("lay"), key("left"));
    expect(run(lifted, key("drop")).threads).toEqual(laid.threads);
    expect(run(lifted, key("drop")).drag).toBeUndefined();
    expect(run(lifted, blur).drag).toBeUndefined();
  });

  it("picks up a laid thread at the cursor", (): void => {
    const laid: Game = run(holding, ...repeat(2, key("down")), key("lay"));
    const lifted: Game = run(laid, key("up"), key("lay"));
    expect(lifted.drag).toEqual(threadOf("red", [2, 0], [2, 1]));
  });

  it("ties a peg marked 1 in one press", (): void => {
    const single: Game = startLevel(
      puzzleOf(
        ["YYY..", ".....", ".....", ".....", "....Y"],
        [
          [0, 0, 3],
          [2, 0, 3],
          [4, 4, 1],
        ],
      ),
      noProgress,
    );
    const tied: Game = run(
      single,
      focus,
      ...repeat(4, key("right")),
      ...repeat(4, key("down")),
      key("lay"),
    );
    expect(tied.threads).toEqual([threadOf("yellow", [4, 4])]);
    expect(tied.drag).toBeUndefined();
  });

  it("leaves a thread laid with the pointer to the pointer", (): void => {
    const dragging: Game = run(focused, press(2, 0));
    expect(update(dragging, key("down"))).toBe(dragging);
    expect(update(dragging, focus)).toBe(dragging);
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

  it("starts the next level fresh, once solved and while there is one", (): void => {
    const other: Puzzle = decoded(turningCrossingLevel);
    const levels: readonly Puzzle[] = [lattice, other];
    const next: Msg = { type: "NextLevelPressed" };
    expect(update({ ...won, levels }, next)).toEqual(startLevel(other, won.progress, levels));
    const unsolved: Game = { ...fresh, levels };
    expect(update(unsolved, next)).toBe(unsolved);
    expect(update(won, next)).toBe(won);
  });

  it("keeps its place among the levels through JSON", (): void => {
    const other: Puzzle = decoded(turningCrossingLevel);
    const revive = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
    const first: Game = revive({ ...won, levels: [lattice, other] });
    expect(levelNumber(first)).toBe(1);
    expect(nextLevel(first)?.id).toBe(other.id);
    expect(levelNumber(revive({ ...won, levels: [other, lattice] }))).toBe(2);
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
    const list: Model = { ...levelList, levels: [lattice] };
    expect(update(list, { type: "LevelStarted", puzzle: lattice })).toEqual(fresh);
    const laid: Game = run(fresh, press(2, 0), enter(1, 0), release);
    expect(update(laid, back)).toEqual(list);
  });

  it("leaves a level mid-drag without laying the thread", (): void => {
    const left: Model = [back, release].reduce<Model>(update, run(fresh, press(2, 0)));
    expect(left).toEqual({ ...levelList, levels: [lattice] });
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
    const onStep = (step: number): Model => ({ ...menu, screen: "tour", step, steps: 3 });
    const opened: Model = update(menu, { type: "HowPuzzlesAreMadePressed", steps: 3 });
    expect(opened).toEqual(onStep(0));
    const next: Msg = { type: "NextStepPressed" };
    const previous: Msg = { type: "PreviousStepPressed" };
    expect(update(opened, previous)).toBe(opened);
    const last: Model = [next, next].reduce<Model>(update, opened);
    expect(last).toEqual(onStep(2));
    expect(update(last, next)).toBe(last);
    expect(update(last, previous)).toEqual(onStep(1));
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

  it("ignores a tip dismissed where no tip is shown", (): void => {
    for (const model of [menu, levelList, fresh]) {
      expect(update(model, { type: "TipDismissed" })).toBe(model);
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
      key("lay"),
      focus,
      blur,
    ];
    for (const msg of levelMsgs) {
      expect(update(menu, msg)).toBe(menu);
    }
    for (const msg of [...levelMsgs, tick(100)]) {
      expect(update(levelList, msg)).toBe(levelList);
    }
  });
});
