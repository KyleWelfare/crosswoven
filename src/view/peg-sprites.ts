import type { Point } from "../core/puzzle.ts";
import type { Palette } from "./palette.ts";
import { createSprite, type Sprite } from "./sprite-cache.ts";

/** Fractions of a square. The shadow stays inside it, so a sprite is one square in size. */
const PEG_RADIUS: number = 0.34;
const PEG_RING: number = 0.08;
const PEG_SHADOW_BLUR: number = 0.04;
const PEG_SHADOW_OFFSET: number = 0.012;

/** A tied peg is a glossy bead in its thread's colour; an untied one is a ring on its square. */
export function drawPegSprite(
  colour: string,
  wash: string,
  tied: boolean,
  cell: number,
  palette: Palette,
): HTMLCanvasElement {
  const { canvas, context }: Sprite = createSprite(cell, cell);
  const point: Point = { x: cell / 2, y: cell / 2 };
  const radius: number = PEG_RADIUS * cell;
  const ring: number = PEG_RING * cell;

  if (!tied) {
    circle(context, point, radius - ring / 2);
    context.fillStyle = wash;
    context.fill();
    context.strokeStyle = colour;
    context.lineWidth = ring;
    context.stroke();
    return canvas;
  }

  context.save();
  context.shadowColor = palette.pegShadow;
  context.shadowBlur = PEG_SHADOW_BLUR * cell;
  context.shadowOffsetY = PEG_SHADOW_OFFSET * cell;
  circle(context, point, radius);
  context.fillStyle = colour;
  context.fill();
  context.restore();

  const glint: Point = { x: point.x - radius * 0.35, y: point.y - radius * 0.35 };
  const sheen: CanvasGradient = context.createRadialGradient(
    glint.x,
    glint.y,
    0,
    glint.x,
    glint.y,
    radius,
  );
  sheen.addColorStop(0, palette.pegShine);
  sheen.addColorStop(1, "transparent");
  context.fillStyle = sheen;
  context.fill();

  circle(context, point, radius - ring / 4);
  context.strokeStyle = palette.shade;
  context.lineWidth = ring / 2;
  context.stroke();
  return canvas;
}

function circle(context: CanvasRenderingContext2D, point: Point, radius: number): void {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, 2 * Math.PI);
}
