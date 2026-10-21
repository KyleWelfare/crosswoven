import type { ThreadColour } from "../core/puzzle.ts";

interface Crossing {
  readonly angle: number;
  readonly over: number;
}

const strandColours: readonly ThreadColour[] = ["red", "yellow", "blue"];

/** SVG user units, which the stylesheet maps one to one onto CSS pixels. */
const WIDTH: number = 96;
const HEIGHT: number = 14;
const END_PADDING: number = 2;
const AMPLITUDE: number = 4.5;

const PERIODS: number = 2.5;
const SAMPLES_PER_PERIOD: number = 32;
/** Radians either side of a crossing over which the top strand is redrawn. */
const PATCH_HALF_ANGLE: number = 0.45;

const LAST_ANGLE: number = 2 * Math.PI * PERIODS;

/** Fills the SVG with a three-strand plait, one strand per thread colour. */
export function drawBraid(svg: SVGSVGElement): void {
  svg.setAttribute("viewBox", `0 0 ${String(WIDTH)} ${String(HEIGHT)}`);
  const phases: readonly number[] = [...strandColours.keys()].map(
    (i: number): number => (2 * Math.PI * i) / strandColours.length,
  );
  strandColours.forEach((colour: ThreadColour, i: number): void => {
    svg.append(strandPath(`braid-strand braid-${colour}`, phases[i] ?? 0, 0, LAST_ANGLE));
  });
  for (const crossing of crossings(phases)) {
    const phase: number = phases[crossing.over] ?? 0;
    const colour: ThreadColour = strandColours[crossing.over] ?? "red";
    const from: number = Math.max(0, crossing.angle - PATCH_HALF_ANGLE);
    const to: number = Math.min(LAST_ANGLE, crossing.angle + PATCH_HALF_ANGLE);
    svg.append(
      strandPath("braid-gap", phase, from, to),
      strandPath(`braid-strand braid-${colour}`, phase, from, to),
    );
  }
}

/**
 * Where each pair of strands meets, and which goes over. The strand heading towards the centre
 * line goes over, which makes every strand alternate over and under like a real plait.
 */
function crossings(phases: readonly number[]): Crossing[] {
  const found: Crossing[] = [];
  phases.forEach((a: number, i: number): void => {
    phases.forEach((b: number, j: number): void => {
      if (j <= i) return;
      // sin(θ + a) = sin(θ + b) where θ + a = π - (θ + b), every half turn.
      for (let angle: number = (Math.PI - a - b) / 2; angle < LAST_ANGLE; angle += Math.PI) {
        if (angle <= 0) continue;
        found.push({ angle, over: isNearingCentre(angle + a) ? i : j });
      }
    });
  });
  return found;
}

function isNearingCentre(angle: number): boolean {
  return Math.sin(angle) * Math.cos(angle) < 0;
}

function strandPath(className: string, phase: number, from: number, to: number): SVGPathElement {
  const samples: number = Math.max(
    2,
    Math.ceil(((to - from) / (2 * Math.PI)) * SAMPLES_PER_PERIOD),
  );
  const commands: string[] = [];
  for (let k: number = 0; k <= samples; k++) {
    const angle: number = from + ((to - from) * k) / samples;
    const x: number = END_PADDING + (angle / LAST_ANGLE) * (WIDTH - 2 * END_PADDING);
    const y: number = HEIGHT / 2 - AMPLITUDE * Math.sin(angle + phase);
    commands.push(`${k === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const path: SVGPathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", className);
  path.setAttribute("d", commands.join(" "));
  return path;
}
