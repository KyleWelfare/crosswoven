import type { Msg } from "../app/messages.ts";
import type { Point, Puzzle } from "../core/puzzle.ts";
import { canvasLayout, squareAt } from "./board-layout.ts";

/**
 * Turns presses and drags on the board into messages, for mouse, pen and touch alike. Only the
 * first pointer down drives a drag, so a second finger can't fork the thread being laid.
 */
export function listenForDrags(
  canvas: HTMLCanvasElement,
  currentPuzzle: () => Puzzle,
  dispatch: (msg: Msg) => void,
): void {
  let active: number | undefined;
  const square = (event: PointerEvent): Point => {
    const bounds: DOMRect = canvas.getBoundingClientRect();
    const ratio: number = window.devicePixelRatio;
    return squareAt(canvasLayout(canvas, currentPuzzle()), {
      x: (event.clientX - bounds.left) * ratio,
      y: (event.clientY - bounds.top) * ratio,
    });
  };
  const finish = (event: PointerEvent, msg: Msg): void => {
    if (event.pointerId !== active) return;
    active = undefined;
    dispatch(msg);
  };

  canvas.addEventListener("pointerdown", (event: PointerEvent): void => {
    if (active !== undefined || event.button !== 0) return;
    active = event.pointerId;
    // Touch captures implicitly, but a mouse would stop sending moves once it left the canvas.
    canvas.setPointerCapture(event.pointerId);
    dispatch({ type: "SquarePressed", ...square(event) });
  });
  canvas.addEventListener("pointermove", (event: PointerEvent): void => {
    if (event.pointerId === active) dispatch({ type: "SquareEntered", ...square(event) });
  });
  canvas.addEventListener("pointerup", (event: PointerEvent): void => {
    finish(event, { type: "PointerReleased" });
  });
  canvas.addEventListener("pointercancel", (event: PointerEvent): void => {
    finish(event, { type: "PointerCancelled" });
  });
  canvas.addEventListener("lostpointercapture", (event: PointerEvent): void => {
    finish(event, { type: "PointerCancelled" });
  });
}
