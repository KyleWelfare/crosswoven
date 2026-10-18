import type { Point } from "./geometry";
import { flagX, gravityOf, startX, type Ceiling, type Level, type Platform } from "./level";

export const TIMESTEP: number = 1 / 240;
export const MAX_RUN_TIME: number = 10;
export const BOX_SIZE: number = 18;

export type Outcome = "cleared" | "hitCeiling" | "hitLedge" | "fellShort" | "flewPast" | "timedOut";

export interface RunResult {
  outcome: Outcome;
  // Bottom-left of the box at the start and after each step.
  path?: Point[];
}

export function simulate(
  level: Level,
  run: number,
  jump: number,
  options: { recordPath?: boolean } = {},
): RunResult {
  const { platforms, ceilings }: Level = level;
  const gravity: number = gravityOf(level.planet);
  const goal: number = flagX(level);
  const path: Point[] | undefined = options.recordPath ? [] : undefined;

  let x: number = startX(level);
  let y: number = platforms[0].top;
  let vy: number = 0;
  let standing: Platform | null = platforms[0];
  let standingIndex: number = 0;
  let target: Platform = platforms[0];

  const finish = (outcome: Outcome): RunResult => {
    if (!path) return { outcome };
    path.push({ x, y });
    return { outcome, path };
  };

  path?.push({ x, y });
  const steps: number = Math.round(MAX_RUN_TIME / TIMESTEP);
  for (let step: number = 0; step < steps; step++) {
    const prevX: number = x;
    const prevY: number = y;
    x += run * TIMESTEP;

    if (standing) {
      const next: Platform | undefined = platforms[standingIndex + 1];
      const edge: number = standing.x + standing.width;
      if (!next) {
        if (x + BOX_SIZE >= goal) return finish("cleared");
      } else if (x + BOX_SIZE >= edge) {
        // Take off exactly at the edge so jump length doesn't depend on the timestep.
        x = Math.max(prevX, edge - BOX_SIZE);
        vy = jump;
        standing = null;
        target = next;
      }
    } else {
      // Exact for constant gravity, so peaks match h = jump² / 2g.
      y += vy * TIMESTEP - 0.5 * gravity * TIMESTEP ** 2;
      vy -= gravity * TIMESTEP;
    }

    if (ceilings.some((c: Ceiling): boolean => overlapsX(x, c) && y + BOX_SIZE > c.bottom)) {
      return finish("hitCeiling");
    }

    if (!standing) {
      for (const [index, platform] of platforms.entries()) {
        if (!overlapsX(x, platform) || y >= platform.top) continue;
        if (prevY < platform.top) return finish("hitLedge");
        y = platform.top;
        vy = 0;
        standing = platform;
        standingIndex = index;
        break;
      }
      if (y < 0) return finish(x > target.x ? "flewPast" : "fellShort");
    }

    path?.push({ x, y });
  }
  return finish("timedOut");
}

function overlapsX(boxX: number, span: { x: number; width: number }): boolean {
  return boxX < span.x + span.width && boxX + BOX_SIZE > span.x;
}
