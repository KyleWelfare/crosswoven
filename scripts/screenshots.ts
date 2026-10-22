/**
 * Photographs every screen of the game in headless Chrome at desktop, phone portrait and phone
 * landscape size, laying real threads to reach a board partway solved and solved. Next to the
 * images it writes manifest.md, with a layout audit of each shot: overflow, small tap targets and
 * the smallest text.
 *
 * Options: --out <dir> (default screenshots), --theme light|dark|both (default light),
 * --only <name,name> to take only shots whose name contains one of these.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { createServer, type ViteDevServer } from "vite";
import { decodeLevel, type DecodeResult } from "../src/core/level-decoder.ts";
import type { Point, Puzzle } from "../src/core/puzzle.ts";
import { findSolutions, type SearchResult } from "../src/core/search-solver.ts";
import type { Thread } from "../src/core/thread.ts";
import { evaluate, load, withChrome, type DevTools } from "./chrome.ts";

type Theme = "light" | "dark";

interface Viewport {
  readonly name: string;
  readonly metrics: Readonly<Record<string, number | boolean>>;
}

interface Options {
  readonly out: string;
  readonly theme: string;
  readonly only?: string;
}

interface Shot {
  readonly name: string;
  /** Levels saved as cleared before the page loads, which unlocks the level after each. */
  readonly cleared?: readonly string[];
  readonly reach: (devTools: DevTools) => Promise<void>;
}

/** What the page reports about its own layout. See AUDIT. */
interface Audit {
  readonly overflowX: boolean;
  /** Visible screens whose content is taller than the screen, so something scrolls or clips. */
  readonly overflowingScreens: readonly string[];
  readonly smallTargets: readonly string[];
  readonly smallestText: string;
}

interface Taken {
  readonly file: string;
  readonly theme: Theme;
  readonly viewport: string;
  readonly shot: string;
  readonly audit: Audit;
}

/** Where the board's squares sit on the page, in CSS pixels. */
interface BoardGeometry {
  readonly left: number;
  readonly top: number;
  readonly cell: number;
}

const VIEWPORTS: readonly Viewport[] = [
  { name: "desktop", metrics: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false } },
  // iPhone 16, at 2x rather than 3x to keep the images small.
  { name: "portrait", metrics: { width: 393, height: 852, deviceScaleFactor: 2, mobile: true } },
  { name: "landscape", metrics: { width: 852, height: 393, deviceScaleFactor: 2, mobile: true } },
];
/** The first level, wide and short, and a 15×15, the densest board a phone has to fit. */
const FIRST_LEVEL: string = "key";
const LARGE_LEVEL: string = "sailboat";
const TALL_LEVEL: string = "rocket";
/** WIN_FADE in src/app/win.ts, with room to spare. */
const WIN_SETTLE_MS: number = 1500;
/** WCAG 2.5.5's target size. */
const MIN_TARGET_PX: number = 44;
const READY: string =
  "document.querySelector('#level-list')?.children.length > 0 && document.fonts.status === 'loaded'";

const AUDIT: string = `(() => {
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    [...el.classList].map((c) => "." + c).join("");
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 &&
    getComputedStyle(el).visibility !== "hidden"; };
  const smallTargets = [...document.querySelectorAll("button, a, [role=button]")]
    .filter(visible)
    .map((el) => [el, el.getBoundingClientRect()])
    .filter(([, r]) => r.width < ${String(MIN_TARGET_PX)} || r.height < ${String(MIN_TARGET_PX)})
    .map(([el, r]) => describe(el) + " " + Math.round(r.width) + "x" + Math.round(r.height));
  let smallest = { size: Infinity, at: "" };
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < smallest.size) smallest = { size, at: describe(el) };
  }
  return {
    overflowX: document.documentElement.scrollWidth > innerWidth,
    overflowingScreens: [...document.querySelectorAll(".screen:not([hidden])")]
      .filter((el) => el.scrollHeight > el.clientHeight + 1)
      .map((el) => describe(el) + " " + el.scrollHeight + "px in " + el.clientHeight + "px"),
    smallTargets,
    smallestText: smallest.at ? smallest.size + "px on " + smallest.at : "none",
  };
})()`;

await main();

