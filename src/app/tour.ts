import type { Difficulty, Rule } from "../core/logic-solver.ts";
import type { PipelineRecord, RecordedLaying, RecordedRound } from "../core/pipeline-record.ts";
import type { Point, Puzzle } from "../core/puzzle.ts";
import { threadKey, type Thread } from "../core/thread.ts";

/** Who does the work on a step, named on the timeline so the two solvers read as separate. */
export type Actor = "picture" | "generator" | "search" | "logic" | "validator";

/**
 * What a step animates, as data. The view loops each one: the picture painting in, threads
 * growing out of their pegs, one solution unweaving into another, a thread splitting, the search
 * flickering through every path, a round of deduction, the picture revealed.
 */
export type Scene =
  | { readonly kind: "paint"; readonly puzzle: Puzzle; readonly threads: readonly Thread[] }
  | { readonly kind: "lay"; readonly puzzle: Puzzle; readonly threads: readonly Thread[] }
  | {
      readonly kind: "compare";
      readonly puzzle: Puzzle;
      /** Threads both solutions share, then the ones only each has. */
      readonly shared: readonly Thread[];
      readonly onlyFirst: readonly Thread[];
      readonly onlySecond: readonly Thread[];
      /** Where the two solutions differ. */
      readonly differ: readonly Point[];
    }
  | {
      readonly kind: "split";
      readonly before: Puzzle;
      readonly after: Puzzle;
      /** Threads both layings share. */
      readonly kept: readonly Thread[];
      readonly cut: readonly Thread[];
      readonly pieces: readonly Thread[];
    }
  | {
      readonly kind: "search";
      readonly puzzle: Puzzle;
      readonly candidates: readonly Thread[];
      readonly solution: readonly Thread[];
    }
  | {
      readonly kind: "deduce";
      readonly puzzle: Puzzle;
      /** Threads settled before this step. */
      readonly known: readonly Thread[];
      readonly ruledOut: readonly Thread[];
      readonly settled: readonly Thread[];
    }
  | { readonly kind: "reveal"; readonly puzzle: Puzzle; readonly threads: readonly Thread[] };

/** One step of How the Puzzles Are Made and its entry on the timeline. */
export interface TourFrame {
  readonly actor: Actor;
  readonly heading: string;
  readonly caption: string;
  readonly scene: Scene;
}

const ruleReasons: Readonly<Record<Rule, string>> = {
  partner: "a peg can reach only one matching number",
  "only-path": "a thread has one path left",
  shared: "squares every path of a peg uses are closed to other threads",
  "only-reach": "a square only one peg can reach must be on its thread",
};

const difficultyNames: Readonly<Record<Difficulty, string>> = { easy: "Easy", medium: "Medium" };

/** The picture, each laying the generator tried, the solve round by round, then the verdict. */
export function tourFrames(record: PipelineRecord): readonly TourFrame[] {
  const accepted: RecordedLaying | undefined = record.layings.at(-1);
  if (!accepted || accepted.outcome !== "accepted") {
    throw new Error("the record has no accepted laying");
  }
  const puzzle: Puzzle = accepted.puzzle;
  return [
    {
      actor: "picture",
      heading: "Start from a picture",
      caption:
        "Every level starts as a picture. Each square names the threads that pass through it, and an orange square needs a red thread and a yellow one crossing.",
      scene: { kind: "paint", puzzle, threads: record.solution },
    },
    ...record.layings.flatMap((_laying: RecordedLaying, i: number): TourFrame[] =>
      layingFrames(record, i),
    ),
    ...solveFrames(record, puzzle),
    {
      actor: "validator",
      heading: "Certified",
      caption: `Exactly one solution, reached without guessing, and rated ${difficultyNames[record.difficulty]} by the hardest rule it needed. The two solvers agree, so the level ships.`,
      scene: { kind: "reveal", puzzle, threads: record.solution },
    },
  ];
}

