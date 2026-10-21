import { sameSolution, type Thread } from "../core/thread.ts";
import { dragTo, releasedThreads, startDrag } from "./drag.ts";
import type { Msg } from "./messages.ts";
import { startLevel, type Model } from "./model.ts";
import { isFading, isSolved, WIN_FADE } from "./win.ts";

/** Returns `model` itself when nothing changed, so the runtime can skip the redraw. */
// TODO: return [model, cmds] as docs/ARCHITECTURE.md describes, once the first command
// (SaveProgress) arrives.
export function update(model: Model, msg: Msg): Model {
  switch (msg.type) {
    case "SquarePressed": {
      if (model.drag || model.solvedFor !== undefined) return model;
      const drag: Thread | undefined = startDrag(model.puzzle, model.threads, msg);
      return drag ? { ...model, drag } : model;
    }
    case "SquareEntered": {
      if (!model.drag) return model;
      const drag: Thread = dragTo(model.puzzle, model.threads, model.drag, msg);
      return drag === model.drag ? model : { ...model, drag };
    }
    case "PointerReleased":
      if (!model.drag) return model;
      return withThreads(
        { ...model, drag: undefined },
        releasedThreads(model.puzzle, model.threads, model.drag),
      );
    case "PointerCancelled":
      return model.drag ? { ...model, drag: undefined } : model;
    case "UndoPressed": {
      const previous: readonly Thread[] | undefined = model.history.at(-1);
      if (!previous || !isEditable(model)) return model;
      return { ...model, threads: previous, history: model.history.slice(0, -1) };
    }
    case "ClearPressed":
      return isEditable(model) ? withThreads(model, []) : model;
    case "LevelStarted":
      return startLevel(msg.puzzle);
    case "Tick":
      if (!isFading(model)) return model;
      return { ...model, solvedFor: Math.min((model.solvedFor ?? 0) + msg.dt, WIN_FADE) };
  }
}

/** A solved board is locked, and one mid-drag waits for the drag to finish. */
function isEditable(model: Model): boolean {
  return model.solvedFor === undefined && model.drag === undefined;
}

/** Keeps the board it replaces for Undo, unless nothing changed, and starts the win once solved. */
function withThreads(model: Model, threads: readonly Thread[]): Model {
  if (sameSolution(threads, model.threads)) return model;
  return {
    ...model,
    threads,
    history: [...model.history, model.threads],
    solvedFor: isSolved(model.puzzle, threads) ? 0 : undefined,
  };
}
