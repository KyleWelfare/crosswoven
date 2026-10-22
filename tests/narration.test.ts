import { describe, expect, it } from "vitest";
import type { BoardKey, Msg } from "../src/app/messages.ts";
import { levelList, startLevel, type Game, type Model } from "../src/app/model.ts";
import { boardSummary, describeSquare, narration } from "../src/app/narration.ts";
import { noProgress } from "../src/app/progress.ts";
import { update } from "../src/app/update.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import { onlySolution } from "./fixtures/all-solutions.ts";
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

const lattice: Puzzle = decoded(examplePuzzle);
const fresh: Game = startLevel(lattice, noProgress);

const key = (pressed: BoardKey): Msg => ({ type: "BoardKeyPressed", key: pressed });
const focus: Msg = { type: "BoardFocused" };

function run(model: Game, ...msgs: readonly Msg[]): Game {
  const after: Model = msgs.reduce<Model>(update, model);
  if (after.screen !== "game") throw new Error(`expected a level, on the ${after.screen} screen`);
  return after;
}

/** What `msg` announces, sent to `model`. */
function heard(model: Game, msg: Msg): string | undefined {
  return narration(model, update(model, msg), msg);
}

const focused: Game = run(fresh, focus);
// On the red 6 at (2, 0), whose thread runs left and down the second column to the red 6 at (1, 4).
const holding: Game = run(focused, key("right"), key("right"), key("lay"));
const almostTied: Game = run(holding, key("left"), key("down"), key("down"), key("down"));

describe("narration", (): void => {
  it("describes the square under the cursor when the board gets keyboard focus", (): void => {
    expect(heard(fresh, focus)).toBe("Row 1, column 1: blank square.");
  });

  it("describes each square the cursor moves to, pegs included", (): void => {
    expect(heard(run(focused, key("right")), key("right"))).toBe(
      "Row 1, column 3: red square, red peg 6, loose.",
    );
  });

  it("names the threads through a square, and whether it's woven", (): void => {
    const solved: Game = { ...fresh, threads: onlySolution(lattice) };
    expect(describeSquare(solved, { x: 1, y: 1 })).toMatch(
      /^Row 2, column 2: purple square, (red and blue|blue and red) threads, woven\.$/,
    );
  });

  it("says when a thread is picked up, and how far it has come with each square", (): void => {
    expect(heard(run(focused, key("right"), key("right")), key("lay"))).toBe(
      "Picked up the red thread. 1 of 6 squares.",
    );
    expect(heard(holding, key("left"))).toBe(
      "Row 1, column 2: red square, red thread, woven. 2 of 6 squares.",
    );
  });

  it("says a thread is tied as it reaches its peg, and counts the tied pegs once laid", (): void => {
    expect(heard(almostTied, key("down"))).toBe(
      "Row 5, column 2: red square, red peg 6, tied, red thread, woven. Tied.",
    );
    expect(heard(run(almostTied, key("down")), key("lay"))).toBe(
      "Red thread tied. 2 of 8 pegs tied.",
    );
  });

  it("says why the cursor didn't move", (): void => {
    expect(heard(focused, key("left"))).toBe("Edge of the board.");
    expect(heard(holding, key("right"))).toBe("The thread can't go there.");
    expect(heard(holding, key("up"))).toBe("Edge of the board.");
    expect(heard(run(almostTied, key("down")), key("right"))).toBe(
      "The thread is tied. Press Enter to lay it.",
    );
    const full: Game = run(almostTied, key("left"));
    expect(heard(full, key("up"))).toBe("The thread is at its full length of 6.");
    expect(heard(focused, key("lay"))).toBe("No thread to pick up here.");
  });

  it("says a thread was laid loose, or dropped", (): void => {
    const two: Game = run(holding, key("left"));
    expect(heard(two, key("lay"))).toBe("Red thread laid, loose. 2 of 6 squares.");
    expect(heard(two, key("drop"))).toBe("Thread dropped.");
  });

  it("announces a peg marked 1 tied in one press, and says so when pressed again", (): void => {
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
    const onPeg: Game = run(
      single,
      focus,
      ...Array.from({ length: 4 }, (): Msg => key("right")),
      ...Array.from({ length: 4 }, (): Msg => key("down")),
    );
    expect(heard(onPeg, key("lay"))).toBe("Yellow thread tied. 1 of 3 pegs tied.");
    expect(heard(run(onPeg, key("lay")), key("lay"))).toBe("Already tied.");
  });

  it("announces ties made with the pointer too", (): void => {
    const dragged: Game = run(
      fresh,
      { type: "SquarePressed", x: 2, y: 0 },
      { type: "SquareEntered", x: 1, y: 0 },
      { type: "SquareEntered", x: 1, y: 4 },
    );
    expect(heard(dragged, { type: "PointerReleased" })).toBe("Red thread tied. 2 of 8 pegs tied.");
  });

  it("announces Undo and Clear only when they change the board", (): void => {
    const laid: Game = run(holding, key("left"), key("lay"));
    expect(heard(laid, { type: "UndoPressed" })).toBe("Undone. 0 of 8 pegs tied.");
    expect(heard(laid, { type: "ClearPressed" })).toBe("Board cleared.");
    expect(heard(fresh, { type: "UndoPressed" })).toBeUndefined();
  });

  it("leaves the win to the win message, and says nothing off the board", (): void => {
    const last: Game = { ...fresh, threads: onlySolution(lattice).slice(1) };
    const lastThread: Game = { ...last, drag: onlySolution(lattice)[0] };
    expect(heard(lastThread, { type: "PointerReleased" })).toBeUndefined();
    expect(narration(levelList, levelList, key("lay"))).toBeUndefined();
  });

  it("sums up the board for its description", (): void => {
    expect(boardSummary(fresh)).toBe(
      "5 by 5 board. 0 of 8 pegs tied. 0 of 22 coloured squares woven.",
    );
  });
});
