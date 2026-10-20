import { describe, expect, it } from "vitest";
import { findSolutions } from "../src/core/search-solver.ts";
import { validateLevel } from "../src/core/validator.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";
import { decoded } from "./fixtures/puzzle-of.ts";
import {
  crossingLevel,
  guessingLevel,
  loopLevel,
  pairingLevel,
  strandLevel,
  turningCrossingLevel,
} from "./fixtures/reference-puzzles.ts";

describe("validateLevel", (): void => {
  it("ships the example puzzle with its one solution", (): void => {
    expect(validateLevel(examplePuzzle)).toEqual({
      ok: true,
      puzzle: decoded(examplePuzzle),
      difficulty: "easy",
      solution: findSolutions(decoded(examplePuzzle), 2)[0],
    });
  });

  it("passes on the decoder's errors for a malformed level", (): void => {
    expect(validateLevel({ ...examplePuzzle, version: 2 })).toEqual({
      ok: false,
      rejection: "invalid",
      errors: ["unsupported version 2; expected 1"],
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

  it("rejects a unique puzzle that needs guessing", (): void => {
    expect(validateLevel(guessingLevel)).toMatchObject({
      ok: false,
      rejection: "needs-guessing",
    });
  });

  it("rates each shipped puzzle by the hardest rule it needs", (): void => {
    expect(validateLevel(crossingLevel)).toMatchObject({ ok: true, difficulty: "easy" });
    expect(validateLevel(loopLevel)).toMatchObject({ ok: true, difficulty: "medium" });
    expect(validateLevel(strandLevel)).toMatchObject({ ok: true, difficulty: "medium" });
  });
});
