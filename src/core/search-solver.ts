import {
  THREAD_COLOURS,
  squareMask,
  type ColourMask,
  type Puzzle,
  type ThreadColour,
} from "./puzzle.ts";
import { readThreads, type Solution } from "./thread.ts";

/** Whether a thread continues from a square to its right and lower neighbours. */
interface Link {
  readonly right: boolean;
  readonly down: boolean;
}

const LINKS: readonly Link[] = [
  { right: false, down: false },
  { right: true, down: false },
  { right: false, down: true },
  { right: true, down: true },
];

/**
 * Squares are numbered in reading order, `y * width + x`. Per-colour arrays are indexed
 * `colour * size + square`, where `colour` indexes `THREAD_COLOURS`.
 */
interface Board {
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly masks: Uint8Array;
  readonly colours: readonly (readonly number[])[];
  readonly pegs: Uint8Array;
  readonly right: Uint8Array;
  readonly down: Uint8Array;
  /** Union-find over each colour's links, so a link that would close a loop is caught at once. */
  readonly parent: Int32Array;
  readonly pieceSize: Int32Array;
  /** Roots absorbed by each union, newest last, so backtracking can undo them. */
  readonly merged: number[];
}

/**
 * Backtracking search over squares in reading order. By the time it reaches a square, the links
 * from the left and above are fixed, so it only chooses whether each thread there continues right
 * or down. Stops after `limit` solutions; the validator passes 2 to prove uniqueness.
 */
export function findSolutions(puzzle: Puzzle, limit: number): readonly Solution[] {
  const board: Board = createBoard(puzzle);
  const solutions: Solution[] = [];

  function visit(square: number): void {
    if (solutions.length >= limit) return;
    if (square === board.size) {
      solutions.push(
        readThreads(puzzle, (colour: ThreadColour, a: number, b: number): boolean =>
          isLinked(board, THREAD_COLOURS.indexOf(colour), a, b),
        ),
      );
    } else placeThreads(square, board.colours[square] ?? [], 0);
  }

  function placeThreads(square: number, colours: readonly number[], index: number): void {
    const colour: number | undefined = colours[index];
    if (colour === undefined) {
      visit(square + 1);
      return;
    }
    for (const link of LINKS) {
      if (!fits(board, square, colour, link)) continue;
      if (index === 1 && link.right === hasRightLink(board, colours[0] ?? colour, square)) {
        continue; // Crossing threads must run perpendicular.
      }
      const mark: number = board.merged.length;
      if (connect(board, square, colour, link)) placeThreads(square, colours, index + 1);
      disconnect(board, square, colour, mark);
    }
  }

  visit(0);
  return solutions;
}

function createBoard(puzzle: Puzzle): Board {
  const width: number = puzzle.width;
  const size: number = width * puzzle.height;
  const masks: Uint8Array = Uint8Array.from(puzzle.pattern.flat(), squareMask);
  const pegs: Uint8Array = new Uint8Array(size);
  for (const peg of puzzle.pegs) pegs[peg.y * width + peg.x] = 1;
  const slots: number = size * THREAD_COLOURS.length;
  return {
    width,
    height: puzzle.height,
    size,
    masks,
    colours: Array.from(masks, coloursIn),
    pegs,
    right: new Uint8Array(slots),
    down: new Uint8Array(slots),
    parent: Int32Array.from(new Int32Array(slots).keys()),
    pieceSize: new Int32Array(slots).fill(1),
    merged: [],
  };
}

function coloursIn(mask: ColourMask): readonly number[] {
  return [...THREAD_COLOURS.keys()].filter(
    (colour: number): boolean => (mask & (1 << colour)) !== 0,
  );
}

function fits(board: Board, square: number, colour: number, link: Link): boolean {
  const x: number = square % board.width;
  const y: number = Math.floor(square / board.width);
  const bit: ColourMask = 1 << colour;
  if (link.right && (x + 1 === board.width || !hasColour(board, square + 1, bit))) return false;
  if (link.down && (y + 1 === board.height || !hasColour(board, square + board.width, bit))) {
    return false;
  }

  const fromLeft: boolean = x > 0 && hasRightLink(board, colour, square - 1);
  const fromAbove: boolean = y > 0 && hasDownLink(board, colour, square - board.width);
  const linkCount: number = [fromLeft, fromAbove, link.right, link.down].filter(Boolean).length;
  if (linkCount !== (board.pegs[square] === 1 ? 1 : 2)) return false;

  const crossing: boolean = (board.colours[square]?.length ?? 0) === 2;
  return !crossing || (fromLeft && link.right) || (fromAbove && link.down);
}

function hasColour(board: Board, square: number, bit: ColourMask): boolean {
  return ((board.masks[square] ?? 0) & bit) !== 0;
}

function hasRightLink(board: Board, colour: number, square: number): boolean {
  return board.right[colour * board.size + square] === 1;
}

function hasDownLink(board: Board, colour: number, square: number): boolean {
  return board.down[colour * board.size + square] === 1;
}

/** Returns false if a link would close a loop. */
function connect(board: Board, square: number, colour: number, link: Link): boolean {
  const slot: number = colour * board.size + square;
  if (link.right) {
    board.right[slot] = 1;
    if (!union(board, slot, slot + 1)) return false;
  }
  if (link.down) {
    board.down[slot] = 1;
    if (!union(board, slot, slot + board.width)) return false;
  }
  return true;
}

function disconnect(board: Board, square: number, colour: number, mark: number): void {
  const slot: number = colour * board.size + square;
  board.right[slot] = 0;
  board.down[slot] = 0;
  while (board.merged.length > mark) {
    const child: number = board.merged.pop() ?? 0;
    const root: number = valueAt(board.parent, child);
    board.pieceSize[root] = valueAt(board.pieceSize, root) - valueAt(board.pieceSize, child);
    board.parent[child] = child;
  }
}

/** No path compression, so a union can be undone by resetting one parent. */
function union(board: Board, a: number, b: number): boolean {
  let root: number = find(board, a);
  let child: number = find(board, b);
  if (root === child) return false;
  if (valueAt(board.pieceSize, root) < valueAt(board.pieceSize, child)) {
    [root, child] = [child, root];
  }
  board.parent[child] = root;
  board.pieceSize[root] = valueAt(board.pieceSize, root) + valueAt(board.pieceSize, child);
  board.merged.push(child);
  return true;
}

function find(board: Board, slot: number): number {
  let current: number = slot;
  while (valueAt(board.parent, current) !== current) current = valueAt(board.parent, current);
  return current;
}

/** Neighbouring squares only: the lower-numbered one owns the link. */
function isLinked(board: Board, colour: number, a: number, b: number): boolean {
  const first: number = Math.min(a, b);
  return Math.abs(a - b) === 1
    ? hasRightLink(board, colour, first)
    : hasDownLink(board, colour, first);
}

/** Typed-array reads are typed `number | undefined` under noUncheckedIndexedAccess. */
function valueAt(array: Int32Array, index: number): number {
  const value: number | undefined = array[index];
  if (value === undefined) throw new RangeError(`index ${String(index)} is out of bounds`);
  return value;
}
