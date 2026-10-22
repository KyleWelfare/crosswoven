/**
 * Render benchmark: draws worst-case boards (bench/render.ts) and every step of How the Puzzles
 * Are Made (bench/tour.ts) in headless Chrome at phone size, with and without CPU throttling, and
 * prints the results as markdown tables. Pass `board` or `tour` to run only one suite.
 */
import { createServer, type ViteDevServer } from "vite";
import type { BoardResult, TourStepResult } from "../bench/result.ts";
import { evaluate, load, withChrome, type DevTools } from "./chrome.ts";

/** A way for Chrome to draw, set by its launch flags. */
interface Raster {
  readonly name: string;
  readonly flags: readonly string[];
}

type Suite = "board" | "tour";

interface Run<T> {
  readonly raster: string;
  readonly throttle: number;
  readonly result: T;
}

interface Runs {
  readonly board: Run<BoardResult>[];
  readonly tour: Run<TourStepResult>[];
}

const SUITES: readonly Suite[] = ["board", "tour"];
const SIZES: readonly number[] = [5, 15];
const RASTERS: readonly Raster[] = [
  { name: "GPU", flags: [] },
  // How Chrome draws on a device whose GPU driver it has blocklisted. Throttling slows this too,
  // because unaccelerated canvas rasterises on the main thread.
  {
    name: "CPU only",
    flags: ["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas"],
  },
];
/** CPU slowdowns. 4x stands in for a mid-range phone; Chrome can't throttle the GPU. */
const THROTTLES: readonly number[] = [1, 4];
/** iPhone 16. */
const VIEWPORT: Readonly<Record<string, number | boolean>> = {
  width: 393,
  height: 852,
  deviceScaleFactor: 3,
  mobile: true,
};
const READY: string = "window.crosswovenBench";

await main();

async function main(): Promise<void> {
  const suites: readonly Suite[] = chosenSuites(process.argv.slice(2));
  const server: ViteDevServer = await createServer({ logLevel: "error" });
  await server.listen();
  try {
    const base: string | undefined = server.resolvedUrls?.local[0];
    if (!base) throw new Error("Vite dev server has no local URL");
    const runs: Runs = { board: [], tour: [] };
    for (const raster of RASTERS) {
      await withChrome(raster.flags, async (devTools: DevTools): Promise<void> => {
        await devTools.send("Emulation.setDeviceMetricsOverride", VIEWPORT);
        if (suites.includes("board"))
          runs.board.push(...(await benchBoards(devTools, base, raster)));
        if (suites.includes("tour")) runs.tour.push(...(await benchTour(devTools, base, raster)));
      });
    }
    const reports: string[] = [];
    if (suites.includes("board")) reports.push(boardReport(runs.board));
    if (suites.includes("tour")) reports.push(tourReport(runs.tour));
    console.log(reports.join("\n\n"));
  } finally {
    await server.close();
  }
}

function chosenSuites(args: readonly string[]): readonly Suite[] {
  if (args.length === 0) return SUITES;
  const unknown: string[] = args.filter((arg: string): boolean => !isSuite(arg));
  if (unknown.length > 0) {
    throw new Error(`Unknown suite ${unknown.join(", ")}. Choose from ${SUITES.join(", ")}`);
  }
  return args.filter(isSuite);
}

function isSuite(arg: string): arg is Suite {
  return (SUITES as readonly string[]).includes(arg);
}

async function benchBoards(
  devTools: DevTools,
  base: string,
  raster: Raster,
): Promise<Run<BoardResult>[]> {
  const runs: Run<BoardResult>[] = [];
  for (const throttle of THROTTLES) {
    for (const size of SIZES) {
      const result: BoardResult = (await runOnce(
        devTools,
        `${base}bench/render.html`,
        `window.crosswovenBench.run(${String(size)})`,
        throttle,
      )) as BoardResult;
      runs.push({ raster: raster.name, throttle, result });
    }
  }
  return runs;
}

async function benchTour(
  devTools: DevTools,
  base: string,
  raster: Raster,
): Promise<Run<TourStepResult>[]> {
  const url: string = `${base}bench/tour.html`;
  await load(devTools, url, READY);
  const steps: number = (await evaluate(devTools, "window.crosswovenBench.steps()")) as number;
  const runs: Run<TourStepResult>[] = [];
  for (const throttle of THROTTLES) {
    for (let step: number = 0; step < steps; step++) {
      const result: TourStepResult = (await runOnce(
        devTools,
        url,
        `window.crosswovenBench.run(${String(step)})`,
        throttle,
      )) as TourStepResult;
      runs.push({ raster: raster.name, throttle, result });
    }
  }
  return runs;
}

