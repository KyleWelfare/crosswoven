/**
 * Render benchmark: draws worst-case boards (bench/render.ts) in headless Chrome at phone size,
 * with and without CPU throttling, and prints the results as a markdown table.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import type { BenchResult } from "../bench/result.ts";

interface DevTools {
  send(method: string, params?: Readonly<Record<string, unknown>>): Promise<unknown>;
  close(): void;
}

interface Reply {
  readonly id?: number;
  readonly result?: unknown;
  readonly error?: { readonly message: string };
}

interface EvaluateResult {
  readonly result?: { readonly value?: unknown };
  readonly exceptionDetails?: { readonly text: string };
}

interface Target {
  readonly type: string;
  readonly webSocketDebuggerUrl?: string;
}

interface Run {
  readonly throttle: number;
  readonly result: BenchResult;
}

const SIZES: readonly number[] = [5, 15];
/** CPU slowdowns. 4x stands in for a mid-range phone; Chrome can't throttle the GPU. */
const THROTTLES: readonly number[] = [1, 4];
/** iPhone 16. */
const VIEWPORT: Readonly<Record<string, number | boolean>> = {
  width: 393,
  height: 852,
  deviceScaleFactor: 3,
  mobile: true,
};
const POLL_INTERVAL_MS: number = 100;
const TIMEOUT_MS: number = 20_000;

await main();

async function main(): Promise<void> {
  const server: ViteDevServer = await createServer({ logLevel: "error" });
  await server.listen();
  const base: string | undefined = server.resolvedUrls?.local[0];
  if (!base) throw new Error("Vite dev server has no local URL");
  const profile: string = mkdtempSync(join(tmpdir(), "crosswoven-bench-"));
  const chrome: ChildProcess = spawn(
    chromePath(),
    ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
    { stdio: "ignore" },
  );
  try {
    const devTools: DevTools = await connect(profile);
    try {
      await devTools.send("Emulation.setDeviceMetricsOverride", VIEWPORT);
      const runs: Run[] = [];
      for (const throttle of THROTTLES) {
        for (const size of SIZES) {
          const result: BenchResult = await runOnce(
            devTools,
            `${base}bench/render.html`,
            size,
            throttle,
          );
          runs.push({ throttle, result });
        }
      }
      console.log(report(runs));
    } finally {
      devTools.close();
    }
  } finally {
    const exited: Promise<unknown> = new Promise((resolve: (value: unknown) => void): void => {
      chrome.once("exit", resolve);
    });
    chrome.kill();
    await exited;
    await server.close();
    // Chrome can hold its profile files for a moment after exiting on Windows.
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

/** Each run gets a fresh page, loaded unthrottled so throttling only slows the benchmark itself. */
async function runOnce(
  devTools: DevTools,
  url: string,
  size: number,
  throttle: number,
): Promise<BenchResult> {
  await devTools.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await devTools.send("Page.navigate", { url });
  await waitFor(async (): Promise<true | undefined> => {
    const loaded: unknown = await evaluate(devTools, "typeof window.crosswovenBench");
    return loaded === "object" ? true : undefined;
  });
  await devTools.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  return (await evaluate(devTools, `window.crosswovenBench.run(${String(size)})`)) as BenchResult;
}

function chromePath(): string {
  const candidates: readonly (string | undefined)[] = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const found: string | undefined = candidates.find(
    (path: string | undefined): path is string => path !== undefined && existsSync(path),
  );
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH to a Chrome or Edge binary");
  return found;
}

/** Chrome writes the port it picked for --remote-debugging-port=0 into the profile directory. */
async function connect(profile: string): Promise<DevTools> {
  const port: string = await waitFor((): string | undefined => {
    try {
      return readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
    } catch {
      return undefined;
    }
  });
  const target: string = await waitFor(async (): Promise<string | undefined> => {
    const response: Response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets: Target[] = (await response.json()) as Target[];
    return targets.find((candidate: Target): boolean => candidate.type === "page")
      ?.webSocketDebuggerUrl;
  });

  const socket: WebSocket = new WebSocket(target);
  await new Promise<void>((resolve: () => void, reject: (error: Error) => void): void => {
    socket.addEventListener("open", (): void => {
      resolve();
    });
    socket.addEventListener("error", (): void => {
      reject(new Error(`Could not connect to ${target}`));
    });
  });
  const pending: Map<number, (reply: Reply) => void> = new Map<number, (reply: Reply) => void>();
  socket.addEventListener("message", (event: MessageEvent): void => {
    const reply: Reply = JSON.parse(String(event.data)) as Reply;
    if (reply.id === undefined) return;
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  });

  let nextId: number = 0;
  return {
    send(method: string, params: Readonly<Record<string, unknown>> = {}): Promise<unknown> {
      const id: number = ++nextId;
      return new Promise<unknown>(
        (resolve: (value: unknown) => void, reject: (error: Error) => void): void => {
          pending.set(id, (reply: Reply): void => {
            if (reply.error) reject(new Error(`${method}: ${reply.error.message}`));
            else resolve(reply.result);
          });
          socket.send(JSON.stringify({ id, method, params }));
        },
      );
    },
    close(): void {
      socket.close();
    },
  };
}

async function evaluate(devTools: DevTools, expression: string): Promise<unknown> {
  const reply: EvaluateResult = (await devTools.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })) as EvaluateResult;
  if (reply.exceptionDetails) throw new Error(`${expression}: ${reply.exceptionDetails.text}`);
  return reply.result?.value;
}

async function waitFor<T>(probe: () => T | undefined | Promise<T | undefined>): Promise<T> {
  const deadline: number = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const value: T | undefined = await probe();
    if (value !== undefined) return value;
    await new Promise((resolve: (value: unknown) => void): void => {
      setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }
  throw new Error(`Timed out after ${String(TIMEOUT_MS)} ms`);
}

function report(runs: readonly Run[]): string {
  const rows: string[] = runs.map(({ throttle, result }: Run): string =>
    [
      `${String(result.size)}×${String(result.size)}`,
      `${String(throttle)}×`,
      String(result.canvasCalls),
      result.record.toFixed(2),
      result.firstFrame.toFixed(1),
      [result.frameMedian, result.frameP90, result.frameMax]
        .map((ms: number): string => ms.toFixed(1))
        .join(" / "),
    ].join(" | "),
  );
  const largest: Run | undefined = runs.find(
    (run: Run): boolean => run.throttle === 1 && run.result.size === Math.max(...SIZES),
  );
  const breakdown: string = Object.entries(largest?.result.callsByMethod ?? {})
    .sort(([, a]: [string, number], [, b]: [string, number]): number => b - a)
    .map(([name, count]: [string, number]): string => `${name} ${String(count)}`)
    .join(", ");
  return [
    `Renderer: ${runs[0]?.result.renderer ?? "unknown"}`,
    "",
    "| Board | CPU | Canvas calls / frame | Issue commands (ms) | First frame, building tiles (ms) | Frame interval median / p90 / max (ms) |",
    "| ----- | --- | -------------------: | ------------------: | -------------------------------: | -------------------------------------: |",
    ...rows.map((row: string): string => `| ${row} |`),
    "",
    `Canvas calls per ${String(Math.max(...SIZES))}×${String(Math.max(...SIZES))} frame: ${breakdown}`,
  ].join("\n");
}
