import type { Palette } from "./palette.ts";
import { createSprite, type Sprite } from "./sprite.ts";

/** CSS pixels rather than fractions of a square, so it stays readable on a 15×15 phone board. */
const BADGE_HEIGHT: number = 24;
const BADGE_FONT: number = 15;
const BADGE_PADDING: number = 9;
/** A middle baseline centres the em box, which sits digits a little high. */
const BADGE_DROP: number = 1;

/** A pill in the thread's colour showing how many squares the thread has. */
export function drawLengthBadge(
  length: number,
  colour: string,
  ratio: number,
  palette: Palette,
): HTMLCanvasElement {
  const label: string = String(length);
  const font: string = `700 ${String(Math.round(BADGE_FONT * ratio))}px ${palette.font}`;
  const height: number = Math.round(BADGE_HEIGHT * ratio);
  const width: number = Math.max(
    height,
    Math.ceil(textWidth(label, font) + 2 * BADGE_PADDING * ratio),
  );
  const { canvas, context }: Sprite = createSprite(width, height);
  context.fillStyle = colour;
  context.beginPath();
  context.roundRect(0, 0, width, height, height / 2);
  context.fill();
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = palette.pegNumber;
  context.fillText(label, width / 2, height / 2 + BADGE_DROP * ratio);
  return canvas;
}

function textWidth(label: string, font: string): number {
  const { context }: Sprite = createSprite(1, 1);
  context.font = font;
  return context.measureText(label).width;
}
