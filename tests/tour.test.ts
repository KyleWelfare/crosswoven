import { describe, expect, it } from "vitest";
import {
  CHECKS,
  tourFrames,
  type Check,
  type CheckState,
  type TourFrame,
} from "../src/app/tour.ts";
import { toSolution } from "../src/core/thread.ts";
import { tourRecord } from "../src/how-it-works/record.ts";

const frames: readonly TourFrame[] = tourFrames(tourRecord);

function states(frame: TourFrame | undefined): readonly CheckState[] {
  return CHECKS.map((check: Check): CheckState => frame?.checks[check] ?? "pending");
}

describe("tourFrames", (): void => {
  it("opens on the finished picture, with nothing checked yet", (): void => {
    expect(frames[0]?.revealed).toBe(true);
    expect(states(frames[0])).toEqual(CHECKS.map((): CheckState => "pending"));
  });

  it("shows each second solution lit where it differs, failing uniqueness", (): void => {
    const second: readonly TourFrame[] = frames.filter(
      (frame: TourFrame): boolean => frame.checks.unique === "failed",
    );
    expect(second).toHaveLength(
      tourRecord.layings.filter(
        ({ outcome }: { outcome: string }): boolean => outcome === "not-unique",
      ).length,
    );
    for (const frame of second) expect(frame.highlight).not.toHaveLength(0);
  });

  it("adds the threads each round settles to those already shown", (): void => {
    const solving: readonly TourFrame[] = frames.slice(-1 - tourRecord.rounds.length - 1, -1);
    solving.slice(1).forEach((frame: TourFrame, i: number): void => {
      expect(frame.threads.length).toBeGreaterThan(solving[i]?.threads.length ?? 0);
    });
    expect(toSolution(solving.at(-1)?.threads ?? [], 9)).toEqual(tourRecord.solution);
  });

  it("ends certified, with every check passed and the picture revealed", (): void => {
    expect(frames.at(-1)?.revealed).toBe(true);
    expect(states(frames.at(-1))).toEqual(CHECKS.map((): CheckState => "passed"));
  });
});
