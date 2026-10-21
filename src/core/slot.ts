import {
  THREAD_COLOURS,
  squareMask,
  type ColourMask,
  type Puzzle,
  type SquareColour,
  type ThreadColour,
} from "./puzzle.ts";

/**
 * Room for one thread in one square, numbered `square * SLOTS_PER_SQUARE + colour`. A two-colour
 * square has a slot for each of its colours. In a level that shows its picture, every other square
 * has a slot for its own colour; in a hidden one, every square but a wall has one slot that a
 * thread of any colour can fill, numbered as if for red. Squares are numbered `y * width + x`.
 */
export interface Slots {
  readonly width: number;
  readonly height: number;
  /** Colours whose threads may enter each square. */
  readonly entry: Uint8Array;
  /** 1 where two threads cross, one straight across and one straight down. */
  readonly crossing: Uint8Array;
  /** 1 where threads of every colour share one slot. */
  readonly shared: Uint8Array;
  /** Slots that each need exactly one thread. */
  readonly required: readonly number[];
}

export const SLOTS_PER_SQUARE: number = THREAD_COLOURS.length;

const ALL_COLOURS: ColourMask = (1 << THREAD_COLOURS.length) - 1;

export function slotsOf(puzzle: Puzzle): Slots {
  const squares: readonly SquareColour[] = puzzle.pattern.flat();
  const masks: Uint8Array = Uint8Array.from(squares, squareMask);
  const crossing: Uint8Array = masks.map((mask: number): number => (isPair(mask) ? 1 : 0));
  const shared: Uint8Array = masks.map((mask: number): number =>
    puzzle.hidden === true && mask !== 0 && !isPair(mask) ? 1 : 0,
  );
  const entry: Uint8Array = masks.map((mask: number, square: number): number =>
    shared[square] === 1 ? ALL_COLOURS : mask,
  );
  const required: number[] = [];
  masks.forEach((mask: number, square: number): void => {
    if (shared[square] === 1) {
      required.push(square * SLOTS_PER_SQUARE);
      return;
    }
    THREAD_COLOURS.forEach((_colour: ThreadColour, index: number): void => {
      if ((mask & (1 << index)) !== 0) required.push(square * SLOTS_PER_SQUARE + index);
    });
  });
  return { width: puzzle.width, height: puzzle.height, entry, crossing, shared, required };
}

/** The slot a thread of `colour` fills at `square`, whether or not it may enter. */
export function slotOf(slots: Slots, square: number, colour: ThreadColour): number {
  const base: number = square * SLOTS_PER_SQUARE;
  return slots.shared[square] === 1 ? base : base + THREAD_COLOURS.indexOf(colour);
}

export function squareOfSlot(slot: number): number {
  return Math.floor(slot / SLOTS_PER_SQUARE);
}

export function canEnter(slots: Slots, square: number, colour: ThreadColour): boolean {
  return ((slots.entry[square] ?? 0) & (1 << THREAD_COLOURS.indexOf(colour))) !== 0;
}

export function isCrossing(slots: Slots, square: number): boolean {
  return slots.crossing[square] === 1;
}

function isPair(mask: ColourMask): boolean {
  return (mask & (mask - 1)) !== 0;
}