function layingFrames(record: PipelineRecord, index: number): TourFrame[] {
  const laying: RecordedLaying | undefined = record.layings[index];
  if (!laying) return [];
  const count: string = `${String(laying.threads.length)} threads and ${String(laying.puzzle.pegs.length)} pegs`;
  const previous: RecordedLaying | undefined = record.layings[index - 1];
  const made: TourFrame = previous
    ? {
        actor: "generator",
        heading: "Split a thread",
        caption: `The generator cuts a thread where the two solutions differed, putting a new peg at each cut end: ${count}.`,
        scene: splitScene(previous, laying),
      }
    : {
        actor: "generator",
        heading: "Lay threads",
        caption: `The generator covers each colour with threads and puts a numbered peg at each end: ${count}.`,
        scene: { kind: "lay", puzzle: laying.puzzle, threads: laying.threads },
      };
  if (laying.outcome === "accepted") {
    return [
      made,
      {
        actor: "search",
        heading: "Exactly one solution",
        caption: `The search solver weighs all ${String(record.candidates.length)} paths these pegs could be joined by. Only one way of choosing them weaves the picture.`,
        scene: {
          kind: "search",
          puzzle: laying.puzzle,
          candidates: record.candidates,
          solution: record.solution,
        },
      },
    ];
  }
  return [
    made,
    {
      actor: "search",
      heading: previous ? "Still two solutions" : "Find a second solution",
      caption: previous
        ? "The search solver still finds a second way to weave these pegs, somewhere else, so the generator goes again."
        : "The search solver looks for every way to weave these pegs and finds two. They differ in the outlined squares, so the puzzle isn't unique yet.",
      scene: compareScene(laying),
    },
  ];
}

/** The logic solver's view: what the board gives away, then each round of deduction. */
function solveFrames(record: PipelineRecord, puzzle: Puzzle): TourFrame[] {
  const given: TourFrame = {
    actor: "logic",
    heading: "Threads with one path",
    caption: `Now the logic solver plays it like a person, with no search allowed. ${plural(record.given.length, "thread has", "threads have")} only one possible path from the start.`,
    scene: { kind: "deduce", puzzle, known: [], ruledOut: [], settled: record.given },
  };
  let known: readonly Thread[] = record.given;
  const rounds: TourFrame[] = record.rounds.map((round: RecordedRound, i: number): TourFrame => {
    const frame: TourFrame = {
      actor: "logic",
      heading: `Deduction, round ${String(i + 1)}`,
      caption: `${capitalised(round.rules.map((rule: Rule): string => ruleReasons[rule]).join(", and "))}. That rules out ${plural(round.ruledOut.length, "path", "paths")} and settles ${plural(round.settled.length, "more thread", "more threads")}.`,
      scene: { kind: "deduce", puzzle, known, ruledOut: round.ruledOut, settled: round.settled },
    };
    known = [...known, ...round.settled];
    return frame;
  });
  return [given, ...rounds];
}

function compareScene(laying: RecordedLaying): Scene {
  const width: number = laying.puzzle.width;
  const second: readonly Thread[] = laying.rival ?? laying.threads;
  const firstKeys: ReadonlySet<string> = keysOf(laying.threads, width);
  const secondKeys: ReadonlySet<string> = keysOf(second, width);
  return {
    kind: "compare",
    puzzle: laying.puzzle,
    shared: laying.threads.filter((thread: Thread): boolean =>
      secondKeys.has(threadKey(thread, width)),
    ),
    onlyFirst: laying.threads.filter(
      (thread: Thread): boolean => !secondKeys.has(threadKey(thread, width)),
    ),
    onlySecond: second.filter(
      (thread: Thread): boolean => !firstKeys.has(threadKey(thread, width)),
    ),
    differ: laying.trouble,
  };
}

/** Splitting replaces one thread with two pieces and leaves the rest alone. */
function splitScene(before: RecordedLaying, after: RecordedLaying): Scene {
  const width: number = after.puzzle.width;
  const beforeKeys: ReadonlySet<string> = keysOf(before.threads, width);
  const afterKeys: ReadonlySet<string> = keysOf(after.threads, width);
  return {
    kind: "split",
    before: before.puzzle,
    after: after.puzzle,
    kept: after.threads.filter((thread: Thread): boolean =>
      beforeKeys.has(threadKey(thread, width)),
    ),
    cut: before.threads.filter(
      (thread: Thread): boolean => !afterKeys.has(threadKey(thread, width)),
    ),
    pieces: after.threads.filter(
      (thread: Thread): boolean => !beforeKeys.has(threadKey(thread, width)),
    ),
  };
}

function keysOf(threads: readonly Thread[], width: number): ReadonlySet<string> {
  return new Set<string>(threads.map((thread: Thread): string => threadKey(thread, width)));
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
