import type { Point } from "../src/core/geometry";
import { describe, expect, it } from "vitest";
import { START_INSET, type Ceiling, type Level, type Platform } from "../src/core/level";
import { BOX_SIZE, simulate } from "../src/core/physics";

// Earth gravity is 1300, so with run 200 and jump 520 a flat jump is 160 long and peaks 104 high.
function level(platforms: [Platform, ...Platform[]], ceilings: Ceiling[] = []): Level {
  return {
    version: 1,
    id: "test",
    world: { width: 800, height: 360 },
    planet: "earth",
    platforms,
    ceilings,
    arrow: {
      runSpeed: { min: 120, max: 320, step: 10 },
      jumpSpeed: { min: 300, max: 700, step: 20 },
    },
  };
}

const start: Platform = { x: 0, width: 200, top: 60 };

describe("simulate", (): void => {
  it("clears a level by landing on each platform and reaching the flag", (): void => {
    const lvl: Level = level([
      start,
      { x: 300, width: 150, top: 60 },
      { x: 550, width: 250, top: 60 },
    ]);
    expect(simulate(lvl, 200, 500).outcome).toBe("cleared");
  });

  it("takes off when the front of the box reaches the platform edge", (): void => {
    const lvl: Level = level([start, { x: 300, width: 300, top: 60 }]);
    const path: Point[] = simulate(lvl, 200, 520, { recordPath: true }).path ?? [];
    const takeoff: number = path.findIndex((p: Point): boolean => p.y > start.top) - 1;
    expect(path[takeoff]?.x).toBe(start.width - BOX_SIZE);
  });

  it("lands when only the front corner of the box comes down on a platform", (): void => {
    const lvl: Level = level([start, { x: 358, width: 300, top: 60 }]);
    expect(simulate(lvl, 200, 520).outcome).toBe("cleared");
  });

  it("hits the ledge when the box just misses a platform top", (): void => {
    const lvl: Level = level([start, { x: 362, width: 300, top: 60 }]);
    expect(simulate(lvl, 200, 520).outcome).toBe("hitLedge");
  });

  it("lands on a lower platform", (): void => {
    const lvl: Level = level([
      { ...start, top: 120 },
      { x: 300, width: 300, top: 60 },
    ]);
    expect(simulate(lvl, 200, 500).outcome).toBe("cleared");
  });

  it("hits the ledge when a higher platform's side is in the way", (): void => {
    const lvl: Level = level([start, { x: 300, width: 500, top: 200 }]);
    expect(simulate(lvl, 200, 500).outcome).toBe("hitLedge");
  });

  it("hits a ceiling the box rises into", (): void => {
    const lvl: Level = level(
      [start, { x: 300, width: 500, top: 60 }],
      [{ x: 220, width: 60, bottom: 120 }],
    );
    expect(simulate(lvl, 200, 500).outcome).toBe("hitCeiling");
  });

  it("clears a ceiling the peak stays just under, and hits one just lower", (): void => {
    const platforms: [Platform, Platform] = [start, { x: 300, width: 300, top: 60 }];
    const peakTop: number = start.top + 104 + BOX_SIZE;
    const above: Level = level(platforms, [{ x: 250, width: 50, bottom: peakTop + 1 }]);
    const below: Level = level(platforms, [{ x: 250, width: 50, bottom: peakTop - 1 }]);
    expect(simulate(above, 200, 520).outcome).toBe("cleared");
    expect(simulate(below, 200, 520).outcome).toBe("hitCeiling");
  });

  it("falls short when the box drops into the gap before the next platform", (): void => {
    const lvl: Level = level([start, { x: 400, width: 400, top: 60 }]);
    expect(simulate(lvl, 120, 300).outcome).toBe("fellShort");
  });

  it("flies past when the box clears the next platform and drops out of the world", (): void => {
    const lvl: Level = level([
      start,
      { x: 300, width: 40, top: 60 },
      { x: 700, width: 100, top: 60 },
    ]);
    expect(simulate(lvl, 320, 700).outcome).toBe("flewPast");
  });

  it("times out when the run never ends", (): void => {
    const lvl: Level = level([{ x: 0, width: 800, top: 60 }]);
    expect(simulate(lvl, 10, 500).outcome).toBe("timedOut");
  });

  it("peaks at jump² / 2g whatever the run speed", (): void => {
    const lvl: Level = level([start, { x: 300, width: 500, top: 60 }]);
    const peak = (run: number): number =>
      Math.max(
        ...(simulate(lvl, run, 520, { recordPath: true }).path ?? []).map(
          (p: Point): number => p.y,
        ),
      );
    expect(peak(150)).toBeCloseTo(start.top + 104, 6);
    expect(peak(300)).toBeCloseTo(start.top + 104, 6);
  });

  it("records the path only when asked", (): void => {
    const lvl: Level = level([start, { x: 300, width: 300, top: 60 }]);
    expect(simulate(lvl, 200, 520).path).toBeUndefined();
    const path: Point[] | undefined = simulate(lvl, 200, 520, { recordPath: true }).path;
    expect(path?.[0]).toEqual({ x: START_INSET, y: start.top });
  });
});
