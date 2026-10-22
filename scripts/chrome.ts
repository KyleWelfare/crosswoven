/** Headless Chrome driven over the DevTools protocol, for the scripts that measure or photograph pages. */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface DevTools {
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

const POLL_INTERVAL_MS: number = 100;
const TIMEOUT_MS: number = 20_000;

/** Launches a fresh headless Chrome with `flags`, hands `use` its page, and always cleans up. */
export async function withChrome<T>(
  flags: readonly string[],
  use: (devTools: DevTools) => Promise<T>,
): Promise<T> {
  const profile: string = mkdtempSync(join(tmpdir(), "crosswoven-chrome-"));
  const browser: ChildProcess = spawn(
    chromePath(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      ...flags,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    const devTools: DevTools = await connect(profile);
    try {
      return await use(devTools);
    } finally {
      devTools.close();
    }
  } finally {
    // If Chrome already died, its exit event has fired and won't come again.
    if (browser.exitCode === null && browser.signalCode === null) {
      const exited: Promise<unknown> = new Promise((resolve: (value: unknown) => void): void => {
        browser.once("exit", resolve);
      });
      browser.kill();
      await exited;
    }
    // Chrome can hold its profile files for a moment after exiting on Windows.
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
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
      // Chrome may not have finished writing the file yet.
      return readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0] || undefined;
    } catch {
      return undefined;
    }
  });
  const target: string = await waitFor(async (): Promise<string | undefined> => {
    try {
      const response: Response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets: Target[] = (await response.json()) as Target[];
      return targets.find((candidate: Target): boolean => candidate.type === "page")
        ?.webSocketDebuggerUrl;
    } catch {
      return undefined;
    }
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

export async function evaluate(devTools: DevTools, expression: string): Promise<unknown> {
  const reply: EvaluateResult = (await devTools.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })) as EvaluateResult;
  if (reply.exceptionDetails) throw new Error(`${expression}: ${reply.exceptionDetails.text}`);
  return reply.result?.value;
}

/** Navigates and waits until `ready` evaluates truthy in the page. */
export async function load(devTools: DevTools, url: string, ready: string): Promise<void> {
  await devTools.send("Page.navigate", { url });
  await waitFor(async (): Promise<true | undefined> =>
    (await evaluate(devTools, `Boolean(${ready})`)) === true ? true : undefined,
  );
}

export async function waitFor<T>(probe: () => T | undefined | Promise<T | undefined>): Promise<T> {
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
