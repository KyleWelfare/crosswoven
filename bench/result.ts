/** One worst-case board drawn by the render benchmark. Times are milliseconds. */
export interface BoardResult {
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

export interface BoardBench {
  run(size: number): Promise<BoardResult>;
}

/**
 * One step of How the Puzzles Are Made, sampled evenly across its whole loop, since each frame of
 * an animation draws something different. Times are milliseconds.
 */
export interface TourStepResult {
  readonly step: number;
  readonly heading: string;
  readonly scene: string;
  readonly renderer: string;
  /** These two are averaged over the sampled frames. */
  readonly canvasCalls: number;
  readonly callsByMethod: Readonly<Record<string, number>>;
  /** The first draw, which also builds the board and sprites. */
  readonly firstFrame: number;
  /** Issuing one frame's canvas commands, including the style and layout reads they force. */
  readonly recordMean: number;
  /** The slowest sampled frame, which catches sprites or boards rebuilt mid-loop. */
  readonly recordMax: number;
  readonly frameMedian: number;
  readonly frameP90: number;
  readonly frameMax: number;
}

export interface TourBench {
  steps(): number;
  run(step: number): Promise<TourStepResult>;
}

declare global {
  interface Window {
    /** Set by whichever benchmark page is loaded. */
    crosswovenBench?: BoardBench | TourBench;
  }
}