async function main(): Promise<void> {
  const options: Options = parseArgs({
    options: {
      out: { type: "string", default: "screenshots" },
      theme: { type: "string", default: "light" },
      only: { type: "string" },
    },
  }).values;
  const themes: readonly Theme[] = chosenThemes(options.theme);
  const filters: readonly string[] = options.only?.split(",") ?? [];
  const server: ViteDevServer = await createServer({ logLevel: "error" });
  await server.listen();
  try {
    const base: string | undefined = server.resolvedUrls?.local[0];
    if (!base) throw new Error("Vite dev server has no local URL");
    const taken: Taken[] = await withChrome([], async (devTools: DevTools): Promise<Taken[]> => {
      await load(devTools, base, READY);
      const tourSteps: number = (await evaluate(
        devTools,
        "document.querySelectorAll('#tour-timeline li').length",
      )) as number;
      const shots: readonly Shot[] = allShots(tourSteps).filter(
        (shot: Shot): boolean =>
          filters.length === 0 ||
          filters.some((filter: string): boolean => shot.name.includes(filter)),
      );
      return takeAll(devTools, base, options.out, themes, shots);
    });
    writeFileSync(join(options.out, "manifest.md"), manifest(taken, options.out));
    console.log(`${String(taken.length)} screenshots in ${options.out}, listed in manifest.md`);
  } finally {
    await server.close();
  }
}

function chosenThemes(theme: string): readonly Theme[] {
  if (theme === "both") return ["light", "dark"];
  if (theme === "light" || theme === "dark") return [theme];
  throw new Error(`--theme must be light, dark or both, not ${theme}`);
}

async function takeAll(
  devTools: DevTools,
  base: string,
  out: string,
  themes: readonly Theme[],
  shots: readonly Shot[],
): Promise<Taken[]> {
  const taken: Taken[] = [];
  for (const theme of themes) {
    // Reduced motion stills the tour on each step's last frame, so shots are repeatable.
    await devTools.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: theme },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
    for (const viewport of VIEWPORTS) {
      await devTools.send("Emulation.setDeviceMetricsOverride", viewport.metrics);
      const folder: string = join(out, theme, viewport.name);
      mkdirSync(folder, { recursive: true });
      for (const shot of shots) {
        // Shots that solve a level save it, which would tick it in later shots of the level list.
        await devTools.send("Storage.clearDataForOrigin", {
          origin: new URL(base).origin,
          storageTypes: "local_storage",
        });
        if (shot.cleared) await save(devTools, base, shot.cleared);
        await load(devTools, base, READY);
        await shot.reach(devTools);
        await settle(devTools);
        const audit: Audit = (await evaluate(devTools, AUDIT)) as Audit;
        const file: string = join(folder, `${shot.name}.png`);
        const image: { readonly data: string } = (await devTools.send("Page.captureScreenshot", {
          format: "png",
        })) as { readonly data: string };
        writeFileSync(file, Buffer.from(image.data, "base64"));
        taken.push({ file, theme, viewport: viewport.name, shot: shot.name, audit });
      }
    }
  }
  return taken;
}

function allShots(tourSteps: number): readonly Shot[] {
  const order: readonly string[] = JSON.parse(
    readFileSync("src/levels/order.json", "utf8"),
  ) as string[];
  const first: Puzzle = level(FIRST_LEVEL);
  const firstSolution: readonly Thread[] = solve(first);
  const large: Puzzle = level(LARGE_LEVEL);
  const largeSolution: readonly Thread[] = solve(large);
  const open =
    (id: string): ((devTools: DevTools) => Promise<void>) =>
    async (devTools: DevTools): Promise<void> => {
      await click(devTools, "#play");
      await click(devTools, `#level-list li:nth-child(${String(order.indexOf(id) + 1)}) button`);
    };
  const before = (id: string): readonly string[] => order.slice(0, order.indexOf(id));
  return [
    { name: "01-menu", reach: async (): Promise<void> => {} },
    {
      name: "02-rules",
      reach: async (devTools: DevTools): Promise<void> => {
        await open(FIRST_LEVEL)(devTools);
        await click(devTools, "#how-to-play");
      },
    },
    {
      name: "03-levels",
      // Some cleared, the next open and the rest locked, so every kind of tile shows.
      cleared: order.slice(0, 3),
      reach: async (devTools: DevTools): Promise<void> => {
        await click(devTools, "#play");
      },
    },
    { name: "04-game-start", reach: open(FIRST_LEVEL) },
    {
      name: "05-game-partway",
      reach: async (devTools: DevTools): Promise<void> => {
        await open(FIRST_LEVEL)(devTools);
        await lay(devTools, first, half(firstSolution));
      },
    },
    {
      name: "06-game-solved",
      reach: async (devTools: DevTools): Promise<void> => {
        await open(FIRST_LEVEL)(devTools);
        await lay(devTools, first, firstSolution);
        await pause(WIN_SETTLE_MS);
      },
    },
    {
      name: "07-game-large-partway",
      cleared: before(LARGE_LEVEL),
      reach: async (devTools: DevTools): Promise<void> => {
        await open(LARGE_LEVEL)(devTools);
        await lay(devTools, large, half(largeSolution));
      },
    },
    { name: "08-game-tall", cleared: before(TALL_LEVEL), reach: open(TALL_LEVEL) },
    ...Array.from({ length: tourSteps }, (_: unknown, step: number): Shot => ({
      name: `${String(9 + step).padStart(2, "0")}-tour-step-${String(step + 1)}`,
      reach: async (devTools: DevTools): Promise<void> => {
        await click(devTools, "#how-puzzles-are-made");
        for (let i: number = 0; i < step; i++) await click(devTools, "#tour-next");
      },
    })),
  ];
}

