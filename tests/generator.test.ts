import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMITS,
  generateLevel,
  layThreads,
  type Attempt,
  type GeneratedLevel,
  type Generation,
  type Laying,
} from "../src/core/generator.ts";
import { encodeLevel, type LevelFile, type PegEntry } from "../src/core/level-decoder.ts";
import { DEFAULT_LENGTHS, type Picture, type ThreadLengths } from "../src/core/picture.ts";
import type { Peg, Point, Puzzle, SquareColour } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { validateLevel } from "../src/core/validator.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { levelOf, randomWeaves, ruleBreaks, type Weave } from "./fixtures/random-weave.ts";

function pictureOf(puzzle: Puzzle): Picture {
  const { id, title, width, height, pattern }: Puzzle = puzzle;
  return { id, title, width, height, pattern, lengths: DEFAULT_LENGTHS };
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

function picture(rows: readonly string[], lengths: ThreadLengths = DEFAULT_LENGTHS): Picture {
  return {
    id: "test",
    title: "Test",
    width: rows[0]?.length ?? 0,
    height: rows.length,
    pattern: rows.map((row: string): SquareColour[] =>
      Array.from(row, (code: string): SquareColour => squareCodes.get(code) ?? "blank"),
    ),
    lengths,
  };
}

function laid(laying: Laying): Extract<Laying, { ok: true }> {
  if (!laying.ok) throw new Error(`expected a laying, got bad squares`);
  return laying;
}

/** Checked by code written independently of the generator, as for the search solver. */
function expectWeaves(rows: readonly string[], laying: Laying): void {
  const { puzzle, threads }: Extract<Laying, { ok: true }> = laid(laying);
  const rewoven: LevelFile = levelOf(puzzle.width, puzzle.height, threads);
  expect(rewoven.pattern).toEqual(rows);
  expect(rewoven.pegs).toEqual(
    puzzle.pegs.map(({ x, y, length }: Peg): PegEntry => ({ x, y, length })),
  );
  expect(ruleBreaks(puzzle.width, puzzle.height, threads)).toEqual([]);
}

/** One open colour, where threads have room to wander and numbers to repeat. */
const field: Picture = picture(Array.from({ length: 9 }, (): string => "RRRRRRRRR"));

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

  it("leaves the picture's lengths out of the puzzle", (): void => {
    expect(Object.keys(laid(layThreads(heart, 1)).puzzle).sort()).toEqual([
      "height",
      "id",
      "pattern",
      "pegs",
      "title",
      "width",
    ]);
  });

  it("weaves any picture woven from random threads, breaking no rule", (): void => {
    fc.assert(
      fc.property(randomWeaves, fc.nat(1000), (weave: Weave, seed: number): void => {
        expectWeaves(weave.level.pattern, layThreads(pictureOf(decoded(weave.level)), seed));
      }),
    );
  });

  it("weaves any picture with the same-numbers bias, breaking no rule", (): void => {
    fc.assert(
      fc.property(randomWeaves, fc.nat(1000), (weave: Weave, seed: number): void => {
        const biased: Picture = { ...pictureOf(decoded(weave.level)), sameNumbers: 1 };
        expectWeaves(weave.level.pattern, layThreads(biased, seed));
      }),
    );
  });

  it("lays exactly as before with no same-numbers bias", (): void => {
    for (const seed of [1, 2, 3]) {
      expect(layThreads({ ...heart, sameNumbers: 0 }, seed)).toEqual(layThreads(heart, seed));
    }
  });

  it("repeats numbers more with the same-numbers bias", (): void => {
    const distinctNumbers = (sameNumbers: number): number =>
      [1, 2, 3, 4, 5, 6].reduce((total: number, seed: number): number => {
        const pegs: readonly Peg[] = laid(layThreads({ ...field, sameNumbers }, seed)).puzzle.pegs;
        return total + new Set<number>(pegs.map((peg: Peg): number => peg.length)).size;
      }, 0);
    expect(distinctNumbers(1)).toBeLessThan(distinctNumbers(0));
  });

  it("keeps grown threads no longer than the picture's max", (): void => {
    const long: Picture = { ...heart, lengths: { min: 4, max: 8 } };
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const thread of laid(layThreads(heart, seed)).threads) {
        expect(thread.squares.length).toBeLessThanOrEqual(DEFAULT_LENGTHS.max);
      }
      for (const thread of laid(layThreads(long, seed)).threads) {
        expect(thread.squares.length).toBeLessThanOrEqual(long.lengths.max);
      }
    }
  });

  it("lays fewer pegs with longer threads", (): void => {
    const pegs = (lengths: ThreadLengths): number =>
      laid(layThreads({ ...heart, lengths }, 1)).puzzle.pegs.length;
    expect(pegs({ min: 5, max: 9 })).toBeLessThan(pegs(DEFAULT_LENGTHS));
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

  it("reports a ring of crossings that leaves a thread no ends, and its centre pulled four ways", (): void => {
    const ring: Picture = picture(["..B..", ".RPR.", "BPBPB", ".RPR.", "..B.."]);
    expect(layThreads(ring, 1)).toEqual({
      ok: false,
      badSquares: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 1, y: 3 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
      ],
    });
  });

  it("reports every square pulled three ways, across colours", (): void => {
    const rows: readonly string[] = [
      "...B...",
      "..RPR..",
      ".BPBPB.",
      "..R.R..",
      ".......",
      "...R...",
      "..BPB..",
      ".RPRPR.",
      "..B.B..",
    ];
    expect(layThreads(picture(rows), 1)).toEqual({
      ok: false,
      badSquares: [
        { x: 3, y: 2 },
        { x: 3, y: 7 },
      ],
    });
  });

  it("reports a ring and a square pulled three ways in one colour together", (): void => {
    const rows: readonly string[] = [
      "...B...",
      "..RPR..",
      ".BPBPB.",
      "..RPR..",
      "...B...",
      ".......",
      "...R...",
      "..BPB..",
      ".RPRPR.",
      "..B.B..",
    ];
    const laying: Laying = layThreads(picture(rows), 1);
    expect(laying.ok).toBe(false);
    if (laying.ok) return;
    expect(laying.badSquares).toEqual(
      expect.arrayContaining([
        { x: 2, y: 1 },
        { x: 3, y: 8 },
      ]),
    );
  });

  it("reports a crossing whose neighbours don't line up", (): void => {
    expect(layThreads(picture([".....", ".R...", "RPB..", ".....", "....."]), 1)).toEqual({
      ok: false,
      badSquares: [{ x: 1, y: 2 }],
    });
  });
});

