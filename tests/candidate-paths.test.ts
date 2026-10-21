import { describe, expect, it } from "vitest";
import { listCandidates, type Candidate, type CandidateList } from "../src/core/candidate-paths.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
import { turningCrossingLevel } from "./fixtures/reference-puzzles.ts";

const blankRow: string = ".....";

function pathsOf(puzzle: Puzzle): (readonly number[])[] {
  const list: CandidateList = listCandidates(puzzle);
  if (!list.ok) throw new Error("expected the pegs to be checkable");
  return list.candidates.map((candidate: Candidate): readonly number[] => candidate.squares);
}

describe("listCandidates", (): void => {
  it("lists every path of exactly the peg's length", (): void => {
    const puzzle: Puzzle = puzzleOf(
      ["RRR..", "RRR..", blankRow, blankRow, blankRow],
      [
        [0, 0, 4],
        [0, 1, 4],
      ],
    );
    expect(pathsOf(puzzle)).toEqual([[0, 1, 6, 5]]);
  });

  it("gives a length-1 peg its own square", (): void => {
    const puzzle: Puzzle = puzzleOf(["R....", blankRow, blankRow, blankRow, blankRow], [[0, 0, 1]]);
    expect(pathsOf(puzzle)).toEqual([[0]]);
  });

  it("skips pegs too far apart, or the wrong parity, for their length", (): void => {
    const row: string = "RRRRR";
    expect(
      pathsOf(
        puzzleOf(
          [row, row, row, row, row],
          [
            [0, 0, 4],
            [4, 0, 4],
          ],
        ),
      ),
    ).toEqual([]);
    expect(
      pathsOf(
        puzzleOf(
          [row, row, row, row, row],
          [
            [0, 0, 4],
            [2, 0, 4],
          ],
        ),
      ),
    ).toEqual([]);
  });

  it("never runs through another peg", (): void => {
    const puzzle: Puzzle = puzzleOf(
      ["RRR..", "RRR..", blankRow, blankRow, blankRow],
      [
        [0, 0, 5],
        [2, 0, 5],
        [1, 0, 1],
      ],
    );
    expect(pathsOf(puzzle)).toEqual([[0, 5, 6, 7, 2], [1]]);
  });

  it("only runs straight through a crossing", (): void => {
    expect(pathsOf(decoded(turningCrossingLevel))).toEqual([]);
  });

  it("gives up on a pair with more than the allowed number of paths", (): void => {
    const row: string = "RRRRR";
    const puzzle: Puzzle = puzzleOf(
      [row, row, row, row, row],
      [
        [0, 0, 9],
        [4, 4, 9],
      ],
    );
    expect(listCandidates(puzzle, 69)).toMatchObject({ ok: false });
    expect(listCandidates(puzzle, 70)).toMatchObject({ ok: true });
  });
});