/** Storage belongs to the page's origin, so a page has to be open to write it. */
async function save(devTools: DevTools, base: string, cleared: readonly string[]): Promise<void> {
  await load(devTools, base, READY);
  const progress: string = JSON.stringify({ cleared, tipsSeen: [] });
  await evaluate(
    devTools,
    `localStorage.setItem("crosswoven:progress", ${JSON.stringify(progress)})`,
  );
}

function level(id: string): Puzzle {
  const decoded: DecodeResult = decodeLevel(
    JSON.parse(readFileSync(join("src", "levels", `${id}.json`), "utf8")),
  );
  if (!decoded.ok) throw new Error(`${id}: ${decoded.errors.join("; ")}`);
  return decoded.puzzle;
}

function solve(puzzle: Puzzle): readonly Thread[] {
  const result: SearchResult = findSolutions(puzzle, 1);
  const solution: readonly Thread[] | undefined = result.ok ? result.solutions[0] : undefined;
  if (!solution) throw new Error(`${puzzle.id} has no solution`);
  return solution;
}

function half(threads: readonly Thread[]): readonly Thread[] {
  return threads.slice(0, Math.ceil(threads.length / 2));
}

async function click(devTools: DevTools, selector: string): Promise<void> {
  const found: unknown = await evaluate(
    devTools,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el?.click(); return Boolean(el); })()`,
  );
  if (found !== true) throw new Error(`Nothing to click at ${selector}`);
  await settle(devTools);
}

/** Drags each thread from its first square to its last, as a player would. */
async function lay(devTools: DevTools, puzzle: Puzzle, threads: readonly Thread[]): Promise<void> {
  const board: BoardGeometry = (await evaluate(
    devTools,
    `(async () => {
      const { canvasLayout } = await import("/src/view/board-layout.ts");
      const canvas = document.querySelector("#stage");
      const layout = canvasLayout(canvas, { width: ${String(puzzle.width)}, height: ${String(puzzle.height)} });
      const bounds = canvas.getBoundingClientRect();
      return { left: bounds.left + layout.left / layout.ratio, top: bounds.top + layout.top / layout.ratio, cell: layout.cell / layout.ratio };
    })()`,
  )) as BoardGeometry;
  for (const thread of threads) {
    const points: Point[] = thread.squares.map((square: Point): Point => ({
      x: board.left + (square.x + 0.5) * board.cell,
      y: board.top + (square.y + 0.5) * board.cell,
    }));
    const start: Point | undefined = points[0];
    const end: Point | undefined = points.at(-1);
    if (!start || !end) continue;
    await mouse(devTools, "mousePressed", start);
    for (const point of points.slice(1)) await mouse(devTools, "mouseMoved", point);
    await mouse(devTools, "mouseReleased", end);
  }
  await settle(devTools);
}

async function mouse(devTools: DevTools, type: string, at: Point): Promise<void> {
  await devTools.send("Input.dispatchMouseEvent", {
    type,
    x: at.x,
    y: at.y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : 1,
    clickCount: 1,
  });
}

/** Two animation frames, since the game renders on the frame after a message. */
async function settle(devTools: DevTools): Promise<void> {
  await evaluate(
    devTools,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });
}

/** Paths are relative to `out`, where the manifest sits. */
function manifest(taken: readonly Taken[], out: string): string {
  const lines: string[] = [
    "# Screenshots",
    "",
    `Small targets are under ${String(MIN_TARGET_PX)}×${String(MIN_TARGET_PX)} CSS pixels. Viewports: ${VIEWPORTS.map((viewport: Viewport): string => `${viewport.name} ${String(viewport.metrics["width"])}×${String(viewport.metrics["height"])}`).join(", ")}.`,
    "",
    "| Theme | Viewport | Shot | File | Horizontal overflow | Screen overflow | Small targets | Smallest text |",
    "| ----- | -------- | ---- | ---- | ------------------- | --------------- | ------------- | ------------- |",
  ];
  for (const { file, theme, viewport, shot, audit } of taken) {
    lines.push(
      `| ${[
        theme,
        viewport,
        shot,
        relative(out, file).replaceAll("\\", "/"),
        audit.overflowX ? "yes" : "",
        audit.overflowingScreens.join("; "),
        audit.smallTargets.join("; "),
        audit.smallestText,
      ].join(" | ")} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}
