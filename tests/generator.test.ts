import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_LAID_LENGTH, layThreads, type Laying } from "../src/core/generator.ts";
import type { Picture } from "../src/core/picture.ts";
import type { Peg, Point, Puzzle, SquareColour } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import type { LevelJson, PegJson } from "./fixtures/level-json.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { levelOf, randomWeaves, ruleBreaks, type Weave } from "./fixtures/random-weave.ts";

function pictureOf(puzzle: Puzzle): Picture {
  const { id, title, width, height, pattern }: Picture = puzzle;
  return { id, title, width, height, pattern };
}

const squareCodes: ReadonlyMap<string, SquareColour> = new Map<string, SquareColour>([
  [".", "blank"],
  ["R", "red"],
  ["B", "blue"],
  ["Y", "yellow"],
  ["P", "purple"],
  ["O", "orange"],
  ["G", "green"],
]);

function picture(rows: readonly string[]): Picture {
  return {
    id: "test",
    title: "Test",
    width: rows[0]?.length ?? 0,
    height: rows.length,
    pattern: rows.map((row: string): SquareColour[] =>
      Array.from(row, (code: string): SquareColour => squareCodes.get(code) ?? "blank"),
    ),
  };
}

function laid(laying: Laying): Extract<Laying, { ok: true }> {
  if (!laying.ok) throw new Error(`expected a laying, got bad squares`);
  return laying;
}

/** Checked by code written independently of the generator, as for the search solver. */
function expectWeaves(rows: readonly string[], laying: Laying): void {
  const { puzzle, threads }: Extract<Laying, { ok: true }> = laid(laying);
  const rewoven: LevelJson = levelOf(puzzle.width, puzzle.height, threads);
  expect(rewoven.pattern).toEqual(rows);
  expect(rewoven.pegs).toEqual(
    puzzle.pegs.map(({ x, y, length }: Peg): PegJson => ({ x, y, length })),
  );
  expect(ruleBreaks(puzzle.width, puzzle.height, threads)).toEqual([]);
}

const heart: Picture = picture([
  ".......",
  ".RR.RR.",
  "RRRRRRR",
  "RRRRRRR",
  ".RRRRR.",
  "..RRR..",
  "...R...",
]);

describe("layThreads", (): void => {
  it("gives the same laying for the same picture and seed", (): void => {
    expect(layThreads(heart, 7)).toEqual(layThreads(heart, 7));
    expect(layThreads(heart, 7)).not.toEqual(layThreads(heart, 8));
  });

  it("weaves any picture woven from random threads, breaking no rule", (): void => {
    fc.assert(
      fc.property(randomWeaves, fc.nat(1000), (weave: Weave, seed: number): void => {
        expectWeaves(weave.level.pattern, layThreads(pictureOf(decoded(weave.level)), seed));
      }),
    );
  });

  it("keeps laid threads short", (): void => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const thread of laid(layThreads(heart, seed)).threads) {
        expect(thread.squares.length).toBeLessThanOrEqual(MAX_LAID_LENGTH);
      }
    }
  });

  it("runs threads straight through a band of crossings", (): void => {
    const band: Picture = picture(["..B..", "..B..", "RRPRR", "..B..", "..B.."]);
    const threads: readonly Thread[] = laid(layThreads(band, 1)).threads;
    expect(threads).toEqual([
      { colour: "blue", squares: [0, 1, 2, 3, 4].map((y: number): Point => ({ x: 2, y })) },
      { colour: "red", squares: [0, 1, 2, 3, 4].map((x: number): Point => ({ x, y: 2 })) },
    ]);
  });

  it("runs touching crossings the same way", (): void => {
    const rows: readonly string[] = ["..R..", "..R..", ".BPB.", ".BPB.", "..R..", "..R.."];
    for (const seed of [1, 2, 3]) expectWeaves(rows, layThreads(picture(rows), seed));
  });

  it("reports a crossing on the edge of the grid", (): void => {
    expect(layThreads(picture(["RPR..", ".B...", ".....", ".....", "....."]), 1)).toEqual({
      ok: false,
      badSquares: [{ x: 1, y: 0 }],
    });
  });

  it("reports a ring of crossings that leaves a thread no ends", (): void => {
    const ring: Picture = picture(["..B..", ".RPR.", "BPBPB", ".RPR.", "..B.."]);
    expect(layThreads(ring, 1)).toEqual({
      ok: false,
      badSquares: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
        { x: 1, y: 3 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
      ],
    });
  });

  it("reports a crossing whose neighbours don't line up", (): void => {
    expect(layThreads(picture([".....", ".R...", "RPB..", ".....", "....."]), 1)).toEqual({
      ok: false,
      badSquares: [{ x: 1, y: 2 }],
    });
  });
});
