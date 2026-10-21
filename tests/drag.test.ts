import { describe, expect, it } from "vitest";
import {
  draggedThread,
  dragTo,
  releasedThreads,
  shownThreads,
  startDrag,
} from "../src/app/drag.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
import { threadOf } from "./fixtures/thread-of.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

// Red pegs at (2, 0) and (1, 4) marked 6, (3, 0) and (3, 4) marked 7. Blue pegs at (4, 1),
// (4, 2), (2, 3) and (0, 4).
const lattice: Puzzle = decoded(examplePuzzle);
const tiedRed: Thread = threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]);
const blueAcross: Thread = threadOf("blue", [4, 1], [3, 1], [2, 1], [1, 1], [0, 1]);
// Laid from the far 6, and a drag from the near 6 that has reached its loose end. Together they
// make tiedRed.
const fromBelow: Thread = threadOf("red", [1, 4], [1, 3], [1, 2]);
const joining: Thread = threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2]);

describe("startDrag", (): void => {
  it("starts a thread on a peg", (): void => {
    expect(startDrag(lattice, [], { x: 2, y: 0 })).toEqual(threadOf("red", [2, 0]));
  });

  it("starts a tied peg's thread afresh", (): void => {
    expect(startDrag(lattice, [tiedRed], { x: 1, y: 4 })).toEqual(threadOf("red", [1, 4]));
  });

  it("starts nothing on a square with no peg or thread", (): void => {
    expect(startDrag(lattice, [tiedRed], { x: 0, y: 0 })).toBeUndefined();
  });

  it("picks a laid thread up at the pressed square, keeping the part back to its first peg", (): void => {
    expect(startDrag(lattice, [tiedRed], { x: 1, y: 2 })).toEqual(
      threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2]),
    );
  });

  it("picks up the thread laid last where two cross", (): void => {
    expect(startDrag(lattice, [tiedRed, blueAcross], { x: 1, y: 1 })).toEqual(
      threadOf("blue", [4, 1], [3, 1], [2, 1], [1, 1]),
    );
    expect(startDrag(lattice, [blueAcross, tiedRed], { x: 1, y: 1 })).toEqual(
      threadOf("red", [2, 0], [1, 0], [1, 1]),
    );
  });
});

describe("dragTo", (): void => {
  it("extends the thread onto a neighbouring square of any colour", (): void => {
    expect(dragTo(lattice, [], threadOf("red", [2, 0]), { x: 2, y: 1 })).toEqual(
      threadOf("red", [2, 0], [2, 1]),
    );
  });

  it("fills in squares a fast pointer skipped, along the longer axis first", (): void => {
    expect(dragTo(lattice, [], threadOf("red", [2, 0]), { x: 1, y: 2 })).toEqual(
      threadOf("red", [2, 0], [2, 1], [1, 1], [1, 2]),
    );
  });

  it("takes steps off when the pointer moves back along the thread", (): void => {
    const drag: Thread = threadOf("red", [2, 0], [2, 1], [2, 2]);
    expect(dragTo(lattice, [], drag, { x: 2, y: 1 })).toEqual(threadOf("red", [2, 0], [2, 1]));
    expect(dragTo(lattice, [], drag, { x: 2, y: 0 })).toEqual(threadOf("red", [2, 0]));
  });

  it("ties at a peg of its colour and number once all of its length is used", (): void => {
    const turned: Thread = dragTo(lattice, [], threadOf("red", [2, 0]), { x: 1, y: 0 });
    expect(dragTo(lattice, [], turned, { x: 1, y: 4 })).toEqual(tiedRed);
  });

  it("is blocked by a peg of its colour with another number", (): void => {
    const drag: Thread = threadOf("red", [2, 0]);
    expect(dragTo(lattice, [], drag, { x: 3, y: 0 })).toBe(drag);
  });

  it("is blocked by a matching peg it would reach short of its length", (): void => {
    const drag: Thread = threadOf("blue", [4, 1]);
    expect(dragTo(lattice, [], drag, { x: 4, y: 2 })).toBe(drag);
  });

  it("is blocked by a peg of another colour", (): void => {
    const drag: Thread = threadOf("red", [2, 0], [2, 1], [2, 2]);
    expect(dragTo(lattice, [], drag, { x: 2, y: 3 })).toBe(drag);
    expect(dragTo(lattice, [], drag, { x: 2, y: 4 })).toBe(drag);
  });

  it("can't grow past its peg's number", (): void => {
    const drag: Thread = threadOf("blue", [2, 3], [1, 3], [1, 2], [1, 1]);
    expect(dragTo(lattice, [], drag, { x: 1, y: 0 })).toBe(drag);
  });

  it("stops at a blank square", (): void => {
    expect(dragTo(lattice, [], threadOf("red", [2, 0]), { x: 0, y: 0 })).toEqual(
      threadOf("red", [2, 0], [1, 0]),
    );
  });

  it("ignores a pointer off the board", (): void => {
    const drag: Thread = threadOf("red", [2, 0]);
    expect(dragTo(lattice, [], drag, { x: 2, y: -1 })).toBe(drag);
  });

  it("crosses threads of other colours", (): void => {
    expect(dragTo(lattice, [blueAcross], threadOf("red", [2, 0]), { x: 2, y: 1 })).toEqual(
      threadOf("red", [2, 0], [2, 1]),
    );
  });

  it("is blocked by another thread of its colour", (): void => {
    const laid: Thread = threadOf("red", [3, 0], [3, 1], [2, 1], [1, 1], [1, 2]);
    const drag: Thread = threadOf("red", [2, 0]);
    expect(dragTo(lattice, [laid], drag, { x: 2, y: 1 })).toBe(drag);
  });

  it("steps onto the loose end of a matching thread when the lengths add up", (): void => {
    const drag: Thread = threadOf("red", [2, 0], [1, 0], [1, 1]);
    expect(dragTo(lattice, [fromBelow], drag, { x: 1, y: 2 })).toEqual(joining);
  });

  it("goes no further once joined", (): void => {
    expect(dragTo(lattice, [fromBelow], joining, { x: 2, y: 2 })).toBe(joining);
  });

  it("is blocked by the loose end of a matching thread when the lengths don't add up", (): void => {
    const drag: Thread = threadOf("red", [2, 0], [2, 1], [3, 1], [3, 2], [2, 2]);
    expect(dragTo(lattice, [fromBelow], drag, { x: 1, y: 2 })).toBe(drag);
  });

  it("is blocked by the loose end of a thread from a peg with another number", (): void => {
    const fromSeven: Thread = threadOf("red", [3, 0], [3, 1], [2, 1]);
    const drag: Thread = threadOf("red", [2, 0]);
    expect(dragTo(lattice, [fromSeven], drag, { x: 2, y: 1 })).toBe(drag);
  });
});