function generated(generation: Generation): GeneratedLevel {
  if (!generation.ok) throw new Error("expected a level, got bad squares");
  return generation;
}

describe("generateLevel", (): void => {
  it("gives the same level for the same picture", (): void => {
    expect(generateLevel(heart)).toEqual(generateLevel(heart));
  });

  it("always ends in a level the validator accepts", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const { puzzle }: GeneratedLevel = generated(
          generateLevel(pictureOf(decoded(weave.level))),
        );
        expect(validateLevel(encodeLevel(puzzle))).toMatchObject({ ok: true });
      }),
    );
  });

  it("always ends in a level the validator accepts when the picture is hidden", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const { puzzle }: GeneratedLevel = generated(
          generateLevel({ ...pictureOf(decoded(weave.level)), hidden: true }),
        );
        expect(validateLevel(encodeLevel(puzzle))).toMatchObject({ ok: true });
      }),
    );
  });

  it("makes a hidden picture a hidden level the validator accepts", (): void => {
    const hiddenHeart: Picture = {
      ...picture(["YYYYYYY", "YRRYRRY", "RRRRRRR", "RRRRRRR", "YRRRRRY", "YYRRRYY", "YYYRYYY"]),
      hidden: true,
    };
    const generation: Generation = generateLevel(hiddenHeart);
    if (!generation.ok) throw new Error(`expected a level, got ${generation.reason}`);
    expect(generation.puzzle.hidden).toBe(true);
    expect(validateLevel(encodeLevel(generation.puzzle))).toMatchObject({ ok: true });
  });

  it("keeps the first seed the validator accepts when there's no target", (): void => {
    const attempts: readonly Attempt[] = generated(generateLevel(heart)).attempts;
    expect(attempts.map((attempt: Attempt): number => attempt.seed)).toEqual([1]);
  });

  it("lays only a picture's pinned seed", (): void => {
    const attempts: readonly Attempt[] = generated(generateLevel({ ...heart, seed: 7 })).attempts;
    expect(attempts.map((attempt: Attempt): number => attempt.seed)).toEqual([7]);
  });

  it("settles every seed and keeps the one nearest the target rounds", (): void => {
    const aimed = (targetRounds: number): GeneratedLevel =>
      generated(generateLevel({ ...field, sameNumbers: 1, targetRounds }));
    const easy: GeneratedLevel = aimed(0);
    const hard: GeneratedLevel = aimed(20);
    expect(new Set(easy.attempts.map((attempt: Attempt): number => attempt.seed)).size).toBe(
      DEFAULT_LIMITS.seeds,
    );
    expect(easy.profile.rounds).toBeLessThan(hard.profile.rounds);
    expect(aimed(hard.profile.rounds).profile.rounds).toBe(hard.profile.rounds);
  });

  it("splits a thread where two solutions differ, then tries again", (): void => {
    const rows: readonly string[] = [
      "..........",
      "........BB",
      "....YYY.B.",
      "...YYY....",
      "..........",
    ];
    const attempts: readonly Attempt[] = generated(generateLevel(picture(rows))).attempts;
    expect(attempts.map((attempt: Attempt): string => attempt.outcome)).toEqual([
      "not-unique",
      "accepted",
    ]);
    expect(attempts[0]?.trouble).not.toEqual([]);
    expect(attempts[1]?.threads.length).toBe((attempts[0]?.threads.length ?? 0) + 1);
  });

  it("gives up once every seed runs out of rounds, naming the squares still in trouble", (): void => {
    const rows: readonly string[] = [
      "..........",
      "........BB",
      "....YYY.B.",
      "...YYY....",
      "..........",
    ];
    const generation: Generation = generateLevel(picture(rows), { seeds: 1, roundsPerSeed: 1 });
    expect(generation).toMatchObject({ ok: false, reason: "unsettled" });
    if (generation.ok) return;
    expect(generation.badSquares).toEqual(generation.attempts[0]?.trouble);
    expect(generation.badSquares).not.toEqual([]);
  });

  it("reports a picture that can't be woven", (): void => {
    expect(generateLevel(picture(["RPR..", ".B...", ".....", ".....", "....."]))).toEqual({
      ok: false,
      reason: "unweavable",
      badSquares: [{ x: 1, y: 0 }],
      attempts: [],
    });
  });
});
