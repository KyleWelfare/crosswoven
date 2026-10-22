import type { Msg } from "../app/messages.ts";
import type { Actor, TourFrame } from "../app/tour.ts";
import { requiredElement } from "./required-element.ts";
import type { SpriteCache } from "./sprite-cache.ts";
import { drawScene, type Badge } from "./tour-scenes.ts";

export interface TourView {
  readonly canvas: HTMLCanvasElement;
  readonly timeline: HTMLElement;
  readonly badge: HTMLElement;
  readonly actor: HTMLElement;
  readonly heading: HTMLElement;
  readonly caption: HTMLElement;
  readonly legend: HTMLElement;
  readonly count: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly next: HTMLButtonElement;
}

const actorNames: Readonly<Record<Actor, string>> = {
  picture: "Picture",
  generator: "Generator",
  search: "Search solver",
  logic: "Logic solver",
  validator: "Validator",
};

export function findTour(root: ParentNode): TourView {
  return {
    canvas: requiredElement(root, "#tour-stage", HTMLCanvasElement),
    timeline: requiredElement(root, "#tour-timeline", HTMLElement),
    badge: requiredElement(root, "#tour-badge", HTMLElement),
    actor: requiredElement(root, "#tour-actor", HTMLElement),
    heading: requiredElement(root, "#tour-heading", HTMLElement),
    caption: requiredElement(root, "#tour-caption", HTMLElement),
    legend: requiredElement(root, "#tour-legend", HTMLElement),
    count: requiredElement(root, "#tour-count", HTMLElement),
    previous: requiredElement(root, "#tour-previous", HTMLButtonElement),
    next: requiredElement(root, "#tour-next", HTMLButtonElement),
  };
}

/** Built once, since the steps are fixed. */
export function buildTimeline(view: TourView, frames: readonly TourFrame[]): void {
  view.timeline.replaceChildren(
    ...frames.map((frame: TourFrame): HTMLLIElement => {
      const item: HTMLLIElement = document.createElement("li");
      item.className = "tour-entry";
      item.dataset["actor"] = frame.actor;
      const actor: HTMLSpanElement = document.createElement("span");
      actor.className = "tour-entry-actor";
      actor.textContent = actorNames[frame.actor];
      const heading: HTMLSpanElement = document.createElement("span");
      heading.className = "tour-entry-heading";
      heading.textContent = frame.heading;
      item.append(actor, heading);
      return item;
    }),
  );
}

/** The arrow keys step too; off How the Puzzles Are Made, update ignores them. */
export function listenToTour(view: TourView, dispatch: (msg: Msg) => void): void {
  view.previous.addEventListener("click", (): void => {
    dispatch({ type: "PreviousStepPressed" });
  });
  view.next.addEventListener("click", (): void => {
    dispatch({ type: "NextStepPressed" });
  });
  document.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (event.key === "ArrowRight") dispatch({ type: "NextStepPressed" });
    if (event.key === "ArrowLeft") dispatch({ type: "PreviousStepPressed" });
  });
}

/** Steps already seen stay half lit, so the timeline reads as progress through the pipeline. */
export function renderTour(
  view: TourView,
  frames: readonly TourFrame[],
  step: number,
  elapsed: number,
  sprites: SpriteCache,
): void {
  const frame: TourFrame | undefined = frames[step];
  if (!frame) return;
  const still: boolean = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const badge: Badge = drawScene(view.canvas, frame.scene, elapsed, still, sprites);
  setText(view.badge, badge);
  setText(view.actor, actorNames[frame.actor]);
  setText(view.heading, frame.heading);
  setText(view.caption, frame.caption);
  view.legend.hidden = frame.scene.kind !== "paint";
  setText(view.count, `${String(step + 1)} / ${String(frames.length)}`);
  view.previous.disabled = step === 0;
  view.next.disabled = step === frames.length - 1;
  [...view.timeline.children].forEach((item: Element, i: number): void => {
    const current: boolean = i === step;
    item.classList.toggle("is-current", current);
    item.classList.toggle("is-seen", i < step);
    if (current && item.getAttribute("aria-current") !== "step") {
      item.setAttribute("aria-current", "step");
      item.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: still ? "auto" : "smooth",
      });
    } else if (!current) {
      item.removeAttribute("aria-current");
    }
  });
}

/** Rendering runs every frame while a scene loops, so only touch text that changed. */
function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
