import { describe, expect, it } from "vitest";
import { decodeLevel, type DecodeResult } from "../src/core/level-decoder.ts";
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
      expect(puzzle.pegs[0]).toEqual({ x: 2, y: 0, colour: "red" });
      expect(puzzle.pegs[2]).toEqual({ x: 4, y: 1, colour: "blue" });
    });

    it("decodes every pattern code", (): void => {
      const puzzle: Puzzle = decoded(
        withFields({
          pattern: ["R.B.Y", "POG..", blankRow, blankRow, "R.B.Y"],
          pegs: [
            { x: 0, y: 0 },
            { x: 0, y: 4 },
            { x: 2, y: 0 },
            { x: 2, y: 4 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
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
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        }),
      );
      expect(puzzle.width).toBe(5);
      expect(puzzle.height).toBe(15);
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
      expect(errorsFor(withFields({ version: 2 }))).toEqual(["unsupported version 2; expected 1"]);
      expect(errorsFor(withFields({ version: "1" }))).toEqual([
        `unsupported version "1"; expected 1`,
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

    it("rejects pegs that aren't an array of integer points", (): void => {
      expect(errorsFor(withFields({ pegs: {} }))).toEqual([`"pegs" must be an array`]);
      expect(
        errorsFor(
          withFields({
            pegs: [{ x: 1, y: 1 }, { x: 1.5, y: 0 }, { x: 2 }, "a"],
          }),
        ),
      ).toEqual([
        `peg 1 must be an object with integer "x" and "y"`,
        `peg 2 must be an object with integer "x" and "y"`,
        `peg 3 must be an object with integer "x" and "y"`,
      ]);
    });

    it("reports every field error at once", (): void => {
      expect(errorsFor({ version: 1, id: "x" })).toEqual([
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
      expect(errorsFor(withFields({ pegs: [...examplePuzzle.pegs, { x: 5, y: 2 }] }))).toEqual([
        "peg 8 at (5, 2) is outside the grid",
      ]);
      expect(errorsFor(withFields({ pegs: [{ x: -1, y: 0 }, ...examplePuzzle.pegs] }))).toEqual([
        "peg 0 at (-1, 0) is outside the grid",
      ]);
    });

    it("rejects a peg on a blank square", (): void => {
      expect(errorsFor(withFields({ pegs: [...examplePuzzle.pegs, { x: 0, y: 0 }] }))).toEqual([
        "peg 8 at (0, 0) is on a blank square",
      ]);
    });

    it("rejects a peg on a purple square", (): void => {
      expect(errorsFor(withFields({ pegs: [...examplePuzzle.pegs, { x: 1, y: 2 }] }))).toEqual([
        "peg 8 at (1, 2) is on a purple square",
      ]);
    });

    it("rejects a duplicated peg, naming the first one", (): void => {
      expect(errorsFor(withFields({ pegs: [...examplePuzzle.pegs, { x: 4, y: 1 }] }))).toEqual([
        "peg 8 at (4, 1) is a duplicate of peg 2",
      ]);
    });

    it("rejects an odd number of pegs of a colour", (): void => {
      expect(errorsFor(withFields({ pegs: examplePuzzle.pegs.slice(1) }))).toEqual([
        "there are 3 red pegs; each colour needs an even number",
      ]);
    });

    it("rejects a colour in the pattern with no pegs", (): void => {
      expect(
        errorsFor(
          withFields({
            pattern: ["RR...", blankRow, "..G..", blankRow, blankRow],
            pegs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
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
