/** Times in milliseconds. */
export function timed(work: () => void): number {
  const start: number = performance.now();
  work();
  return performance.now() - start;
}

/** Wraps every 2D context method while `work` runs, counting calls by method name. */
export function countCanvasCalls(work: () => void): Record<string, number> {
  const prototype: object = CanvasRenderingContext2D.prototype;
  const counts: Record<string, number> = {};
  const originals: [string, PropertyDescriptor][] = [];
  for (const name of Object.getOwnPropertyNames(prototype)) {
    const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(
      prototype,
      name,
    );
    const method: unknown = descriptor?.value;
    if (!descriptor || typeof method !== "function" || name === "constructor") continue;
    originals.push([name, descriptor]);
    Object.defineProperty(prototype, name, {
      ...descriptor,
      value: function (this: unknown, ...args: unknown[]): unknown {
        counts[name] = (counts[name] ?? 0) + 1;
        const result: unknown = Reflect.apply(method, this, args);
        return result;
      },
    });
  }
  try {
    work();
  } finally {
    for (const [name, descriptor] of originals) Object.defineProperty(prototype, name, descriptor);
  }
  return counts;
}

export function totalCalls(callsByMethod: Readonly<Record<string, number>>): number {
  return Object.values(callsByMethod).reduce((sum: number, n: number): number => sum + n, 0);
}

/** Draws frame `i` on each of `count` animation frames and returns the gaps between them. */
export async function frameIntervals(
  draw: (frame: number) => void,
  count: number,
): Promise<number[]> {
  const intervals: number[] = [];
  let last: number = await nextFrame();
  for (let i: number = 0; i < count; i++) {
    draw(i);
    const now: number = await nextFrame();
    intervals.push(now - last);
    last = now;
  }
  return intervals;
}

function nextFrame(): Promise<number> {
  return new Promise<number>((resolve: (time: number) => void): void => {
    requestAnimationFrame(resolve);
  });
}

export function percentile(values: readonly number[], fraction: number): number {
  const sorted: number[] = [...values].sort((a: number, b: number): number => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

export function renderer(): string {
  const gl: WebGLRenderingContext | null = document.createElement("canvas").getContext("webgl");
  const info: WEBGL_debug_renderer_info | null =
    gl?.getExtension("WEBGL_debug_renderer_info") ?? null;
  if (!gl || !info) return "unknown";
  return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
}
