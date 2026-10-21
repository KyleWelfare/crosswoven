import type { Point } from "../core/puzzle.ts";
import type { Palette } from "./palette.ts";
import { createSprite, type Sprite } from "./sprite-cache.ts";

/** Fractions of a square. The shadow stays inside it, so a sprite is one square in size. */
const PEG_RADIUS: number = 0.34;
const PEG_RING: number = 0.08;
const PEG_SHADOW_BLUR: number = 0.04;
const PEG_SHADOW_OFFSET: number = 0.012;
const NUMBER_SIZE: number = 0.36;
/** A middle baseline centres the em box, which sits digits a little high. */
const NUMBER_DROP: number = 0.02;
/** A fraction of the peg's radius, up and to the left of its centre. */
const GLINT_OFFSET: number = 0.35;

/**
 * A tied peg is a glossy bead in its thread's colour; an untied one is a ring on its square.
 * Either way it shows its thread's length.
 */
export function drawPegSprite(
  colour: string,
  wash: string,
  tied: boolean,
  length: number,
  cell: number,
  palette: Palette,
): HTMLCanvasElement {
  const { canvas, context }: Sprite = createSprite(cell, cell);
  const point: Point = { x: cell / 2, y: cell / 2 };
  if (tied) drawBead(context, point, colour, cell, palette);
  else drawRing(context, point, colour, wash, cell);
  drawNumber(context, point, length, tied ? palette.pegNumber : colour, cell, palette.font);
  return canvas;
}

function drawRing(
  context: CanvasRenderingContext2D,
  point: Point,
  colour: string,
  wash: string,
  cell: number,
): void {
  const ring: number = PEG_RING * cell;
  circle(context, point, PEG_RADIUS * cell - ring / 2);
  context.fillStyle = wash;
  context.fill();
  context.strokeStyle = colour;
  context.lineWidth = ring;
  context.stroke();
}

function drawBead(
  context: CanvasRenderingContext2D,
  point: Point,
  colour: string,
  cell: number,
  palette: Palette,
): void {
  const radius: number = PEG_RADIUS * cell;
  const ring: number = PEG_RING * cell;

  context.save();
  context.shadowColor = palette.pegShadow;
  context.shadowBlur = PEG_SHADOW_BLUR * cell;
  context.shadowOffsetY = PEG_SHADOW_OFFSET * cell;
  circle(context, point, radius);
  context.fillStyle = colour;
  context.fill();
  context.restore();

  const glint: Point = {
    x: point.x - radius * GLINT_OFFSET,
    y: point.y - radius * GLINT_OFFSET,
  };
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
  context.strokeStyle = palette.pegRim;
  context.lineWidth = ring / 2;
  context.stroke();
}

function drawNumber(
  context: CanvasRenderingContext2D,
  point: Point,
  length: number,
  colour: string,
  cell: number,
  font: string,
): void {
  context.font = `700 ${String(Math.round(NUMBER_SIZE * cell))}px ${font}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = colour;
  context.fillText(String(length), point.x, point.y + NUMBER_DROP * cell);
}

function circle(context: CanvasRenderingContext2D, point: Point, radius: number): void {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, 2 * Math.PI);
}
