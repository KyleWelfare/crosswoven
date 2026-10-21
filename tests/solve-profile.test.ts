import { describe, expect, it } from "vitest";
import type { Puzzle } from "../src/core/puzzle.ts";
import { profileSolve } from "../src/core/solve-profile.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";
import { decoded } from "./fixtures/puzzle-of.ts";
import { guessingLevel, onlyReachLevel, sharedLevel } from "./fixtures/reference-puzzles.ts";

describe("profileSolve", (): void => {
  it("counts threads the board gives away as needing no rounds", (): void => {
    expect(profileSolve(decoded(examplePuzzle))).toEqual({
      pegs: 8,
      givenPegs: 8,
      pegsWithRivals: 0,
      pathsPerPeg: 1,
      rounds: 0,
      mediumRounds: 0,
      stepsPerRound: 0,
      difficulty: "easy",
    });
  });

  it("counts pegs that could pair more than one way", (): void => {
    expect(profileSolve(decoded(sharedLevel))).toMatchObject({
      pegs: 4,
      givenPegs: 0,
      pegsWithRivals: 4,
      pathsPerPeg: 4,
    });
  });

  it("counts the rounds of a chain of deductions and which needed medium rules", (): void => {
    expect(profileSolve(decoded(onlyReachLevel))).toMatchObject({
      rounds: 3,
      mediumRounds: 2,
      stepsPerRound: 10 / 3,
      difficulty: "medium",
    });
  });

  it("has nothing to profile on a puzzle that needs guessing", (): void => {
    const puzzle: Puzzle = decoded(guessingLevel);
    expect(profileSolve(puzzle)).toBeUndefined();
  });
});