describe("draggedThread", (): void => {
  it("is the drag itself until it joins another thread", (): void => {
    const drag: Thread = threadOf("red", [2, 0], [1, 0], [1, 1]);
    expect(draggedThread(lattice, [fromBelow], drag)).toBe(drag);
  });

  it("joins the drag and the thread whose loose end it reached into one tied thread", (): void => {
    expect(draggedThread(lattice, [fromBelow], joining)).toEqual(tiedRed);
  });
});

describe("shownThreads", (): void => {
  it("shows the drag in place of the thread laid from its peg", (): void => {
    const drag: Thread = threadOf("red", [2, 0]);
    expect(shownThreads(lattice, [threadOf("red", [2, 0], [1, 0]), blueAcross], drag)).toEqual([
      blueAcross,
      drag,
    ]);
  });

  it("shows the drag in place of a tied thread it started from the far end of", (): void => {
    const drag: Thread = threadOf("red", [1, 4]);
    expect(shownThreads(lattice, [tiedRed], drag)).toEqual([drag]);
  });

  it("shows the drag in place of the thread at the peg it reached", (): void => {
    const strayFromBelow: Thread = threadOf("red", [1, 4], [1, 3], [0, 3]);
    expect(shownThreads(lattice, [strayFromBelow], tiedRed)).toEqual([tiedRed]);
  });

  it("shows a joined thread in place of the thread it joined", (): void => {
    expect(shownThreads(lattice, [fromBelow, blueAcross], joining)).toEqual([blueAcross, tiedRed]);
  });
});

describe("releasedThreads", (): void => {
  it("lays the drag, even short of a peg", (): void => {
    const drag: Thread = threadOf("red", [2, 0], [2, 1]);
    expect(releasedThreads(lattice, [blueAcross], drag)).toEqual([blueAcross, drag]);
  });

  it("lays a joined thread as one", (): void => {
    expect(releasedThreads(lattice, [fromBelow], joining)).toEqual([tiedRed]);
  });

  it("lays nothing for a press that never left its peg, and clears the thread there", (): void => {
    expect(releasedThreads(lattice, [tiedRed], threadOf("red", [2, 0]))).toEqual([]);
  });

  it("lays a whole thread for a press on a peg marked 1", (): void => {
    const single: Puzzle = puzzleOf(["R....", ".....", ".....", ".....", "....."], [[0, 0, 1]]);
    expect(releasedThreads(single, [], threadOf("red", [0, 0]))).toEqual([threadOf("red", [0, 0])]);
  });
});
