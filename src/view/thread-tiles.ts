/**
 * The thread through one square, drawn heading east: `straight` crosses west to east, `corner`
 * turns from the north edge to the west edge, and `end` runs from a peg at the centre to the east
 * edge. Quarter turns clockwise give every other piece.
 */
export type Piece = "straight" | "corner" | "end";

/** Tiles already drawn at `size` device pixels, keyed by piece and colour. */
export interface TileCache {
  size: number;
  readonly tiles: Map<string, HTMLCanvasElement>;
}

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

export function createTileCache(): TileCache {
  return { size: 0, tiles: new Map<string, HTMLCanvasElement>() };
}

/** `width` is the thread's width as a fraction of the square. */
export function threadTile(
  cache: TileCache,
  piece: Piece,
  colour: string,
  size: number,
  width: number,
): HTMLCanvasElement {
  if (cache.size !== size) {
    cache.tiles.clear();
    cache.size = size;
  }
  const key: string = `${piece} ${colour}`;
  let tile: HTMLCanvasElement | undefined = cache.tiles.get(key);
  if (!tile) {
    tile = drawTile(piece, parseColour(colour), size, (width * size) / 2);
    cache.tiles.set(key, tile);
  }
  return tile;
}

function drawTile(piece: Piece, base: Rgb, size: number, halfWidth: number): HTMLCanvasElement {
  const tile: HTMLCanvasElement = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const context: CanvasRenderingContext2D | null = tile.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
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
  return tile;
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
  const probe: HTMLCanvasElement = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const context: CanvasRenderingContext2D | null = probe.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
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
