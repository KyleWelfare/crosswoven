import type { Point } from "../core/puzzle.ts";
import { sameSolution, type Thread } from "../core/thread.ts";
import { dragTo, releasedThreads, startDrag } from "./drag.ts";
import type { GameMsg, Msg } from "./messages.ts";
import { levelList, menu, startLevel, type Game, type Model } from "./model.ts";
import { withCleared, withTheme, withTipSeen, type Progress } from "./progress.ts";
import {
  advanceTutorial,
  currentStep,
  inWindow,
  skipTutorial,
  type TutorialStep,
} from "./tutorial.ts";
import { isFading, isSolved, WIN_FADE } from "./win.ts";

/** Returns `model` itself when nothing changed, so the runtime can skip the redraw. */
export function update(model: Model, msg: Msg): Model {
  switch (msg.type) {
    case "PlayPressed":
      return model.screen === "menu" ? { ...levelList, progress: model.progress } : model;
    case "HowPuzzlesAreMadePressed":
      return model.screen === "menu"
        ? { screen: "tour", step: 0, steps: msg.steps, elapsed: 0, progress: model.progress }
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
      if (model.screen === "game") return { ...levelList, progress: model.progress };
      return model.screen === "levels" || model.screen === "tour"
        ? { ...menu, progress: model.progress }
        : model;
    case "LevelStarted":
      return startLevel(msg.puzzle, model.progress);
    case "TipSeen":
      return withProgress(model, withTipSeen(model.progress, msg.tip));
    case "TutorialSkipped":
      return withProgress(model, skipTutorial(model.progress));
    case "ThemeChosen":
      return withProgress(model, withTheme(model.progress, msg.theme));
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

function withProgress(model: Model, progress: Progress): Model {
  return progress === model.progress ? model : { ...model, progress };
}

function updateGame(game: Game, msg: GameMsg): Game {
  switch (msg.type) {
    case "SquarePressed": {
      if (game.drag || game.solvedFor !== undefined || !isOpen(game, msg)) return game;
      const drag: Thread | undefined = startDrag(game.puzzle, game.threads, msg);
      return drag ? { ...game, drag } : game;
    }
    case "SquareEntered": {
      if (!game.drag) return game;
      const drag: Thread = dragTo(game.puzzle, game.threads, game.drag, msg);
      if (
        drag === game.drag ||
        !drag.squares.every((square: Point): boolean => isOpen(game, square))
      ) {
        return game;
      }
      return { ...game, drag };
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

/**
 * A solved board is locked, one mid-drag waits for the drag to finish, and a tutorial step keeps
 * the board as the step left it.
 */
function isEditable(game: Game): boolean {
  return game.solvedFor === undefined && game.drag === undefined && !currentStep(game);
}

/** A tutorial step opens only its window; a tip that's read and dismissed opens nothing. */
function isOpen(game: Game, square: Point): boolean {
  const step: TutorialStep | undefined = currentStep(game);
  return !step || inWindow(step, square);
}

/**
 * Keeps the board it replaces for Undo, unless nothing changed, moves the tutorial on, and starts
 * the win and clears the level once solved.
 */
function withThreads(game: Game, threads: readonly Thread[]): Game {
  if (sameSolution(threads, game.threads)) return game;
  const changed: Game = advanceTutorial({
    ...game,
    threads,
    history: [...game.history, game.threads],
  });
  if (!isSolved(game.puzzle, threads)) return changed;
  return { ...changed, solvedFor: 0, progress: withCleared(changed.progress, game.puzzle.id) };
}
