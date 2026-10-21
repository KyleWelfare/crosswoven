import { describe, expect, it } from "vitest";
import { listCandidates, type Candidate, type CandidateList } from "../src/core/candidate-paths.ts";
import type { Puzzle, ThreadColour } from "../src/core/puzzle.ts";
import { decoded, hiddenPuzzleOf, puzzleOf } from "./fixtures/puzzle-of.ts";
import { turningCrossingLevel } from "./fixtures/reference-puzzles.ts";

const blankRow: string = ".....";

/** Red runs down the middle and blue across it; yellow 3s either side of the crossing. */
const crossRows: readonly string[] = ["YYRYY", "YYYYY", "BYPYB", "YYYYY", "YYRYY"];
const crossPegs: readonly (readonly [number, number, number])[] = [
  [2, 0, 7],
  [2, 4, 7],
  [0, 2, 5],
  [4, 2, 5],
  [1, 2, 3],
  [3, 2, 3],
];

function pathsOfColour(puzzle: Puzzle, colour: ThreadColour): (readonly number[])[] {
  const list: CandidateList = listCandidates(puzzle);
  if (!list.ok) throw new Error("expected the pegs to be checkable");
  return list.candidates
    .filter((candidate: Candidate): boolean => candidate.colour === colour)
    .map((candidate: Candidate): readonly number[] => candidate.squares);
}

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

  describe("in a hidden level", (): void => {
    it("runs through squares of any colour", (): void => {
      const rows: readonly string[] = ["RYR..", "YYY..", blankRow, blankRow, blankRow];
      const pegs: readonly (readonly [number, number, number])[] = [
        [0, 0, 3],
        [2, 0, 3],
        [1, 1, 1],
      ];
      expect(pathsOfColour(puzzleOf(rows, pegs), "red")).toEqual([]);
      expect(pathsOfColour(hiddenPuzzleOf(rows, pegs), "red")).toEqual([[0, 1, 2]]);
    });

    it("never enters a blank square", (): void => {
      const puzzle: Puzzle = hiddenPuzzleOf(
        ["R.R..", "YYYY.", blankRow, blankRow, blankRow],
        [
          [0, 0, 5],
          [2, 0, 5],
          [3, 1, 1],
        ],
      );
      expect(pathsOfColour(puzzle, "red")).toEqual([[0, 5, 6, 7, 2]]);
    });

    it("enters a two-colour square only in one of its colours, running straight", (): void => {
      const puzzle: Puzzle = hiddenPuzzleOf(crossRows, crossPegs);
      expect(pathsOfColour(puzzle, "yellow")).toEqual([]);
      const red: readonly (readonly number[])[] = pathsOfColour(puzzle, "red");
      expect(red).toContainEqual([2, 1, 6, 7, 12, 17, 22]);
      const through: readonly (readonly number[])[] = red.filter(
        (squares: readonly number[]): boolean => squares.includes(12),
      );
      expect(through).not.toHaveLength(0);
      for (const squares of through) {
        const at: number = squares.indexOf(12);
        expect((squares[at + 1] ?? 0) - 12).toBe(12 - (squares[at - 1] ?? 0));
      }
    });
  });
});
