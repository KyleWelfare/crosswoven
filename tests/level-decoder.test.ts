import { describe, expect, it } from "vitest";
import {
  decodeLevel,
  decodePicture,
  encodeLevel,
  type DecodeResult,
} from "../src/core/level-decoder.ts";
import { DEFAULT_LENGTHS } from "../src/core/picture.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

function withFields(fields: Record<string, unknown>): Record<string, unknown> {
  return { ...examplePuzzle, ...fields };
}

function withoutField(field: string): Record<string, unknown> {
  const level: Record<string, unknown> = { ...examplePuzzle };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete level[field];
  return level;
}

function withPeg(index: number, peg: object): Record<string, unknown> {
  const pegs: object[] = [...examplePuzzle.pegs];
  pegs.splice(index, 0, peg);
  return withFields({ pegs });
}

function errorsFor(json: unknown): readonly string[] {
  const result: DecodeResult = decodeLevel(json);
  if (result.ok) throw new Error("expected the level to be rejected");
  return result.errors;
}

function decoded(json: unknown): Puzzle {
  const result: DecodeResult = decodeLevel(json);
  if (!result.ok) throw new Error(`expected the level to decode: ${result.errors.join("; ")}`);
  return result.puzzle;
}

const blankRow: string = ".....";

describe("decodeLevel", (): void => {
  describe("valid levels", (): void => {
    it("decodes the example puzzle", (): void => {
      const puzzle: Puzzle = decoded(examplePuzzle);
      expect(puzzle.id).toBe("lattice");
      expect(puzzle.title).toBe("Lattice");
      expect(puzzle.width).toBe(5);
      expect(puzzle.height).toBe(5);
      expect(puzzle.pattern[1]).toEqual(["blue", "purple", "blue", "purple", "blue"]);
      expect(puzzle.pegs[0]).toEqual({ x: 2, y: 0, colour: "red", length: 6 });
      expect(puzzle.pegs[2]).toEqual({ x: 4, y: 1, colour: "blue", length: 10 });
    });

    it("decodes every pattern code", (): void => {
      const puzzle: Puzzle = decoded(
        withFields({
          pattern: ["R.B.Y", "POG..", blankRow, blankRow, "R.B.Y"],
          pegs: [
            { x: 0, y: 0, length: 5 },
            { x: 0, y: 4, length: 5 },
            { x: 2, y: 0, length: 5 },
            { x: 2, y: 4, length: 5 },
            { x: 4, y: 0, length: 5 },
            { x: 4, y: 4, length: 5 },
          ],
        }),
      );
      expect(puzzle.pattern[0]).toEqual(["red", "blank", "blue", "blank", "yellow"]);
      expect(puzzle.pattern[1]).toEqual(["purple", "orange", "green", "blank", "blank"]);
    });

    it("accepts non-square grids at the size limits", (): void => {
      const pattern: string[] = Array.from({ length: 15 }, (): string => blankRow);
      pattern[0] = "RR...";
      const puzzle: Puzzle = decoded(
        withFields({
          pattern,
          pegs: [
            { x: 0, y: 0, length: 2 },
            { x: 1, y: 0, length: 2 },
          ],
        }),
      );
      expect(puzzle.width).toBe(5);
      expect(puzzle.height).toBe(15);
    });

    it("accepts a length-1 peg without a partner", (): void => {
      const puzzle: Puzzle = decoded(
        withFields({ pegs: [...examplePuzzle.pegs, { x: 1, y: 0, length: 1 }] }),
      );
      expect(puzzle.pegs[8]).toEqual({ x: 1, y: 0, colour: "red", length: 1 });
    });
  });

  describe("fields", (): void => {
    it("rejects input that isn't an object", (): void => {
      expect(errorsFor([])).toEqual(["the level must be a JSON object"]);
      expect(errorsFor(null)).toEqual(["the level must be a JSON object"]);
    });

    it.each(["version", "id", "title", "pattern", "pegs"])(
      "rejects a missing %s",
      (field: string): void => {
        expect(errorsFor(withoutField(field))).toEqual([`missing field "${field}"`]);
      },
    );

    it("rejects an unsupported version", (): void => {
      expect(errorsFor(withFields({ version: 1 }))).toEqual(["unsupported version 1; expected 2"]);
      expect(errorsFor(withFields({ version: "2" }))).toEqual([
        `unsupported version "2"; expected 2`,
      ]);
    });

    it("rejects an empty or non-string id and title", (): void => {
      expect(errorsFor(withFields({ id: "", title: 3 }))).toEqual([
        `"id" must be a non-empty string`,
        `"title" must be a non-empty string`,
      ]);
    });

    it("rejects a pattern that isn't an array of strings", (): void => {
      expect(errorsFor(withFields({ pattern: "R.R" }))).toEqual([
        `"pattern" must be an array of strings`,
      ]);
      expect(errorsFor(withFields({ pattern: [blankRow, 5] }))).toEqual([
        `"pattern" must be an array of strings`,
      ]);
    });

    it("rejects pegs that aren't an array of objects with x, y and length", (): void => {
      expect(errorsFor(withFields({ pegs: {} }))).toEqual([`"pegs" must be an array`]);
      expect(
        errorsFor(
          withFields({
            pegs: [{ x: 1, y: 1, length: 1 }, { x: 1.5, y: 0 }, { x: 2 }, "a"],
          }),
        ),
      ).toEqual([
        `peg 1 must be an object with integer "x" and "y" and a whole-number "length" from 1 up`,
        `peg 2 must be an object with integer "x" and "y" and a whole-number "length" from 1 up`,
        `peg 3 must be an object with integer "x" and "y" and a whole-number "length" from 1 up`,
      ]);
    });

    it("rejects a missing or invalid length, naming the peg", (): void => {
      expect(
        errorsFor(
          withFields({
            pegs: [
              { x: 2, y: 0 },
              { x: 3, y: 0, length: 0 },
              { x: 4, y: 1, length: 1.5 },
              { x: 4, y: 2, length: "3" },
              { x: 2, y: 3, length: -1 },
            ],
          }),
        ),
      ).toEqual([
        `peg 0 at (2, 0) is missing "length"`,
        "peg 1 at (3, 0) has length 0; it must be a whole number from 1 up",
        "peg 2 at (4, 1) has length 1.5; it must be a whole number from 1 up",
        `peg 3 at (4, 2) has length "3"; it must be a whole number from 1 up`,
        "peg 4 at (2, 3) has length -1; it must be a whole number from 1 up",
      ]);
    });

    it("reports every field error at once", (): void => {
      expect(errorsFor({ version: 2, id: "x" })).toEqual([
        `missing field "title"`,
        `missing field "pattern"`,
        `missing field "pegs"`,
      ]);
    });
  });

  describe("grid", (): void => {
    it("rejects too few or too many rows", (): void => {
      expect(errorsFor(withFields({ pattern: [blankRow, blankRow, blankRow, blankRow] }))).toEqual([
        "the pattern has 4 rows; it needs 5 to 15",
      ]);
      const tall: string[] = Array.from({ length: 16 }, (): string => blankRow);
      expect(errorsFor(withFields({ pattern: tall, pegs: [] }))).toEqual([
        "the pattern has 16 rows; it needs 5 to 15",
      ]);
    });

    it("rejects rows that are too narrow or too wide", (): void => {
      const narrow: string[] = Array.from({ length: 5 }, (): string => "....");
      expect(errorsFor(withFields({ pattern: narrow }))).toEqual([
        "row 0 has 4 squares; rows need 5 to 15",
      ]);
      const wide: string[] = Array.from({ length: 5 }, (): string => ".".repeat(16));
      expect(errorsFor(withFields({ pattern: wide, pegs: [] }))).toEqual([
        "row 0 has 16 squares; rows need 5 to 15",
      ]);
    });

    it("rejects ragged rows", (): void => {
      expect(
        errorsFor(withFields({ pattern: [blankRow, blankRow, "......", blankRow, "...."] })),
      ).toEqual(["row 2 has 6 squares; row 0 has 5", "row 4 has 4 squares; row 0 has 5"]);
    });

    it("rejects unknown pattern codes, naming the square", (): void => {
      expect(
        errorsFor(withFields({ pattern: [".RRR.", "BPBXB", "BPBPB", "BPBRR", "Br.RR"] })),
      ).toEqual([`unknown pattern code "X" at (3, 1)`, `unknown pattern code "r" at (1, 4)`]);
    });
  });

  describe("pegs", (): void => {
    it("rejects a peg outside the grid", (): void => {
      expect(errorsFor(withPeg(examplePuzzle.pegs.length, { x: 5, y: 2, length: 1 }))).toEqual([
        "peg 8 at (5, 2) is outside the grid",
      ]);
      expect(errorsFor(withPeg(0, { x: -1, y: 0, length: 1 }))).toEqual([
        "peg 0 at (-1, 0) is outside the grid",
      ]);
    });

    it("rejects a peg on a blank square", (): void => {
      expect(errorsFor(withPeg(examplePuzzle.pegs.length, { x: 0, y: 0, length: 1 }))).toEqual([
        "peg 8 at (0, 0) is on a blank square",
      ]);
    });

    it("rejects a peg on a purple square", (): void => {
      expect(errorsFor(withPeg(examplePuzzle.pegs.length, { x: 1, y: 2, length: 1 }))).toEqual([
        "peg 8 at (1, 2) is on a purple square",
      ]);
    });

    it("rejects a duplicated peg, naming the first one", (): void => {
      expect(errorsFor(withPeg(examplePuzzle.pegs.length, { x: 4, y: 1, length: 10 }))).toEqual([
        "peg 8 at (4, 1) is a duplicate of peg 2",
      ]);
    });

    it("rejects an odd number of pegs of a colour and length", (): void => {
      expect(errorsFor(withFields({ pegs: examplePuzzle.pegs.slice(1) }))).toEqual([
        "red pegs of length 6 can't all pair up (found 1)",
      ]);
    });

    it("pairs by length, not just colour", (): void => {
      const pegs: object[] = [
        { ...examplePuzzle.pegs[0], length: 5 },
        ...examplePuzzle.pegs.slice(1),
      ];
      expect(errorsFor(withFields({ pegs }))).toEqual([
        "red pegs of length 5 can't all pair up (found 1)",
        "red pegs of length 6 can't all pair up (found 1)",
      ]);
    });

    it("rejects a colour in the pattern with no pegs", (): void => {
      expect(
        errorsFor(
          withFields({
            pattern: ["RR...", blankRow, "..G..", blankRow, blankRow],
            pegs: [
              { x: 0, y: 0, length: 2 },
              { x: 1, y: 0, length: 2 },
            ],
          }),
        ),
      ).toEqual([
        "the pattern uses blue but there are no blue pegs",
        "the pattern uses yellow but there are no yellow pegs",
      ]);
    });
  });
});

