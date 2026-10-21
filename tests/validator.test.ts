import { describe, expect, it, vi } from "vitest";
import type * as LogicSolver from "../src/core/logic-solver.ts";
import { solveLogically } from "../src/core/logic-solver.ts";
import type { Peg } from "../src/core/puzzle.ts";
import { validateLevel } from "../src/core/validator.ts";
import { allSolutions } from "./fixtures/all-solutions.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";
import { decoded } from "./fixtures/puzzle-of.ts";
import {
  guessingLevel,
  loneCrossingLevel,
  openLevel,
  pairingLevel,
  partnerLevel,
  sharedLevel,
  turningCrossingLevel,
} from "./fixtures/reference-puzzles.ts";

// The real solver throughout, except where a test fakes a solver bug with mockReturnValueOnce.
vi.mock(
  import("../src/core/logic-solver.ts"),
  async (importOriginal: () => Promise<typeof LogicSolver>): Promise<typeof LogicSolver> => {
    const actual: typeof LogicSolver = await importOriginal();
    return { ...actual, solveLogically: vi.fn(actual.solveLogically) };
  },
);

describe("validateLevel", (): void => {
  it("ships the example puzzle with its one solution", (): void => {
    expect(validateLevel(examplePuzzle)).toEqual({
      ok: true,
      puzzle: decoded(examplePuzzle),
      difficulty: "easy",
      solution: allSolutions(decoded(examplePuzzle), 2)[0],
    });
  });

  it("passes on the decoder's errors for a malformed level", (): void => {
    expect(validateLevel({ ...examplePuzzle, version: 1 })).toEqual({
      ok: false,
      rejection: "invalid",
      errors: ["unsupported version 1; expected 2"],
    });
  });

  it("rejects a puzzle too open to check, naming the pegs", (): void => {
    expect(validateLevel(openLevel)).toEqual({
      ok: false,
      rejection: "too-open",
      errors: ["the red pegs at (0, 0) and (14, 14) have more than 100000 possible paths"],
    });
  });

  it("rejects a puzzle with no solution", (): void => {
    expect(validateLevel(turningCrossingLevel)).toMatchObject({
      ok: false,
      rejection: "unsolvable",
    });
  });

  it("rejects a puzzle with two solutions", (): void => {
    expect(validateLevel(pairingLevel)).toMatchObject({ ok: false, rejection: "not-unique" });
  });

  it("rejects a hidden level that only showing its picture made unique", (): void => {
    expect(validateLevel(loneCrossingLevel)).toMatchObject({ ok: true });
    expect(validateLevel({ ...loneCrossingLevel, hidden: true })).toMatchObject({
      ok: false,
      rejection: "not-unique",
    });
  });

  it("rejects a unique puzzle that needs guessing", (): void => {
    expect(validateLevel(guessingLevel)).toMatchObject({
      ok: false,
      rejection: "needs-guessing",
    });
  });

  it("rates a puzzle by the hardest rule it needs", (): void => {
    expect(validateLevel(partnerLevel)).toMatchObject({ ok: true, difficulty: "easy" });
    expect(validateLevel(sharedLevel)).toMatchObject({ ok: true, difficulty: "medium" });
  });

  it("throws when the logic solver finds a contradiction in a solvable puzzle", (): void => {
    vi.mocked(solveLogically).mockReturnValueOnce({ status: "contradiction", steps: [] });
    expect((): unknown => validateLevel(partnerLevel)).toThrow("found a contradiction");
  });

  it("throws when only the logic solver finds a puzzle too open", (): void => {
    const peg: Peg = { x: 1, y: 0, colour: "blue", length: 2 };
    vi.mocked(solveLogically).mockReturnValueOnce({ status: "too-open", pegs: [peg, peg] });
    expect((): unknown => validateLevel(partnerLevel)).toThrow("too open");
  });

  it("throws when the solvers reach different solutions", (): void => {
    vi.mocked(solveLogically).mockReturnValueOnce({
      status: "solved",
      steps: [],
      difficulty: "easy",
      solution: [],
    });
    expect((): unknown => validateLevel(partnerLevel)).toThrow("solvers disagree");
  });
});
