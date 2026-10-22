import { startLevel, type Game } from "../app/model.ts";
import type { RecapStage, Scene, StepScene } from "../app/tour.ts";
import { WIN_FADE } from "../app/win.ts";
import type { Peg, Point, Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { canvasLayout, squareOrigin, type BoardLayout } from "./board-layout.ts";
import type { SpriteCache } from "./sprite-cache.ts";
import { drawStage } from "./stage.ts";
import { easeInOutCubic, easeOutBack, easeOutCubic, progress, pulse } from "./tween.ts";

/** Milliseconds each kind of scene takes before it loops, holding its end for the last stretch. */
const LOOPS: Readonly<Record<StepScene["kind"], number>> = {
  paint: 4600,
  lay: 4800,
  compare: 6400,
  split: 4600,
  search: 6000,
  deduce: 5200,
  reveal: 4800,
};

/** The recap plays each step this many times faster, then holds on the certified picture. */
const RECAP_SPEED: number = 2.5;
const RECAP_HOLD: number = 2400;

/** Fractions of a square. */
const OUTLINE_WIDTH: number = 0.07;
const OUTLINE_RADIUS: number = 0.14;
const GHOST_WIDTH: number = 0.16;

/** What the scene says about itself at this moment, shown above the board. */
export type Badge = string;

/**
 * Draws a scene `time` milliseconds into its loop on the real board renderer, then whatever the
 * scene adds on top: outlines, ghost paths, pegs popping in. `still` draws the end of the loop,
 * for players who ask for less motion.
 */
export function drawScene(
  canvas: HTMLCanvasElement,
  scene: Scene,
  elapsed: number,
  still: boolean,
  sprites: SpriteCache,
): Badge {
  const time: number = sceneTime(scene, elapsed, still);
  if (scene.kind === "recap") {
    const moment: RecapMoment | undefined = recapMoment(scene.stages, time);
    if (!moment) return "";
    drawScene(canvas, moment.stage.scene, moment.time, false, sprites);
    return `${String(moment.step + 1)} · ${moment.stage.heading}`;
  }
  switch (scene.kind) {
    case "paint":
      return paint(canvas, scene, time, sprites);
    case "lay":
      return lay(canvas, scene, time, sprites);
    case "compare":
      return compare(canvas, scene, time, sprites);
    case "split":
      return split(canvas, scene, time, sprites);
    case "search":
      return search(canvas, scene, time, sprites);
    case "deduce":
      return deduce(canvas, scene, time, sprites);
    case "reveal":
      return reveal(canvas, scene, time, sprites);
  }
}

/** The step the recap is replaying at this moment, so the timeline can light it. */
export function echoedStep(scene: Scene, elapsed: number, still: boolean): number | undefined {
  if (scene.kind !== "recap") return undefined;
  return recapMoment(scene.stages, sceneTime(scene, elapsed, still))?.step;
}

function sceneTime(scene: Scene, elapsed: number, still: boolean): number {
  const loop: number = scene.kind === "recap" ? recapLoop(scene.stages) : LOOPS[scene.kind];
  return still ? loop - 1 : elapsed % loop;
}

function recapLoop(stages: readonly RecapStage[]): number {
  return (
    stages.reduce(
      (sum: number, stage: RecapStage): number => sum + LOOPS[stage.scene.kind] / RECAP_SPEED,
      0,
    ) + RECAP_HOLD
  );
}

interface RecapMoment {
  readonly step: number;
  readonly stage: RecapStage;
  /** Into the stage's own loop. */
  readonly time: number;
}

/** Past the last stage the recap holds on that stage's final frame. */
function recapMoment(stages: readonly RecapStage[], time: number): RecapMoment | undefined {
  let start: number = 0;
  for (const [step, stage] of stages.entries()) {
    const loop: number = LOOPS[stage.scene.kind];
    const end: number = start + loop / RECAP_SPEED;
    if (time < end) return { step, stage, time: (time - start) * RECAP_SPEED };
    start = end;
  }
  const last: RecapStage | undefined = stages.at(-1);
  return last && { step: stages.length - 1, stage: last, time: LOOPS[last.scene.kind] - 1 };
}

/** The picture fills in square by square, in reading order. */
function paint(
  canvas: HTMLCanvasElement,
  scene: Extract<Scene, { kind: "paint" }>,
  time: number,
  sprites: SpriteCache,
): Badge {
  const { width, height }: Puzzle = scene.puzzle;
  const filled: number = Math.round(width * height * easeInOutCubic(progress(time, 300, 2800)));
  // At a full fade only the woven squares show, and they only need the right threads present.
  const shown: readonly Thread[] = scene.threads.map((thread: Thread): Thread => ({
    colour: thread.colour,
    squares: thread.squares.filter(
      (square: Point): boolean => square.y * width + square.x < filled,
    ),
  }));
  draw(canvas, { ...scene.puzzle, pegs: [] }, shown, WIN_FADE, sprites);
  return "A picture";
}

/** Threads grow out of their pegs one after another, and each peg pops in as its thread starts. */
function lay(
  canvas: HTMLCanvasElement,
  scene: Extract<Scene, { kind: "lay" }>,
  time: number,
  sprites: SpriteCache,
): Badge {
  const stagger: number = 2400 / Math.max(scene.threads.length, 1);
  const started: Thread[] = [];
  const grown: Thread[] = [];
  const pops: { readonly at: Point; readonly age: number }[] = [];
  scene.threads.forEach((thread: Thread, i: number): void => {
    const start: number = 300 + i * stagger;
    const fraction: number = easeOutCubic(progress(time, start, 700));
    if (time < start) return;
    started.push(thread);
    grown.push(grownThread(thread, fraction));
    for (const end of ends(thread)) pops.push({ at: end, age: time - start });
  });
  draw(canvas, withPegsAt(scene.puzzle, started), grown, undefined, sprites);
  popRings(canvas, scene.puzzle, pops);
  return `${String(grown.length)} of ${String(scene.threads.length)} threads laid`;
}

/** One solution unweaves where the two differ and reweaves as the other, back and forth. */
function compare(
  canvas: HTMLCanvasElement,
  scene: Extract<Scene, { kind: "compare" }>,
  time: number,
  sprites: SpriteCache,
): Badge {
  const { shared, onlyFirst, onlySecond }: Extract<Scene, { kind: "compare" }> = scene;
  // Hold the first, swap to the second, hold it, swap back.
  const toSecond: number =
    easeInOutCubic(progress(time, 1100, 900)) - easeInOutCubic(progress(time, 4300, 900));
  const unweaving: readonly Thread[] =
    toSecond < 0.5
      ? onlyFirst.map((thread: Thread): Thread => grownThread(thread, 1 - toSecond * 2))
      : onlySecond.map((thread: Thread): Thread => grownThread(thread, toSecond * 2 - 1));
  draw(canvas, scene.puzzle, [...shared, ...unweaving], undefined, sprites);
  outline(canvas, scene.puzzle, scene.differ, 0.45 + 0.55 * pulse(time, 1600));
  return toSecond < 0.5 ? "Solution 1 of 2" : "Solution 2 of 2";
}

/** The thread to cut pulses, then snaps into two pieces with a new peg at each cut end. */
function split(
  canvas: HTMLCanvasElement,
  scene: Extract<Scene, { kind: "split" }>,
  time: number,
  sprites: SpriteCache,
): Badge {
  const cutAt: number = 1600;
  if (time < cutAt) {
    draw(canvas, scene.before, [...scene.kept, ...scene.cut], undefined, sprites);
    outline(canvas, scene.before, squaresOf(scene.cut), 0.35 + 0.65 * pulse(time, 800));
    return "Cutting this thread";
  }
  // Every piece's ends pop, even where a peg was already: its number changes.
  const newPegs: readonly Point[] = scene.pieces.flatMap(ends);
  draw(canvas, scene.after, [...scene.kept, ...scene.pieces], undefined, sprites);
  popRings(
    canvas,
    scene.after,
    newPegs.map((at: Point): { at: Point; age: number } => ({ at, age: time - cutAt })),
  );
  outline(canvas, scene.after, squaresOf(scene.pieces), 1 - progress(time, cutAt + 600, 1200));
  return `${String(scene.cut.length)} thread becomes ${String(scene.pieces.length)}`;
}

/** The search flickers through every possible path, then the one weave that works locks in. */
function search(
  canvas: HTMLCanvasElement,
  scene: Extract<Scene, { kind: "search" }>,
  time: number,
  sprites: SpriteCache,
): Badge {
  const scanEnd: number = 3400;
  const count: number = scene.candidates.length;
  if (time < scanEnd) {
    const position: number = (progress(time, 200, scanEnd - 200) * count) | 0;
    draw(canvas, scene.puzzle, [], undefined, sprites, "by-thread");
    // The current path and a faint trace of the one before, so the eye follows without clutter.
    for (let back: number = 0; back < 2; back++) {
      const candidate: Thread | undefined = scene.candidates[position - back];
      if (candidate) ghost(canvas, scene.puzzle, candidate, back === 0 ? 0.9 : 0.2);
    }
    return `Weighing route ${String(Math.min(position + 1, count))} of ${String(count)}`;
  }
  const fraction: number = easeOutCubic(progress(time, scanEnd, 1000));
  draw(
    canvas,
    scene.puzzle,
    scene.solution.map((thread: Thread): Thread => grownThread(thread, fraction)),
    undefined,
    sprites,
    "by-thread",
  );
  return "Exactly 1 solution";
}

/** The paths a round rules out flash and fade, then the threads it settles grow in. */
function deduce(
  canvas: HTMLCanvasElement,
  scene: Extract<Scene, { kind: "deduce" }>,
  time: number,
  sprites: SpriteCache,
): Badge {
  const fadeEnd: number = scene.ruledOut.length > 0 ? 1800 : 300;
  const fraction: number = easeOutCubic(progress(time, fadeEnd, 1000));
  const settled: readonly Thread[] = scene.settled.map((thread: Thread): Thread =>
    grownThread(thread, fraction),
  );
  draw(
    canvas,
    scene.puzzle,
    [...scene.known, ...(fraction > 0 ? settled : [])],
    undefined,
    sprites,
    "by-thread",
  );
  const stagger: number = 1200 / Math.max(scene.ruledOut.length, 1);
  scene.ruledOut.forEach((thread: Thread, i: number): void => {
    const start: number = 200 + i * stagger;
    // Each path clears as the next arrives, so they never pile up on top of each other.
    const shown: number = progress(time, start, 150) - progress(time, start + stagger, 150);
    if (shown > 0) ghost(canvas, scene.puzzle, thread, 0.85 * shown);
  });
  outline(canvas, scene.puzzle, squaresOf(scene.settled), progress(time, fadeEnd + 800, 400));
  if (time < fadeEnd && scene.ruledOut.length > 0) {
    const count: number = scene.ruledOut.length;
    return `${String(count)} ${count === 1 ? "route" : "routes"} crossed off`;
  }
  return `${String(scene.settled.length)} settled`;
}

/** The threads fade back, as when a level is won, to leave the picture. */
function reveal(
  canvas: HTMLCanvasElement,
  scene: Extract<Scene, { kind: "reveal" }>,
  time: number,
  sprites: SpriteCache,
): Badge {
  const fade: number = easeInOutCubic(progress(time, 900, 1500));
  draw(canvas, scene.puzzle, scene.threads, fade * WIN_FADE, sprites);
  return fade < 1 ? "Woven" : "Certified";
}

/** Pegs stay filled while threads grow and shrink, unless a step is about threads settling. */
function draw(
  canvas: HTMLCanvasElement,
  puzzle: Puzzle,
  threads: readonly Thread[],
  solvedFor: number | undefined,
  sprites: SpriteCache,
  pegs: "by-thread" | "tied" = "tied",
): void {
  const game: Game = { ...startLevel(puzzle), threads, solvedFor };
  drawStage(canvas, game, sprites, pegs);
}

/** A thread drawn from its first peg, `fraction` of the way to its second. */
function grownThread(thread: Thread, fraction: number): Thread {
  const count: number = Math.max(1, Math.ceil(thread.squares.length * fraction));
  return { colour: thread.colour, squares: thread.squares.slice(0, count) };
}

/** Only the pegs of threads that have started, so pegs arrive with their threads. */
function withPegsAt(puzzle: Puzzle, threads: readonly Thread[]): Puzzle {
  const shown: readonly Point[] = threads.flatMap(ends);
  return {
    ...puzzle,
    pegs: puzzle.pegs.filter((peg: Peg): boolean =>
      shown.some((point: Point): boolean => samePoint(point, peg)),
    ),
  };
}

function popRings(
  canvas: HTMLCanvasElement,
  puzzle: Puzzle,
  pops: readonly { readonly at: Point; readonly age: number }[],
): void {
  const { context, layout }: Overlay = overlay(canvas, puzzle);
  if (!context) return;
  context.strokeStyle = cssColour(canvas, "--ink");
  for (const { at, age } of pops) {
    const t: number = progress(age, 0, 500);
    if (t <= 0 || t >= 1) continue;
    const centre: Point = squareCentre(layout, at);
    context.globalAlpha = 1 - t;
    context.lineWidth = Math.max(layout.ratio, 0.08 * layout.cell * (1 - t));
    context.beginPath();
    context.arc(centre.x, centre.y, layout.cell * (0.25 + 0.45 * easeOutBack(t)), 0, 2 * Math.PI);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function outline(
  canvas: HTMLCanvasElement,
  puzzle: Puzzle,
  squares: readonly Point[],
  alpha: number,
): void {
  const { context, layout }: Overlay = overlay(canvas, puzzle);
  if (!context || alpha <= 0 || squares.length === 0) return;
  const width: number = Math.max(layout.ratio, OUTLINE_WIDTH * layout.cell);
  context.globalAlpha = alpha;
  context.strokeStyle = cssColour(canvas, "--ink");
  context.lineWidth = width;
  for (const square of squares) {
    const origin: Point = squareOrigin(layout, square);
    context.beginPath();
    context.roundRect(
      origin.x + width / 2,
      origin.y + width / 2,
      layout.cell - width,
      layout.cell - width,
      OUTLINE_RADIUS * layout.cell,
    );
    context.stroke();
  }
  context.globalAlpha = 1;
}

/** A path the solvers are weighing: a translucent line in its colour, not a laid thread. */
function ghost(canvas: HTMLCanvasElement, puzzle: Puzzle, thread: Thread, alpha: number): void {
  const { context, layout }: Overlay = overlay(canvas, puzzle);
  if (!context || alpha <= 0) return;
  context.globalAlpha = alpha;
  context.strokeStyle = cssColour(canvas, `--thread-${thread.colour}`);
  context.lineWidth = GHOST_WIDTH * layout.cell;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([layout.cell * 0.22, layout.cell * 0.18]);
  context.beginPath();
  thread.squares.forEach((square: Point, i: number): void => {
    const centre: Point = squareCentre(layout, square);
    if (i === 0) context.moveTo(centre.x, centre.y);
    else context.lineTo(centre.x, centre.y);
  });
  if (thread.squares.length === 1) {
    const centre: Point = squareCentre(layout, thread.squares[0] ?? { x: 0, y: 0 });
    context.lineTo(centre.x + 0.01, centre.y);
  }
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;
}

interface Overlay {
  readonly context: CanvasRenderingContext2D | null;
  readonly layout: BoardLayout;
}

/** drawStage leaves the transform at identity, so overlays draw in device pixels too. */
function overlay(canvas: HTMLCanvasElement, puzzle: Puzzle): Overlay {
  const layout: BoardLayout = canvasLayout(canvas, puzzle);
  return { context: layout.cell < 1 ? null : canvas.getContext("2d"), layout };
}

function squareCentre(layout: BoardLayout, square: Point): Point {
  const origin: Point = squareOrigin(layout, square);
  return { x: origin.x + layout.cell / 2, y: origin.y + layout.cell / 2 };
}

function cssColour(canvas: HTMLCanvasElement, name: string): string {
  return getComputedStyle(canvas).getPropertyValue(name).trim();
}

function ends(thread: Thread): Point[] {
  const first: Point | undefined = thread.squares[0];
  const last: Point | undefined = thread.squares.at(-1);
  if (!first || !last) return [];
  return samePoint(first, last) ? [first] : [first, last];
}

function squaresOf(threads: readonly Thread[]): readonly Point[] {
  return threads.flatMap((thread: Thread): readonly Point[] => thread.squares);
}

function samePoint(a: Point | undefined, b: Point | undefined): boolean {
  return a !== undefined && b !== undefined && a.x === b.x && a.y === b.y;
}