describe("decodePicture", (): void => {
  it("decodes a level's id, title and pattern, with no version or pegs", (): void => {
    const { id, title, pattern }: typeof examplePuzzle = examplePuzzle;
    expect(decodePicture({ id, title, pattern })).toEqual({
      ok: true,
      picture: {
        id,
        title,
        width: 5,
        height: 5,
        pattern: decoded(examplePuzzle).pattern,
        lengths: DEFAULT_LENGTHS,
      },
    });
  });

  it("takes thread lengths when given", (): void => {
    const { id, title, pattern }: typeof examplePuzzle = examplePuzzle;
    expect(decodePicture({ id, title, pattern, lengths: [3, 7] })).toMatchObject({
      ok: true,
      picture: { lengths: { min: 3, max: 7 } },
    });
  });

  it.each([[[0, 3]], [[5, 2]], [[2]], [[2.5, 4]], ["2-5"]])(
    "rejects lengths %j",
    (lengths: unknown): void => {
      const { id, title, pattern }: typeof examplePuzzle = examplePuzzle;
      expect(decodePicture({ id, title, pattern, lengths })).toEqual({
        ok: false,
        errors: [`"lengths" must be [min, max], whole numbers with 1 <= min <= max`],
      });
    },
  );

  it("takes the same-numbers bias and target rounds when given", (): void => {
    const { id, title, pattern }: typeof examplePuzzle = examplePuzzle;
    expect(decodePicture({ id, title, pattern, sameNumbers: 0.5, targetRounds: 4 })).toMatchObject({
      ok: true,
      picture: { sameNumbers: 0.5, targetRounds: 4 },
    });
  });

  it("rejects a same-numbers bias outside 0 to 1 and a target that isn't a count", (): void => {
    const { id, title, pattern }: typeof examplePuzzle = examplePuzzle;
    expect(decodePicture({ id, title, pattern, sameNumbers: 1.5, targetRounds: -1 })).toEqual({
      ok: false,
      errors: [
        `"sameNumbers" must be a number from 0 to 1`,
        `"targetRounds" must be a whole number from 0 up`,
      ],
    });
    expect(decodePicture({ id, title, pattern, sameNumbers: "high", targetRounds: 2.5 })).toEqual({
      ok: false,
      errors: [
        `"sameNumbers" must be a number from 0 to 1`,
        `"targetRounds" must be a whole number from 0 up`,
      ],
    });
  });

  it("takes a pinned seed, a whole number from 1 up", (): void => {
    const { id, title, pattern }: typeof examplePuzzle = examplePuzzle;
    expect(decodePicture({ id, title, pattern, seed: 65 })).toMatchObject({
      ok: true,
      picture: { seed: 65 },
    });
    for (const seed of [0, 1.5, "65"]) {
      expect(decodePicture({ id, title, pattern, seed })).toEqual({
        ok: false,
        errors: [`"seed" must be a whole number from 1 up`],
      });
    }
  });

  it("rejects bad fields the way levels do", (): void => {
    expect(decodePicture({ id: "", pattern: ["...."] })).toEqual({
      ok: false,
      errors: [
        `"id" must be a non-empty string`,
        `missing field "title"`,
        "the pattern has 1 rows; it needs 5 to 15",
        "row 0 has 4 squares; rows need 5 to 15",
      ],
    });
  });
});

describe("encodeLevel", (): void => {
  it("writes a puzzle back as the JSON it decodes from", (): void => {
    expect(encodeLevel(decoded(examplePuzzle))).toEqual(examplePuzzle);
  });
});
