/**
 * Offscreen canvases reused across frames until the square size, pixel ratio or palette changes;
 * the board also when the level or stage size does.
 */
export interface SpriteCache {
  generation: string;
  readonly sprites: Map<string, HTMLCanvasElement>;
  board: CachedBoard | undefined;
}

interface CachedBoard {
  readonly key: string;
  readonly canvas: HTMLCanvasElement;
}

export function createSpriteCache(): SpriteCache {
  return { generation: "", sprites: new Map<string, HTMLCanvasElement>(), board: undefined };
}

/** Drops every sprite once they were drawn for something other than `generation`. */
export function setGeneration(cache: SpriteCache, generation: string): void {
  if (cache.generation === generation) return;
  cache.sprites.clear();
  cache.board = undefined;
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

/** Replaces the board when `key` changes, as on a resize or a new level, so old ones don't pile up. */
export function cachedBoard(
  cache: SpriteCache,
  key: string,
  draw: () => HTMLCanvasElement,
): HTMLCanvasElement {
  let board: CachedBoard | undefined = cache.board;
  if (board?.key !== key) {
    board = { key, canvas: draw() };
    cache.board = board;
  }
  return board.canvas;
}
