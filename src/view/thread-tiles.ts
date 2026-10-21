import { createSprite, type Sprite } from "./sprite-cache.ts";

/**
 * The thread through one square, drawn heading east: `straight` crosses west to east, `corner`
 * turns from the north edge to the west edge, and `end` runs from a peg at the centre to the east
 * edge. Quarter turns clockwise give every other piece.
 */
export type Piece = "straight" | "corner" | "end";

export type Axis = "across" | "down";

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Device pixels along and across a piece's centre line, and how far inside its edge a pixel is. */
interface ThreadCoordinates {
  readonly along: number;
  readonly across: number;
  readonly inside: number;
}

/** Twist grooves per square, roughly; each piece rounds to whole twists so grooves meet at edges. */
const TWISTS_PER_SQUARE: number = 4.5;
/** Tangent of the grooves' slant against the thread. */
const TWIST_SLANT: number = 0.8;
const FIBRE_NOISE: number = 0.08;
/** Fraction of a square over which the shadow on the lower thread at a crossing fades out. */
const WEAVE_SHADOW: number = 0.14;
/**
 * Fraction of a square at each end of a dyed piece over which its own colour blends into the dye.
 * Short, so the mix shows outside the top thread, but not a hard switch that reads as a separate piece.
 */
const DYE_BLEND: number = 0.2;

/** `size` is in device pixels and `width` is the thread's width as a fraction of the square. */
export function drawThreadTile(
  piece: Piece,
  colour: string,
  size: number,
  width: number,
): HTMLCanvasElement {
  const base: Rgb = parseColour(colour);
  const halfWidth: number = (width * size) / 2;
  const { canvas, context }: Sprite = createSprite(size, size);
  const image: ImageData = context.createImageData(size, size);

  const length: number = piece === "corner" ? (Math.PI * size) / 4 : size;
  const twists: number = Math.max(1, Math.round((TWISTS_PER_SQUARE * length) / size));
  const period: number = length / twists;

  for (let y: number = 0; y < size; y++) {
    for (let x: number = 0; x < size; x++) {
      const point: ThreadCoordinates = threadCoordinates(piece, x + 0.5, y + 0.5, size, halfWidth);
      const coverage: number = clamp(point.inside + 0.5, 0, 1);
      if (coverage === 0) continue;

      const roundness: number = Math.sqrt(Math.max(0, 1 - (point.across / halfWidth) ** 2));
      const twist: number = fract((point.along - point.across * TWIST_SLANT) / period);
      const ply: number = Math.sin(Math.PI * twist);
      const fibre: number = 1 + FIBRE_NOISE * (hash(x, y) - 0.5);
      const light: number = (0.45 + 0.55 * roundness) * (0.7 + 0.3 * ply) * fibre;
      const gloss: number = 0.3 * (roundness * ply) ** 8;

      const offset: number = (y * size + x) * 4;
      image.data[offset] = lit(base.r, light, gloss);
      image.data[offset + 1] = lit(base.g, light, gloss);
      image.data[offset + 2] = lit(base.b, light, gloss);
      image.data[offset + 3] = Math.round(coverage * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Two straight pieces heading east, drawn alike but for colour: `own` at the edges, where the
 * thread meets its neighbouring pieces, and `dye` through the middle.
 */
export function dyeStraightTile(own: HTMLCanvasElement, dye: HTMLCanvasElement): HTMLCanvasElement {
  const size: number = own.width;
  const middle: Sprite = createSprite(size, size);
  middle.context.drawImage(dye, 0, 0);
  const fade: CanvasGradient = middle.context.createLinearGradient(0, 0, size, 0);
  fade.addColorStop(0, "transparent");
  fade.addColorStop(DYE_BLEND, "black");
  fade.addColorStop(1 - DYE_BLEND, "black");
  fade.addColorStop(1, "transparent");
  middle.context.globalCompositeOperation = "destination-in";
  middle.context.fillStyle = fade;
  middle.context.fillRect(0, 0, size, size);

  const { canvas, context }: Sprite = createSprite(size, size);
  context.drawImage(own, 0, 0);
  context.drawImage(middle.canvas, 0, 0);
  return canvas;
}

/** Both threads at a crossing in one tile, with the top one shading the one beneath. */
export function drawCrossingTile(
  under: HTMLCanvasElement,
  over: HTMLCanvasElement,
  overAxis: Axis,
  shadow: string,
  width: number,
): HTMLCanvasElement {
  const size: number = under.width;
  const { canvas, context }: Sprite = createSprite(size, size);
  context.drawImage(under, 0, 0);

  const middle: number = size / 2;
  const threadWidth: number = width * size;
  const dx: number = overAxis === "across" ? 1 : 0;
  const dy: number = 1 - dx;
  const fade: number = WEAVE_SHADOW * size;
  const alongOver: number = threadWidth / 2;
  const alongUnder: number = threadWidth / 2 + fade;
  const gradient: CanvasGradient = context.createLinearGradient(
    middle - dy * alongUnder,
    middle - dx * alongUnder,
    middle + dy * alongUnder,
    middle + dx * alongUnder,
  );
  const edge: number = fade / (2 * alongUnder);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(edge, shadow);
  gradient.addColorStop(1 - edge, shadow);
  gradient.addColorStop(1, "transparent");
  const halfWidth: number = dx * alongOver + dy * alongUnder;
  const halfHeight: number = dy * alongOver + dx * alongUnder;
  context.fillStyle = gradient;
  context.fillRect(middle - halfWidth, middle - halfHeight, 2 * halfWidth, 2 * halfHeight);

  context.drawImage(over, 0, 0);
  return canvas;
}

/**
 * `across` is measured to the right of the direction of travel in every piece, so the twist has
 * the same handedness everywhere and grooves line up where pieces meet.
 */
function threadCoordinates(
  piece: Piece,
  x: number,
  y: number,
  size: number,
  halfWidth: number,
): ThreadCoordinates {
  const middle: number = size / 2;
  switch (piece) {
    case "straight":
      return { along: x, across: y - middle, inside: halfWidth - Math.abs(y - middle) };
    case "end": {
      const across: number = y - middle;
      const reach: number = x >= middle ? Math.abs(across) : Math.hypot(x - middle, across);
      return { along: x, across, inside: halfWidth - reach };
    }
    case "corner": {
      // Centred on the square's north-west corner, travelling from the north edge to the west.
      const radius: number = Math.hypot(x, y);
      const across: number = middle - radius;
      return { along: middle * Math.atan2(y, x), across, inside: halfWidth - Math.abs(across) };
    }
  }
}

function lit(channel: number, light: number, gloss: number): number {
  const shaded: number = clamp(channel * light, 0, 255);
  return Math.round(shaded + (255 - shaded) * gloss);
}

function parseColour(colour: string): Rgb {
  const { context }: Sprite = createSprite(1, 1);
  context.fillStyle = colour;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0]: Uint8ClampedArray = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

/** Deterministic noise in [0, 1), so the fibres look the same on every redraw. */
function hash(x: number, y: number): number {
  let h: number = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
