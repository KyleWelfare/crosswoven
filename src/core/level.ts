export type Planet = "moon" | "earth" | "jupiter";

// Solid from `top` down to the bottom of the world.
export interface Platform {
  x: number;
  width: number;
  top: number;
}

// Solid from `bottom` up past the top of the world.
export interface Ceiling {
  x: number;
  width: number;
  bottom: number;
}

export interface SpeedRange {
  min: number;
  max: number;
  step: number;
}

// World units, y up from the bottom of the world.
export interface Level {
  version: 1;
  id: string;
  world: { width: number; height: number };
  planet: Planet;
  platforms: readonly [Platform, ...Platform[]];
  ceilings: readonly Ceiling[];
  arrow: { runSpeed: SpeedRange; jumpSpeed: SpeedRange };
}

export const START_INSET: number = 10;
export const FLAG_INSET: number = 30;

// Units/s². Scaled for play, not real ratios.
const GRAVITY: Record<Planet, number> = { moon: 700, earth: 1300, jupiter: 2100 };

export function gravityOf(planet: Planet): number {
  return GRAVITY[planet];
}

export function startX(level: Level): number {
  return level.platforms[0].x + START_INSET;
}

export function flagX(level: Level): number {
  const last: Platform = level.platforms[level.platforms.length - 1] ?? level.platforms[0];
  return last.x + last.width - FLAG_INSET;
}
