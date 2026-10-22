import { onBoard, pegAt, type Peg, type Point, type SquareColour } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { draggedThread, shownThreads } from "./drag.ts";
import type { BoardKey, Msg } from "./messages.ts";
import type { Game, Model } from "./model.ts";
import { isPegTied, isTied } from "./tie.ts";
import { squareToward } from "./update.ts";
import { wovenSquares } from "./weave.ts";

/**
 * What a screen reader announces after a message on the board, or nothing. Read off the models,
 * like the sound cues, plus the message, so a key that changed nothing can still say why.
 */
export function narration(before: Model, after: Model, msg: Msg): string | undefined {
  if (before.screen !== "game" || after.screen !== "game" || before.puzzle !== after.puzzle) {
    return undefined;
  }
  // The win message announces a solve itself.
  if (before.solvedFor === undefined && after.solvedFor !== undefined) return undefined;
  if (msg.type === "BoardKeyPressed") return keyNarration(before, after, msg.key);
  if (msg.type === "PointerReleased" && before.drag) {
    return laidNarration(before, before.drag, after);
  }
  if (after === before) return undefined;
  if (msg.type === "BoardFocused") return describeSquare(after, after.cursor);
  if (msg.type === "UndoPressed") return `Undone. ${pegTally(after)}`;
  if (msg.type === "ClearPressed") return "Board cleared.";
  return undefined;
}

/** Read with the board's instructions whenever it gets focus. */
export function boardSummary(game: Game): string {
  const woven: readonly boolean[] = wovenSquares(game.puzzle, game.threads);
  const coloured: number = game.puzzle.pattern
    .flat()
    .filter((square: SquareColour): boolean => square !== "blank").length;
  return (
    `${String(game.puzzle.width)} by ${String(game.puzzle.height)} board. ${pegTally(game)} ` +
    `${String(woven.filter(Boolean).length)} of ${String(coloured)} coloured squares woven.`
  );
}

/** Rows and columns count from 1 at the top left, as a player would say them. */
export function describeSquare(game: Game, square: Point): string {
  const colour: SquareColour | undefined = game.puzzle.pattern[square.y]?.[square.x];
  const parts: string[] = [`${colour ?? "blank"} square`];
  const shown: readonly Thread[] = shownThreads(game.puzzle, game.threads, game.drag);
  const peg: Peg | undefined = pegAt(game.puzzle, square);
  if (peg) {
    const tied: boolean = isPegTied(game.puzzle, shown, peg);
    parts.push(`${peg.colour} peg ${String(peg.length)}, ${tied ? "tied" : "loose"}`);
  }
  const through: string[] = shown
    .filter((thread: Thread): boolean =>
      thread.squares.some((point: Point): boolean => point.x === square.x && point.y === square.y),
    )
    .map((thread: Thread): string => thread.colour);
  if (through.length > 0) {
    parts.push(`${through.join(" and ")} thread${through.length > 1 ? "s" : ""}`);
  }
  if (wovenSquares(game.puzzle, shown)[square.y * game.puzzle.width + square.x]) {
    parts.push("woven");
  }
  return `Row ${String(square.y + 1)}, column ${String(square.x + 1)}: ${parts.join(", ")}.`;
}

function keyNarration(before: Game, after: Game, key: BoardKey): string | undefined {
  if (!before.cursorShown)
    return after === before ? undefined : describeSquare(after, after.cursor);
  if (after === before) return refusal(before, key);
  if (!before.drag && after.drag) {
    return `Picked up the ${after.drag.colour} thread. ${dragStatus(after, after.drag)}`;
  }
  if (before.drag && !after.drag) {
    return key === "lay" ? laidNarration(before, before.drag, after) : "Thread dropped.";
  }
  const peg: Peg | undefined = pegAt(before.puzzle, before.cursor);
  if (key === "lay" && peg) {
    return laidNarration(before, { colour: peg.colour, squares: [before.cursor] }, after);
  }
  const square: string = describeSquare(after, after.cursor);
  return after.drag ? `${square} ${dragStatus(after, after.drag)}` : square;
}

/** Why a key changed nothing, when there's something to say. */
function refusal(game: Game, key: BoardKey): string | undefined {
  if (key === "lay") {
    if (game.solvedFor !== undefined) return undefined;
    // Pressing a peg marked 1 lays the thread it already has.
    const peg: Peg | undefined = pegAt(game.puzzle, game.cursor);
    if (peg && isPegTied(game.puzzle, game.threads, peg)) return "Already tied.";
    return "No thread to pick up here.";
  }
  if (key === "drop" || key === "shorten") return undefined;
  if (!game.drag || !onBoard(game.puzzle, squareToward(game.cursor, key))) {
    return "Edge of the board.";
  }
  const thread: Thread = draggedThread(game.puzzle, game.threads, game.drag);
  if (isTied(game.puzzle, thread)) return "The thread is tied. Press Enter to lay it.";
  const length: number = fullLength(game, game.drag);
  if (game.drag.squares.length === length) {
    return `The thread is at its full length of ${String(length)}.`;
  }
  return "The thread can't go there.";
}

function laidNarration(before: Game, drag: Thread, after: Game): string {
  const thread: Thread = draggedThread(before.puzzle, before.threads, drag);
  const colour: string = capitalised(thread.colour);
  if (isTied(before.puzzle, thread)) return `${colour} thread tied. ${pegTally(after)}`;
  if (thread.squares.length < 2) return "Nothing laid.";
  return `${colour} thread laid, loose. ${dragStatus(before, thread)}`;
}

/** How far the thread being laid has come, or that it's tied. */
function dragStatus(game: Game, drag: Thread): string {
  const thread: Thread = draggedThread(game.puzzle, game.threads, drag);
  if (isTied(game.puzzle, thread)) return "Tied.";
  return `${String(thread.squares.length)} of ${String(fullLength(game, drag))} squares.`;
}

/** The number on the peg the thread starts from. */
function fullLength(game: Game, drag: Thread): number {
  const first: Point | undefined = drag.squares[0];
  return (first && pegAt(game.puzzle, first)?.length) ?? drag.squares.length;
}

function pegTally(game: Game): string {
  const tied: number = game.puzzle.pegs.filter((peg: Peg): boolean =>
    isPegTied(game.puzzle, game.threads, peg),
  ).length;
  return `${String(tied)} of ${String(game.puzzle.pegs.length)} pegs tied.`;
}

function capitalised(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
