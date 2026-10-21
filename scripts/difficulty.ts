/**
 * Prints how each shipped level plays, in play order, as a markdown table. See SolveProfile in
 * src/core/solve-profile.ts for what most columns count. Thinking rounds are the rounds of
 * deduction a player needs beyond the moves they see (solveAsPlayer).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeLevel, type DecodeResult } from "../src/core/level-decoder.ts";
import { solveAsPlayer } from "../src/core/logic-solver.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import { profileSolve, type SolveProfile } from "../src/core/solve-profile.ts";

const LEVELS: string = join("src", "levels");

const HEADER: readonly string[] = [
  "#",
  "Level",
  "Picture",
  "Size",
  "Pegs",
  "Given",
  "With rivals",
  "Paths per peg",
  "Rounds",
  "Thinking rounds",
  "Medium rounds",
  "Steps per round",
  "Obvious threads",
  "Rating",
];

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(join(LEVELS, file), "utf8"));
}

function row(id: string, index: number): readonly string[] {
  const decoded: DecodeResult = decodeLevel(readJson(`${id}.json`));
  if (!decoded.ok) throw new Error(`${id}: ${decoded.errors.join("; ")}`);
  const puzzle: Puzzle = decoded.puzzle;
  const profile: SolveProfile | undefined = profileSolve(puzzle);
  if (!profile) throw new Error(`${id}: the logic solver doesn't finish it`);
  return [
    String(index + 1),
    puzzle.title,
    puzzle.hidden === true ? "hidden" : "shown",
    `${String(puzzle.width)}×${String(puzzle.height)}`,
    String(profile.pegs),
    percentOf(profile.givenPegs, profile.pegs),
    percentOf(profile.pegsWithRivals, profile.pegs),
    profile.pathsPerPeg.toFixed(1),
    String(profile.rounds),
    String(solveAsPlayer(puzzle).thinking.length),
    String(profile.mediumRounds),
    profile.stepsPerRound.toFixed(1),
    percentOf(profile.obviousThreads, profile.threads),
    profile.difficulty,
  ];
}

function percentOf(part: number, whole: number): string {
  return `${String(part)} (${String(Math.round((100 * part) / whole))}%)`;
}

function tableLine(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

const order: unknown = readJson("order.json");
if (!Array.isArray(order)) throw new Error("order.json isn't a list");
const ids: readonly string[] = order.map(String);
console.log(tableLine(HEADER));
console.log(tableLine(HEADER.map((): string => "---")));
ids.forEach((id: string, index: number): void => {
  console.log(tableLine(row(id, index)));
});
