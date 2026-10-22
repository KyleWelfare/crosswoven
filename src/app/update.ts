import { sameSolution, type Thread } from "../core/thread.ts";
import { dragTo, releasedThreads, startDrag } from "./drag.ts";
import type { GameMsg, Msg } from "./messages.ts";
import { levelList, menu, startLevel, type Game, type Model } from "./model.ts";
import { isFading, isSolved, WIN_FADE } from "./win.ts";

/** Returns `model` itself when nothing changed, so the runtime can skip the redraw. */
// TODO: return [model, cmds] as docs/ARCHITECTURE.md describes, once the first command
// (SaveProgress) arrives.
export function update(model: Model, msg: Msg): Model {
  switch (msg.type) {
    case "PlayPressed":
      return model.screen === "menu" ? levelList : model;
    case "HowPuzzlesAreMadePressed":
      return model.screen === "menu"
        ? { screen: "tour", step: 0, steps: msg.steps, elapsed: 0 }
        : model;
    case "NextStepPressed":
      return model.screen === "tour" && model.step < model.steps - 1
        ? { ...model, step: model.step + 1, elapsed: 0 }
        : model;
    case "PreviousStepPressed":
      return model.screen === "tour" && model.step > 0
        ? { ...model, step: model.step - 1, elapsed: 0 }
        : model;
    case "BackPressed":
      if (model.screen === "game") return levelList;
      return model.screen === "levels" || model.screen === "tour" ? menu : model;
    case "LevelStarted":
      return startLevel(msg.puzzle);
    case "SquarePressed":
    case "SquareEntered":
    case "PointerReleased":
    case "PointerCancelled":
    case "UndoPressed":
    case "ClearPressed":
    case "HowToPlayPressed":
    case "RulesClosed":
      return model.screen === "game" ? updateGame(model, msg) : model;
    case "Tick":
      if (model.screen === "tour" || model.screen === "menu") {
        return { ...model, elapsed: model.elapsed + msg.dt };
      }
      return model.screen === "game" ? updateGame(model, msg) : model;
  }
}

function updateGame(game: Game, msg: GameMsg): Game {
  switch (msg.type) {
    case "SquarePressed": {
      if (game.drag || game.solvedFor !== undefined) return game;
      const drag: Thread | undefined = startDrag(game.puzzle, game.threads, msg);
      return drag ? { ...game, drag } : game;
    }
    case "SquareEntered": {
      if (!game.drag) return game;
      const drag: Thread = dragTo(game.puzzle, game.threads, game.drag, msg);
      return drag === game.drag ? game : { ...game, drag };
    }
    case "PointerReleased":
      if (!game.drag) return game;
      return withThreads(
        { ...game, drag: undefined },
        releasedThreads(game.puzzle, game.threads, game.drag),
      );
    case "PointerCancelled":
      return game.drag ? { ...game, drag: undefined } : game;
    case "UndoPressed": {
      const previous: readonly Thread[] | undefined = game.history.at(-1);
      if (!previous || !isEditable(game)) return game;
      return { ...game, threads: previous, history: game.history.slice(0, -1) };
    }
    case "ClearPressed":
      return isEditable(game) ? withThreads(game, []) : game;
    case "HowToPlayPressed":
      return game.rulesOpen ? game : { ...game, rulesOpen: true };
    case "RulesClosed":
      return game.rulesOpen ? { ...game, rulesOpen: false } : game;
    case "Tick":
      if (!isFading(game)) return game;
      return { ...game, solvedFor: Math.min((game.solvedFor ?? 0) + msg.dt, WIN_FADE) };
  }
}

/** A solved board is locked, and one mid-drag waits for the drag to finish. */
function isEditable(game: Game): boolean {
  return game.solvedFor === undefined && game.drag === undefined;
}

/** Keeps the board it replaces for Undo, unless nothing changed, and starts the win once solved. */
function withThreads(game: Game, threads: readonly Thread[]): Game {
  if (sameSolution(threads, game.threads)) return game;
  return {
    ...game,
    threads,
    history: [...game.history, game.threads],
    solvedFor: isSolved(game.puzzle, threads) ? 0 : undefined,
  };
}
