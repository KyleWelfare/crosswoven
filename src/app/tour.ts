import type { Difficulty, Rule } from "../core/logic-solver.ts";
import type { PipelineRecord, RecordedLaying, RecordedRound } from "../core/pipeline-record.ts";
import type { Point, Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

/** The certificate's checks, in the order the pipeline passes them. */
export type Check = "laid" | "solvable" | "unique" | "deducible" | "rated";

export const CHECKS: readonly Check[] = ["laid", "solvable", "unique", "deducible", "rated"];

export type CheckState = "pending" | "passed" | "failed";

/** One step of How It Works: a board to draw, what it shows, and how far the checks have got. */
export interface TourFrame {
  readonly title: string;
  readonly caption: string;
  readonly puzzle: Puzzle;
  readonly threads: readonly Thread[];
  /** Squares lit up, such as where two solutions differ. */
  readonly highlight: readonly Point[];
  /** Threads and pegs faded back to leave the finished picture. */
  readonly revealed: boolean;
  readonly checks: Readonly<Record<Check, CheckState>>;
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
  if (!accepted || accepted.outcome !== "accepted")
    throw new Error("the record has no accepted laying");
  const puzzle: Puzzle = accepted.puzzle;
  return [
    {
      title: "The picture",
      caption:
        "Every level starts as a picture. Each square names the threads that pass through it, and an orange square needs a red thread and a yellow one crossing.",
      puzzle,
      threads: record.solution,
      highlight: [],
      revealed: true,
      checks: checksUpTo(0),
    },
    ...record.layings.flatMap((laying: RecordedLaying, i: number): TourFrame[] =>
      layingFrames(record, laying, i),
    ),
    ...solveFrames(record, puzzle),
    {
      title: "Certified",
      caption: `One solution, reached without guessing, and rated ${difficultyNames[record.difficulty]} by the hardest rule it needed. Two independent solvers agree, so the level ships.`,
      puzzle,
      threads: record.solution,
      highlight: [],
      revealed: true,
      checks: checksUpTo(CHECKS.length),
    },
  ];
}

function layingFrames(record: PipelineRecord, laying: RecordedLaying, index: number): TourFrame[] {
  const count: string = `${String(laying.threads.length)} threads and ${String(laying.puzzle.pegs.length)} pegs`;
  const laid: TourFrame = {
    title: index === 0 ? "Laying threads" : "Laying again",
    caption:
      index === 0
        ? `The generator covers each colour with threads and puts a numbered peg at each end: ${count}.`
        : `It splits a thread where the two solutions differed and lays again: ${count}.`,
    puzzle: laying.puzzle,
    threads: laying.threads,
    highlight: [],
    revealed: false,
    checks: checksUpTo(1),
  };
  if (laying.outcome === "accepted") {
    return [
      {
        ...laid,
        title: "Exactly one solution",
        caption: `${laid.caption} The search solver weighs all ${String(record.paths)} possible paths and finds exactly one way to weave them.`,
        checks: checksUpTo(3),
      },
    ];
  }
  return [
    laid,
    {
      title: "A second solution",
      caption:
        "The search solver finds another way to weave the same pegs. The two differ in the lit squares, so the puzzle isn't unique yet.",
      puzzle: laying.puzzle,
      threads: laying.rival ?? laying.threads,
      highlight: laying.trouble,
      revealed: false,
      checks: { ...checksUpTo(2), unique: "failed" },
    },
  ];
}

/** The logic solver's view: what the board gives away, then each round of deduction. */
function solveFrames(record: PipelineRecord, puzzle: Puzzle): TourFrame[] {
  const start: TourFrame = {
    title: "Solving by deduction",
    caption: `Now the logic solver plays it like a person. ${plural(record.given.length, "thread has", "threads have")} only one possible path from the start.`,
    puzzle,
    threads: record.given,
    highlight: squaresOf(record.given),
    revealed: false,
    checks: checksUpTo(3),
  };
  let shown: readonly Thread[] = record.given;
  const rounds: TourFrame[] = record.rounds.map((round: RecordedRound, i: number): TourFrame => {
    shown = [...shown, ...round.settled];
    const last: boolean = i === record.rounds.length - 1;
    return {
      title: `Round ${String(i + 1)} of ${String(record.rounds.length)}`,
      caption: `${capitalised(round.rules.map((rule: Rule): string => ruleReasons[rule]).join(", and "))}. ${plural(round.settled.length, "more thread settles", "more threads settle")}.`,
      puzzle,
      threads: shown,
      highlight: squaresOf(round.settled),
      revealed: false,
      checks: last ? checksUpTo(4) : checksUpTo(3),
    };
  });
  return [start, ...rounds];
}

function checksUpTo(passed: number): Record<Check, CheckState> {
  return Object.fromEntries(
    CHECKS.map((check: Check, i: number): [Check, CheckState] => [
      check,
      i < passed ? "passed" : "pending",
    ]),
  ) as Record<Check, CheckState>;
}

function squaresOf(threads: readonly Thread[]): readonly Point[] {
  return threads.flatMap((thread: Thread): readonly Point[] => thread.squares);
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
