export interface Sprite {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
}

/** Offscreen canvases reused across frames until the square size or palette changes. */
export interface SpriteCache {
  generation: string;
  readonly sprites: Map<string, HTMLCanvasElement>;
}

export function createSpriteCache(): SpriteCache {
  return { generation: "", sprites: new Map<string, HTMLCanvasElement>() };
}

/** Drops every sprite once they were drawn for something other than `generation`. */
export function setGeneration(cache: SpriteCache, generation: string): void {
  if (cache.generation === generation) return;
  cache.sprites.clear();
  cache.generation = generation;
}

export function cachedSprite(
  cache: SpriteCache,
  key: string,
  draw: () => HTMLCanvasElement,
): HTMLCanvasElement {
  let sprite: HTMLCanvasElement | undefined = cache.sprites.get(key);
  if (!sprite) {
    sprite = draw();
    cache.sprites.set(key, sprite);
  }
  return sprite;
}

export function createSprite(width: number, height: number): Sprite {
  const canvas: HTMLCanvasElement = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  return { canvas, context };
}

/** Clockwise quarter turns of a square sprite. They map pixels onto pixels, so nothing resamples. */
export function rotateSprite(source: HTMLCanvasElement, turns: number): HTMLCanvasElement {
  const size: number = source.width;
  const { canvas, context }: Sprite = createSprite(size, size);
  context.translate(size / 2, size / 2);
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(source, -size / 2, -size / 2);
  return canvas;
}
