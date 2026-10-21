import { describe, expect, it } from "vitest";
import { decodePicture, type PictureResult } from "../src/core/level-decoder.ts";
import {
  recordPipeline,
  type RecordedLaying,
  type RecordedRound,
} from "../src/core/pipeline-record.ts";
import { sameSolution, toSolution, type Thread } from "../src/core/thread.ts";
import { tourRecord } from "../src/how-it-works/record.ts";
import tourPicture from "../pictures/how-it-works/sailboat.json";

describe("recordPipeline", (): void => {
  it("still records How the Puzzles Are Made' picture as shipped, so npm run levels was rerun", (): void => {
    const picture: PictureResult = decodePicture(tourPicture);
    if (!picture.ok) throw new Error(picture.errors.join("; "));
    expect(recordPipeline(picture.picture)).toEqual(tourRecord);
  });

  it("gives each laying with two solutions the other one", (): void => {
    const rejected: readonly RecordedLaying[] = tourRecord.layings.filter(
      (laying: RecordedLaying): boolean => laying.outcome === "not-unique",
    );
    expect(rejected).not.toHaveLength(0);
    for (const laying of rejected) {
      expect(laying.rival).toBeDefined();
      expect(sameSolution(laying.rival ?? [], laying.threads)).toBe(false);
    }
    expect(tourRecord.layings.at(-1)?.outcome).toBe("accepted");
  });

  it("settles every thread of the solution exactly once, from the start or in a round", (): void => {
    const settled: readonly Thread[] = [
      ...tourRecord.given,
      ...tourRecord.rounds.flatMap((round: RecordedRound): readonly Thread[] => round.settled),
    ];
    expect(toSolution(settled, 9)).toEqual(tourRecord.solution);
  });
});
