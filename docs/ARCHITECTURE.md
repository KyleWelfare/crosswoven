# Architecture

The app uses a model-view-update architecture. State lives in one place, changes in one place, and everything else is a pure function of it.

## Layers

| Folder              | Role                                                                                                                                                                                                             | May import               | Touches the DOM |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------- |
| `src/core/`         | Domain logic: puzzle rules, decoding, solvers, validation, generation, RNG                                                                                                                                       | nothing outside `core/`  | No              |
| `src/app/`          | `Model`, `Msg`, `update`                                                                                                                                                                                         | `core/`                  | No              |
| `src/view/`         | Draws the model to canvas and DOM; turns input events into `Msg`s                                                                                                                                                | `app/`, `core/` types    | Yes             |
| `src/main.ts`       | The runtime: holds the current model, dispatches messages, schedules renders, runs effects                                                                                                                       | everything               | Yes             |
| `scripts/`          | The level pipeline (`npm run levels`): pictures in `pictures/`, certified levels out. Also the difficulty report (`npm run difficulty`) and the render benchmark (`npm run bench`), which drives headless Chrome | `core/`, `bench/` types  | No              |
| `bench/`            | The page the render benchmark loads: draws worst-case boards with the real view and times them                                                                                                                   | `view/`, `app/`, `core/` | Yes             |
| `src/levels/`       | Certified levels written by the pipeline, as JSON, and `order.json`, their play order                                                                                                                            | nothing: data only       | No              |
| `src/audio/`        | The music loop. CC0, credited in the README                                                                                                                                                                      | nothing: data only       | No              |
| `src/how-it-works/` | The record How the Puzzles Are Made replays, written by the pipeline as a typed module                                                                                                                           | `core/` types            | No              |

`core/` and `app/` must run in Node with no browser, so they can be tested directly.

## Model, update, view

- **Model**: one plain-data object holding the whole app state (current screen, current level, threads, drag state, hint mode, progress). It's a union on `screen`: the menu, the level list, or a level being played (`Game`), and board messages only reach a `Game`. Every screen carries the progress and the shipped levels in play order, so they follow the player between them and `update` can move from one level to the next. No class instances, no functions, no DOM references. It should survive `JSON.stringify` round trips, so compare puzzles by `id`, never by identity.
- **Msg**: a discriminated union of every way the state can change, e.g. `{ type: "SquareEntered"; x: number; y: number }`. Name messages after what happened, not what to do.
- **update**: `update(model, msg) → model`. Pure: no side effects, no reading the clock, no randomness, no mutation of the input. Same inputs, same output.
- **view**: renders the current model. It never changes state directly; input handlers dispatch `Msg`s and nothing else. A handler sends what the player did and leaves `update` to work out what it means: Next sends `NextLevelPressed`, not the next puzzle, and OK on a tip sends `TipDismissed`, not the tip. The exception is the board, whose handlers read the current puzzle to turn a pointer position into a square, since that needs the canvas layout.

The loop:

```
input event → Msg → update → new Model → view renders
```

`main.ts` owns that loop: it keeps the current model, applies `update` on each dispatch, and schedules a render on the next animation frame so several messages in one frame cause one redraw.

## Stateless by default

- **No module-level mutable state.** Modules export functions and types, not variables that change. The only mutable reference to state is the current model in `main.ts`.
- **Functions take what they need and return a result.** No hidden inputs: the solvers get a puzzle, the generator gets a picture and a seed.
- **Immutable updates.** `update` returns a new model and leaves the old one untouched. This makes undo, replay and test assertions trivial.
- **Randomness is explicit.** Anything random takes a seed. `createRng` (`src/core/rng.ts`) returns a closure that advances its own state on each call, so it stays inside the function that seeded it: the generator makes one per seed and never shares it, which keeps the generator pure from outside. Never `Math.random()` in `core/` or `app/`.
- **Time is explicit.** Animation time arrives as a message (e.g. `{ type: "Tick"; dt: number }`) instead of being read inside logic.

## What stays out of the model

State goes in the model when a message changes it or `update` reads it. A few things deliberately don't:

- **Reduced motion.** `main.ts` and the menu view read `prefers-reduced-motion` from the browser when they need it. It decides whether ticks run and how a scene is drawn, never what `update` does, so the model doesn't need it.
- **UI the browser opens and closes itself.** The sound panel is a native popover, opened and dismissed by the browser with no message involved, so whether it's open lives in the DOM. The rules dialog is in the model (`rulesOpen`) because a message opens it.
- **Which pointer drives a drag.** `listenForDrags` keeps the active pointer id so a second finger can't fork a thread. It decides which events become messages, so it belongs to the input handler rather than the game.
- **Caches and resources.** Sprite caches and the speaker's audio graph are mutable objects in the view. They hold nothing `update` depends on and can be rebuilt from the model at any time.

## Effects at the edges

Anything that isn't pure happens in `main.ts` or `view/`, and its result comes back as a `Msg`:

- Animation frames, timers
- Reading and saving progress in local storage
- Sound
- Resize, device pixel ratio

`update` stays pure and returns only the model; `main.ts` reacts to what changed. Progress is the main effect: `main.ts` loads it from local storage at start and saves it whenever `update` returns a new `progress` (`src/app/progress.ts` returns the same object when nothing changed). Blocked or full storage fails quietly, and a malformed save reads as no progress. Tests assert the progress in the model, without storage.

Sound is read off the model the same way: on each dispatch `main.ts` passes the old and new model to `soundCues` (`src/app/sound-cues.ts`), a pure function that names what's worth hearing, and `src/view/speaker.ts` plays it. A message that changes nothing makes no sound.

Screen reader narration of the board works the same way, through `narration` (`src/app/narration.ts`) into a live region (`src/view/board-narration.ts`). It also gets the message and runs before the unchanged-model early return, so a key that did nothing can say why.

If an effect ever needs its result back, or can't be read off the model, `update` grows to return `[model, cmds]`: commands as plain data, carried out by `main.ts`, with results coming back as `Msg`s.

Hints run the logic solver on the main thread. If they miss the 100 ms target in `DESIGN.md`, it moves to a Web Worker.
