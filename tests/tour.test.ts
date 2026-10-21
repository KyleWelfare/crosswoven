import { describe, expect, it } from "vitest";
import { tourFrames, type Actor, type Scene, type TourFrame } from "../src/app/tour.ts";
import type { RecordedLaying } from "../src/core/pipeline-record.ts";
import type { Point } from "../src/core/puzzle.ts";
import { toSolution, type Thread } from "../src/core/thread.ts";
import { tourRecord } from "../src/how-it-works/record.ts";

const frames: readonly TourFrame[] = tourFrames(tourRecord);

function scenesOf<K extends Scene["kind"]>(kind: K): Extract<Scene, { kind: K }>[] {
  return frames
    .map((frame: TourFrame): Scene => frame.scene)
    .filter((scene: Scene): scene is Extract<Scene, { kind: K }> => scene.kind === kind);
}

describe("tourFrames", (): void => {
  it("runs from the picture through the generator and both solvers to the verdict", (): void => {
    const actors: readonly Actor[] = frames.map((frame: TourFrame): Actor => frame.actor);
    expect(actors[0]).toBe("picture");
    expect(actors.at(-1)).toBe("validator");
    expect(actors.indexOf("search")).toBeLessThan(actors.indexOf("logic"));
    expect(actors.lastIndexOf("generator")).toBeLessThan(actors.indexOf("logic"));
  });

  it("compares each laying with two solutions with the other one, where they differ", (): void => {
    const rejected: readonly RecordedLaying[] = tourRecord.layings.filter(
      (laying: RecordedLaying): boolean => laying.outcome === "not-unique",
    );
    const compares: readonly Extract<Scene, { kind: "compare" }>[] = scenesOf("compare");
    expect(compares).toHaveLength(rejected.length);
    for (const scene of compares) {
      expect(scene.onlyFirst).not.toHaveLength(0);
      expect(scene.onlySecond).not.toHaveLength(0);
      expect(scene.differ).not.toHaveLength(0);
    }
  });

  it("splits one thread into two pieces between layings, keeping the rest", (): void => {
    for (const scene of scenesOf("split")) {
      expect(scene.cut).toHaveLength(1);
      expect(scene.pieces).toHaveLength(2);
      const cutLength: number = scene.cut[0]?.squares.length ?? 0;
      const piecesLength: number = scene.pieces.reduce(
        (sum: number, thread: Thread): number => sum + thread.squares.length,
        0,
      );
      expect(piecesLength).toBe(cutLength);
      const squares = (threads: readonly Thread[]): readonly string[] =>
        threads
          .flatMap((thread: Thread): readonly Point[] => thread.squares)
          .map((square: Point): string => `${String(square.x)},${String(square.y)}`)
          .sort();
      expect(squares(scene.pieces)).toEqual(squares(scene.cut));
    }
  });

  it("deduces round after round, each starting from what the rounds before settled", (): void => {
    const deductions: readonly Extract<Scene, { kind: "deduce" }>[] = scenesOf("deduce");
    deductions.slice(1).forEach((scene: Extract<Scene, { kind: "deduce" }>, i: number): void => {
      const before: Extract<Scene, { kind: "deduce" }> | undefined = deductions[i];
      expect(scene.known).toEqual([...(before?.known ?? []), ...(before?.settled ?? [])]);
      expect(scene.ruledOut).not.toHaveLength(0);
    });
    const last: Extract<Scene, { kind: "deduce" }> | undefined = deductions.at(-1);
    expect(toSolution([...(last?.known ?? []), ...(last?.settled ?? [])], 9)).toEqual(
      tourRecord.solution,
    );
  });

  it("searches every possible path before showing the one solution", (): void => {
    const [scene]: readonly Extract<Scene, { kind: "search" }>[] = scenesOf("search");
    expect(scene?.candidates).toEqual(tourRecord.candidates);
    expect(scene?.solution).toEqual(tourRecord.solution);
  });
});
