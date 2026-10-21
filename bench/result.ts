/** One worst-case board drawn by the render benchmark. Times are milliseconds. */
export interface BenchResult {
  /** Squares per side. */
  readonly size: number;
  readonly renderer: string;
  readonly canvasCalls: number;
  readonly callsByMethod: Readonly<Record<string, number>>;
  /** The first draw, which also builds the thread tiles. */
  readonly firstFrame: number;
  /** Issuing one frame's canvas commands, not counting the GPU work they cause. */
  readonly record: number;
  /** Between animation frames while redrawing every frame. Vsync floors these at about 16.7. */
  readonly frameMedian: number;
  readonly frameP90: number;
  readonly frameMax: number;
}

export interface Bench {
  run(size: number): Promise<BenchResult>;
}
