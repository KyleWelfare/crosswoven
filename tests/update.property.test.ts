import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Msg } from "../src/app/messages.ts";
import { startLevel, type Model } from "../src/app/model.ts";
import { shownThreads } from "../src/app/drag.ts";
import { update } from "../src/app/update.ts";
import { pegAt, type Peg, type Point, type Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

const lattice: Puzzle = decoded(examplePuzzle);
// Short threads and a peg marked 1, so random drags tie threads often. The lattice's long ones
// rarely come out at exactly the right length.
const short: Puzzle = puzzleOf(
  ["YYY.R", "....R", "BB..R", ".B...", ".BB.Y"],
  [
    [0, 0, 3],
    [2, 0, 3],
    [4, 0, 3],
    [4, 2, 3],
    [0, 2, 3],
    [1, 3, 3],
    [1, 4, 2],
    [2, 4, 2],
    [4, 4, 1],
  ],
);

interface Case {
  readonly puzzle: Puzzle;
  readonly msgs: readonly Msg[];
}

// Both puzzles are 5×5. One square past each edge, so pointers off the board are covered too.
const coordinate: fc.Arbitrary<number> = fc.integer({ min: -1, max: 5 });
const anySquare: fc.Arbitrary<Point> = fc.record({ x: coordinate, y: coordinate });
const step: fc.Arbitrary<Point> = fc.constantFrom(
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
);

type Move =
  { readonly kind: "step"; readonly by: Point } | { readonly kind: "jump"; readonly to: Point };

/**
 * A press, mostly on a peg, then moves to neighbouring squares with the odd jump, then a release
 * or a cancel. Purely random messages almost never press a peg and walk on from it.
 */
function gesture(puzzle: Puzzle): fc.Arbitrary<Msg[]> {
  return fc
    .record({
      start: fc.oneof(
        {
          weight: 3,
          arbitrary: fc.constantFrom(
            ...puzzle.pegs.map((peg: Point): Point => ({ x: peg.x, y: peg.y })),
          ),
        },
        { weight: 1, arbitrary: anySquare },
      ),
      moves: fc.array(
        fc.oneof(
          { weight: 6, arbitrary: step.map((by: Point): Move => ({ kind: "step", by })) },
          { weight: 1, arbitrary: anySquare.map((to: Point): Move => ({ kind: "jump", to })) },
        ),
        { maxLength: 20 },
      ),
      end: fc.oneof(
        { weight: 3, arbitrary: fc.constant<Msg>({ type: "PointerReleased" }) },
        { weight: 1, arbitrary: fc.constant<Msg>({ type: "PointerCancelled" }) },
      ),
    })
    .map(({ start, moves, end }: { start: Point; moves: Move[]; end: Msg }): Msg[] => {
      let at: Point = start;
      const entered: Msg[] = moves.map((move: Move): Msg => {
        at = move.kind === "jump" ? move.to : { x: at.x + move.by.x, y: at.y + move.by.y };
        return { type: "SquareEntered", ...at };
      });
      return [{ type: "SquarePressed", ...start }, ...entered, end];
    });
}

const stray: fc.Arbitrary<Msg[]> = fc.oneof(
  anySquare.map((square: Point): Msg[] => [{ type: "SquarePressed", ...square }]),
  anySquare.map((square: Point): Msg[] => [{ type: "SquareEntered", ...square }]),
  fc.constant<Msg[]>([{ type: "PointerReleased" }]),
  fc.constant<Msg[]>([{ type: "PointerCancelled" }]),
  fc.constant<Msg[]>([{ type: "UndoPressed" }]),
  fc.constant<Msg[]>([{ type: "ClearPressed" }]),
  fc.integer({ min: 0, max: 2000 }).map((dt: number): Msg[] => [{ type: "Tick", dt }]),
);

const cases: fc.Arbitrary<Case> = fc
  .constantFrom(lattice, short)
  .chain((puzzle: Puzzle): fc.Arbitrary<Case> =>
    fc
      .array(fc.oneof({ weight: 4, arbitrary: gesture(puzzle) }, { weight: 1, arbitrary: stray }), {
        maxLength: 10,
      })
      .map((parts: Msg[][]): Case => ({ puzzle, msgs: parts.flat() })),
  );

function key(square: Point): string {
  return `${String(square.x)},${String(square.y)}`;
}

/** Breaks no rule of laying, whatever it does to the pattern. */
function expectWellFormed(puzzle: Puzzle, thread: Thread): void {
  const [first, ...rest]: readonly Point[] = thread.squares;
  const start: Peg | undefined = first && pegAt(puzzle, first);
  expect(start?.colour).toBe(thread.colour);
  expect(thread.squares.length).toBeLessThanOrEqual(start?.length ?? 0);
  expect(new Set(thread.squares.map(key)).size).toBe(thread.squares.length);
  thread.squares.forEach((square: Point, i: number): void => {
    expect(puzzle.pattern[square.y]?.[square.x] ?? "blank").not.toBe("blank");
    const previous: Point | undefined = thread.squares[i - 1];
    if (previous) expect(Math.abs(previous.x - square.x) + Math.abs(previous.y - square.y)).toBe(1);
  });
  // Pegs are only ever ends: nothing passes through one, and a thread ends on one only if it fits.
  for (const square of rest.slice(0, -1)) expect(pegAt(puzzle, square)).toBeUndefined();
  const last: Point | undefined = rest.at(-1);
  const end: Peg | undefined = last && pegAt(puzzle, last);
  if (end) {
    expect(end.colour).toBe(thread.colour);
    expect(end.length).toBe(start?.length);
    expect(thread.squares.length).toBe(end.length);
  }
}

describe("update properties", (): void => {
  it("never changes the model it's given", (): void => {
    fc.assert(
      fc.property(cases, ({ puzzle, msgs }: Case): void => {
        let model: Model = startLevel(puzzle);
        for (const msg of msgs) {
          const before: Model = structuredClone(model);
          const next: Model = update(model, msg);
          expect(model).toEqual(before);
          model = next;
        }
      }),
    );
  });

  it("only lays and shows threads that break no rule of laying", (): void => {
    fc.assert(
      fc.property(cases, ({ puzzle, msgs }: Case): void => {
        const model: Model = msgs.reduce(update, startLevel(puzzle));
        expectBoard(puzzle, model.threads);
        expectBoard(puzzle, shownThreads(puzzle, model.threads, model.drag));
        if (model.drag) expectWellFormed(puzzle, model.drag);
      }),
    );
  });
});

/** Each thread is well formed, no peg has two, and threads of one colour never share a square. */
function expectBoard(puzzle: Puzzle, threads: readonly Thread[]): void {
  for (const thread of threads) expectWellFormed(puzzle, thread);
  const ends: string[] = threads.flatMap((thread: Thread): string[] =>
    [...new Set([thread.squares[0], thread.squares.at(-1)])]
      .filter(
        (end: Point | undefined): end is Point =>
          end !== undefined && pegAt(puzzle, end) !== undefined,
      )
      .map(key),
  );
  expect(new Set(ends).size).toBe(ends.length);
  const used: string[] = threads.flatMap((thread: Thread): string[] =>
    thread.squares.map((square: Point): string => `${thread.colour} ${key(square)}`),
  );
  expect(new Set(used).size).toBe(used.length);
}
