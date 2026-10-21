import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  solveAsPlayer,
  solveInRounds,
  solveLogically,
  type LogicResult,
} from "../src/core/logic-solver.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import type { Solution } from "../src/core/thread.ts";
import { allSolutions } from "./fixtures/all-solutions.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { randomWeaves, type Weave } from "./fixtures/random-weave.ts";

const LIMIT: number = 300;

describe("solveLogically properties", (): void => {
  it("agrees with the search solver whenever it finishes", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const puzzle: Puzzle = decoded(weave.level);
        const result: LogicResult = solveLogically(puzzle);
        if (result.status !== "solved") return;
        expect(allSolutions(puzzle, 2)).toEqual([result.solution]);
      }),
    );
  });

  it("only rules out paths that are in no solution", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const puzzle: Puzzle = decoded(weave.level);
        const solutions: readonly Solution[] = allSolutions(puzzle, LIMIT);
        const result: LogicResult = solveLogically(puzzle);
        if (solutions.length === LIMIT || result.status === "too-open") return;
        for (const step of result.steps) {
          for (const solution of solutions) {
            for (const thread of step.ruledOut) expect(solution).not.toContainEqual(thread);
          }
        }
      }),
    );
  });

  it("never reports a contradiction on a puzzle that has a solution", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        expect(solveLogically(decoded(weave.level)).status).not.toBe("contradiction");
      }),
    );
  });

  it("reaches the same verdict solving as a player, so what a player sees is never wrong", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const puzzle: Puzzle = decoded(weave.level);
        const one: LogicResult = solveLogically(puzzle);
        const player: LogicResult = solveAsPlayer(puzzle).result;
        expect(player.status).toBe(one.status);
        if (one.status === "solved" && player.status === "solved") {
          expect(player.solution).toEqual(one.solution);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("reaches the same verdict solving in rounds", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const puzzle: Puzzle = decoded(weave.level);
        const one: LogicResult = solveLogically(puzzle);
        const rounds: LogicResult = solveInRounds(puzzle).result;
        expect(rounds.status).toBe(one.status);
        if (one.status === "solved" && rounds.status === "solved") {
          expect(rounds.solution).toEqual(one.solution);
          expect(rounds.difficulty).toBe(one.difficulty);
        }
      }),
    );
  });
});
