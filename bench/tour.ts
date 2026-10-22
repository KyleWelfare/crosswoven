import "@fontsource-variable/figtree";
import "@fontsource-variable/fraunces/soft.css";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/layout.css";
import "../src/styles/menu.css";
import "../src/styles/tour.css";
import { tourFrames, type TourFrame } from "../src/app/tour.ts";
import { tourRecord } from "../src/how-it-works/record.ts";
import { requiredElement } from "../src/view/required-element.ts";
import { createSpriteCache, type SpriteCache } from "../src/view/sprite-cache.ts";
import { drawScene, sceneLoop } from "../src/view/tour-scenes.ts";
import {
  countCanvasCalls,
  frameIntervals,
  percentile,
  renderer,
  timed,
  totalCalls,
} from "./measurement.ts";
import type { TourBench, TourStepResult } from "./result.ts";

/** Frames sampled evenly across one loop of a step. */
const SAMPLES: number = 120;
const WARM_UP_FRAMES: number = 20;

const frames: readonly TourFrame[] = tourFrames(tourRecord);
const bench: TourBench = { steps: (): number => frames.length, run };
window.crosswovenBench = bench;

async function run(step: number): Promise<TourStepResult> {
  const frame: TourFrame | undefined = frames[step];
  if (!frame) throw new Error(`No tour step ${String(step)}`);
  await document.fonts.ready;
  const canvas: HTMLCanvasElement = requiredElement(document, "#tour-stage", HTMLCanvasElement);
  requiredElement(document, "#tour-heading", HTMLElement).textContent = frame.heading;
  requiredElement(document, "#tour-caption", HTMLElement).textContent = frame.caption;
  const badge: HTMLElement = requiredElement(document, "#tour-badge", HTMLElement);
  const sprites: SpriteCache = createSpriteCache();
  const spacing: number = sceneLoop(frame.scene) / SAMPLES;
  const draw = (sample: number): void => {
    const text: string = drawScene(canvas, frame.scene, sample * spacing, false, sprites);
    if (badge.textContent !== text) badge.textContent = text;
  };

  const firstFrame: number = timed((): void => {
    draw(0);
  });
  const callsByMethod: Record<string, number> = perFrame(
    countCanvasCalls((): void => {
      for (let i: number = 0; i < SAMPLES; i++) draw(i);
    }),
  );
  const records: number[] = [];
  for (let i: number = 0; i < SAMPLES; i++) {
    records.push(
      timed((): void => {
        draw(i);
      }),
    );
  }
  await frameIntervals(draw, WARM_UP_FRAMES);
  const intervals: number[] = await frameIntervals(draw, SAMPLES);

  return {
    step,
    heading: frame.heading,
    scene: frame.scene.kind,
    renderer: renderer(),
    canvasCalls: totalCalls(callsByMethod),
    callsByMethod,
    firstFrame,
    recordMean: records.reduce((sum: number, ms: number): number => sum + ms, 0) / SAMPLES,
    recordMax: Math.max(...records),
    frameMedian: percentile(intervals, 0.5),
    frameP90: percentile(intervals, 0.9),
    frameMax: Math.max(...intervals),
  };
}

function perFrame(counts: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).map(([name, count]: [string, number]): [string, number] => [
      name,
      count / SAMPLES,
    ]),
  );
}