/** Each run gets a fresh page, loaded unthrottled so throttling only slows the benchmark itself. */
async function runOnce(
  devTools: DevTools,
  url: string,
  expression: string,
  throttle: number,
): Promise<unknown> {
  await devTools.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await load(devTools, url, READY);
  await devTools.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  return evaluate(devTools, expression);
}

function boardReport(runs: readonly Run<BoardResult>[]): string {
  const rows: string[] = runs.map(({ raster, throttle, result }: Run<BoardResult>): string =>
    [
      raster,
      `${String(result.size)}×${String(result.size)}`,
      `${String(throttle)}×`,
      String(result.canvasCalls),
      result.record.toFixed(2),
      result.firstFrame.toFixed(1),
      intervals(result),
    ].join(" | "),
  );
  const largest: Run<BoardResult> | undefined = runs.find(
    (run: Run<BoardResult>): boolean =>
      run.throttle === 1 && run.result.size === Math.max(...SIZES),
  );
  return [
    "## Board",
    "",
    ...renderers(runs),
    "",
    "| Raster | Board | CPU | Canvas calls / frame | Issue commands (ms) | First frame, building tiles (ms) | Frame interval median / p90 / max (ms) |",
    "| ------ | ----- | --- | -------------------: | ------------------: | -------------------------------: | -------------------------------------: |",
    ...rows.map((row: string): string => `| ${row} |`),
    "",
    `Canvas calls per ${String(Math.max(...SIZES))}×${String(Math.max(...SIZES))} frame: ${breakdown(largest?.result.callsByMethod)}`,
  ].join("\n");
}

function tourReport(runs: readonly Run<TourStepResult>[]): string {
  const rows: string[] = runs.map(({ raster, throttle, result }: Run<TourStepResult>): string =>
    [
      raster,
      `${String(throttle)}×`,
      `${String(result.step + 1)}. ${result.heading}`,
      result.scene,
      result.canvasCalls.toFixed(0),
      `${result.recordMean.toFixed(2)} / ${result.recordMax.toFixed(2)}`,
      result.firstFrame.toFixed(1),
      intervals(result),
    ].join(" | "),
  );
  const busiest: Run<TourStepResult> | undefined = runs
    .filter((run: Run<TourStepResult>): boolean => run.throttle === 1)
    .reduce<Run<TourStepResult> | undefined>(
      (most: Run<TourStepResult> | undefined, run: Run<TourStepResult>): Run<TourStepResult> =>
        !most || run.result.canvasCalls > most.result.canvasCalls ? run : most,
      undefined,
    );
  return [
    "## How the Puzzles Are Made",
    "",
    ...renderers(runs),
    "",
    "| Raster | CPU | Step | Scene | Canvas calls / frame | Issue commands mean / max (ms) | First frame (ms) | Frame interval median / p90 / max (ms) |",
    "| ------ | --- | ---- | ----- | -------------------: | -----------------------------: | ---------------: | -------------------------------------: |",
    ...rows.map((row: string): string => `| ${row} |`),
    "",
    busiest
      ? `Canvas calls per frame on the busiest step, ${busiest.result.heading}: ${breakdown(busiest.result.callsByMethod)}`
      : "",
  ].join("\n");
}

function intervals(result: {
  readonly frameMedian: number;
  readonly frameP90: number;
  readonly frameMax: number;
}): string {
  return [result.frameMedian, result.frameP90, result.frameMax]
    .map((ms: number): string => ms.toFixed(1))
    .join(" / ");
}

function renderers(runs: readonly Run<{ readonly renderer: string }>[]): string[] {
  return RASTERS.map((raster: Raster): string => {
    const run: Run<{ readonly renderer: string }> | undefined = runs.find(
      (candidate: Run<{ readonly renderer: string }>): boolean => candidate.raster === raster.name,
    );
    return `- ${raster.name}: ${run?.result.renderer ?? "unknown"}`;
  });
}

function breakdown(callsByMethod: Readonly<Record<string, number>> | undefined): string {
  return Object.entries(callsByMethod ?? {})
    .sort(([, a]: [string, number], [, b]: [string, number]): number => b - a)
    .map(([name, count]: [string, number]): string => `${name} ${count.toFixed(0)}`)
    .join(", ");
}
