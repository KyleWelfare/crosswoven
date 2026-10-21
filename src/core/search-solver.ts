import {
  listCandidates,
  solutionOf,
  type Candidate,
  type CandidateList,
  type TooOpen,
} from "./candidate-paths.ts";
import { THREAD_COLOURS, threadsThrough, type Puzzle, type SquareColour } from "./puzzle.ts";
import type { Solution } from "./thread.ts";

export type SearchResult = { readonly ok: true; readonly solutions: readonly Solution[] } | TooOpen;

/**
 * Rows are candidate paths. Crossing threads need no column to keep them perpendicular: candidates
 * run straight through crossings, so two running the same way would share every square to the edge
 * of the grid.
 */
interface Cover {
  readonly columnsOf: readonly (readonly number[])[];
  readonly rowsIn: readonly (readonly number[])[];
  /** Columns covered exactly once: every peg, and each colour each square asks for. */
  readonly required: readonly number[];
  readonly covered: Uint8Array;
  /** Chosen rows that clash with each row. A row is still an option at 0. */
  readonly clashes: Int32Array;
  /** Rows still an option in each column. */
  readonly options: Int32Array;
}

/**
 * Exact cover by Knuth's Algorithm X: cover the column with the fewest options left, trying each
 * of its rows in turn. Stops after `limit` solutions; the validator passes 2 to prove uniqueness.
 */
export function findSolutions(puzzle: Puzzle, limit: number): SearchResult {
  const list: CandidateList = listCandidates(puzzle);
  if (!list.ok) return list;
  const candidates: readonly Candidate[] = list.candidates;
  const cover: Cover = createCover(puzzle, candidates);
  const chosen: Candidate[] = [];
  const solutions: Solution[] = [];

  function search(): void {
    if (solutions.length >= limit) return;
    const column: number | undefined = mostConstrained(cover);
    if (column === undefined) {
      solutions.push(solutionOf(puzzle.width, chosen));
      return;
    }
    for (const row of cover.rowsIn[column] ?? []) {
      const candidate: Candidate | undefined = candidates[row];
      if (!candidate || cover.clashes[row] !== 0) continue;
      chosen.push(candidate);
      choose(cover, row, 1);
      search();
      choose(cover, row, -1);
      chosen.pop();
      if (solutions.length >= limit) return;
    }
  }

  search();
  return { ok: true, solutions };
}

function createCover(puzzle: Puzzle, candidates: readonly Candidate[]): Cover {
  const squares: readonly SquareColour[] = puzzle.pattern.flat();
  const pegCount: number = puzzle.pegs.length;
  const colourCount: number = THREAD_COLOURS.length;
  const slot = (square: number, colour: number): number => pegCount + square * colourCount + colour;
  const columnCount: number = pegCount + squares.length * colourCount;

  const required: number[] = [...puzzle.pegs.keys()];
  squares.forEach((square: SquareColour, index: number): void => {
    for (const colour of threadsThrough(square)) {
      required.push(slot(index, THREAD_COLOURS.indexOf(colour)));
    }
  });

  const columnsOf: readonly (readonly number[])[] = candidates.map(
    (candidate: Candidate): number[] => {
      const colour: number = THREAD_COLOURS.indexOf(candidate.colour);
      const [first, second]: readonly [number, number] = candidate.pegs;
      const columns: number[] = first === second ? [first] : [first, second];
      for (const square of candidate.squares) columns.push(slot(square, colour));
      return columns;
    },
  );
  const rowsIn: number[][] = Array.from({ length: columnCount }, (): number[] => []);
  columnsOf.forEach((columns: readonly number[], row: number): void => {
    for (const column of columns) rowsIn[column]?.push(row);
  });

  return {
    columnsOf,
    rowsIn,
    required,
    covered: new Uint8Array(columnCount),
    clashes: new Int32Array(columnsOf.length),
    options: Int32Array.from(rowsIn, (rows: readonly number[]): number => rows.length),
  };
}

/** Undefined once every required column is covered. */
function mostConstrained(cover: Cover): number | undefined {
  let best: number | undefined;
  let fewest: number = Infinity;
  for (const column of cover.required) {
    if (cover.covered[column] === 1) continue;
    const options: number = cover.options[column] ?? 0;
    if (options < fewest) {
      best = column;
      fewest = options;
      if (options === 0) break;
    }
  }
  return best;
}

/** `change` 1 chooses `row`, -1 takes it back. Counts are order-free, so undoing needs no stack. */
function choose(cover: Cover, row: number, change: 1 | -1): void {
  for (const column of cover.columnsOf[row] ?? []) {
    cover.covered[column] = change === 1 ? 1 : 0;
    for (const other of cover.rowsIn[column] ?? []) {
      const before: number = cover.clashes[other] ?? 0;
      const after: number = before + change;
      cover.clashes[other] = after;
      if (before === 0 || after === 0) {
        for (const otherColumn of cover.columnsOf[other] ?? []) {
          cover.options[otherColumn] = (cover.options[otherColumn] ?? 0) - change;
        }
      }
    }
  }
}
