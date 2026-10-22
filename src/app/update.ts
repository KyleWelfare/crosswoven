import { onBoard, type Point, type Puzzle } from "../core/puzzle.ts";
import { sameSolution, type Thread } from "../core/thread.ts";
import { dragTo, releasedThreads, startDrag } from "./drag.ts";
import type { Arrow, BoardKey, GameMsg, Msg } from "./messages.ts";
import { levelList, menu, nextLevel, shared, startLevel, type Game, type Model } from "./model.ts";
import { isTied } from "./tie.ts";
import {
  withCleared,
  withMuteToggled,
  withTheme,
  withTipSeen,
  withVolume,
  type Progress,
} from "./progress.ts";
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
      return model.screen === "menu" ? { ...levelList, ...shared(model) } : model;
    case "HowPuzzlesAreMadePressed":
      return model.screen === "menu"
        ? { screen: "tour", step: 0, steps: msg.steps, elapsed: 0, ...shared(model) }
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
      if (model.screen === "game") return { ...levelList, ...shared(model) };
      return model.screen === "levels" || model.screen === "tour"
        ? { ...menu, ...shared(model) }
        : model;
    case "LevelStarted":
      return startLevel(msg.puzzle, model.progress, model.levels);
    case "NextLevelPressed": {
      const next: Puzzle | undefined =
        model.screen === "game" && model.solvedFor !== undefined ? nextLevel(model) : undefined;
      return next ? startLevel(next, model.progress, model.levels) : model;
    }
    case "TipDismissed": {
      const shown: TutorialStep | undefined =
        model.screen === "game" ? currentStep(model) : undefined;
      return shown ? withProgress(model, withTipSeen(model.progress, shown.id)) : model;
    }
    case "TutorialSkipped":
      return withProgress(model, skipTutorial(model.progress));
    case "ThemeChosen":
      return withProgress(model, withTheme(model.progress, msg.theme));
    case "MuteToggled":
      return withProgress(model, withMuteToggled(model.progress));
    case "VolumeChanged":
      return withProgress(model, withVolume(model.progress, msg.channel, msg.volume));
    case "SquarePressed":
    case "SquareEntered":
    case "PointerReleased":
    case "PointerCancelled":
    case "BoardKeyPressed":
    case "BoardFocused":
    case "BoardBlurred":
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
      if (game.drag) return game;
      const picked: Game = pickUp(game, msg);
      return game.cursorShown ? { ...picked, cursorShown: false } : picked;
    }
    case "SquareEntered":
      return extend(game, msg);
    case "PointerReleased":
      return lay(game);
    case "PointerCancelled":
      return game.drag ? { ...game, drag: undefined } : game;
    case "BoardKeyPressed":
      // A key on a board pressed with the pointer shows the cursor first, so the player sees
      // where the next key acts. Keys wait while the pointer is laying a thread.
      if (!game.cursorShown) return game.drag ? game : { ...game, cursorShown: true };
      return pressKey(game, msg.key);
    case "BoardFocused":
      return game.cursorShown || game.drag ? game : { ...game, cursorShown: true };
    case "BoardBlurred":
      return game.cursorShown ? { ...game, cursorShown: false, drag: undefined } : game;
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

function pickUp(game: Game, square: Point): Game {
  if (game.drag || game.solvedFor !== undefined || !isOpen(game, square)) return game;
  const drag: Thread | undefined = startDrag(game.puzzle, game.threads, square);
  return drag ? { ...game, drag } : game;
}

function extend(game: Game, square: Point): Game {
  if (!game.drag) return game;
  const drag: Thread = dragTo(game.puzzle, game.threads, game.drag, square);
  if (drag === game.drag || !drag.squares.every((laid: Point): boolean => isOpen(game, laid))) {
    return game;
  }
  return { ...game, drag };
}

function lay(game: Game): Game {
  if (!game.drag) return game;
  return withThreads(
    { ...game, drag: undefined },
    releasedThreads(game.puzzle, game.threads, game.drag),
  );
}

const ARROWS: Readonly<Record<Arrow, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** May be off the board. */
export function squareToward(square: Point, arrow: Arrow): Point {
  return { x: square.x + ARROWS[arrow].x, y: square.y + ARROWS[arrow].y };
}

function pressKey(game: Game, key: BoardKey): Game {
  switch (key) {
    case "lay": {
      if (game.drag) return lay(game);
      const picked: Game = pickUp(game, game.cursor);
      // A peg marked 1 is a whole thread, so one press ties it, as one tap does.
      if (!picked.drag || !isTied(game.puzzle, picked.drag)) return picked;
      const laid: Game = lay(picked);
      return laid.threads === game.threads ? game : laid;
    }
    case "drop":
      return game.drag ? { ...game, drag: undefined } : game;
    case "shorten": {
      if (!game.drag) return game;
      const back: Point | undefined = game.drag.squares.at(-2);
      return back ? moveCursor(game, back) : { ...game, drag: undefined };
    }
    case "up":
    case "down":
    case "left":
    case "right":
      return moveCursor(game, squareToward(game.cursor, key));
  }
}

/** A thread being laid follows the cursor, which stops where the thread can't go. */
function moveCursor(game: Game, square: Point): Game {
  if (!onBoard(game.puzzle, square)) return game;
  if (!game.drag) return { ...game, cursor: square };
  const extended: Game = extend(game, square);
  const head: Point | undefined = extended.drag?.squares.at(-1);
  if (extended === game || head?.x !== square.x || head.y !== square.y) return game;
  return { ...extended, cursor: square };
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
