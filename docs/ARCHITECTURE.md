# Architecture

The app uses a model-view-update architecture. State lives in one place, changes in one place, and everything else is a pure function of it.

## Layers

| Folder        | Role                                                                                       | May import              | Touches the DOM |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------- | --------------- |
| `src/core/`   | Domain logic: physics, config decoding, validation, generation, RNG                        | nothing outside `core/` | No              |
| `src/app/`    | `Model`, `Msg`, `update`                                                                   | `core/`                 | No              |
| `src/view/`   | Draws the model to canvas and DOM; turns input events into `Msg`s                          | `app/`, `core/` types   | Yes             |
| `src/worker/` | Runs the validator off the main thread                                                     | `core/`                 | No              |
| `src/main.ts` | The runtime: holds the current model, dispatches messages, schedules renders, runs effects | everything              | Yes             |

`core/` and `app/` must run in Node with no browser, so they can be tested directly.

## Model, update, view

- **Model**: one plain-data object holding the whole app state (mode, current level, arrow setting, tries, drag state, validator results). No class instances, no functions, no DOM references. It should survive `JSON.stringify` round trips.
- **Msg**: a discriminated union of every way the state can change, e.g. `{ type: "ArrowDragged"; run: number; jump: number }`. Name messages after what happened, not what to do.
- **update**: `update(model, msg) → [model, cmds]`. Pure: no side effects, no reading the clock, no randomness, no mutation of the input. Same inputs, same output.
- **view**: renders the current model. It never changes state directly; input handlers dispatch `Msg`s and nothing else.

The loop:

```
input event → Msg → update → new Model → view renders
```

`main.ts` owns that loop: it keeps the current model, applies `update` on each dispatch, and schedules a render on the next animation frame so several messages in one frame cause one redraw.

## Stateless by default

- **No module-level mutable state.** Modules export functions and types, not variables that change. The only mutable reference to state is the current model in `main.ts`.
- **Functions take what they need and return a result.** No hidden inputs: the physics step gets the level and the arrow, the validator gets a level, the generator gets a seed.
- **Immutable updates.** `update` returns a new model and leaves the old one untouched. This makes undo, replay and test assertions trivial.
- **Randomness is explicit.** Anything random takes a seed or an RNG state as an argument and returns the next one. Never `Math.random()` in `core/` or `app/`.
- **Time is explicit.** Animation time arrives as a message (e.g. `{ type: "Tick"; dt: number }`) instead of being read inside logic.

## Effects at the edges

Anything that isn't pure happens in `main.ts` or `view/`, and its result comes back as a `Msg`:

- Animation frames, timers
- Posting levels to the validator worker and receiving results
- Clipboard, resize, device pixel ratio

`update` requests effects by returning commands alongside the new model: `update(model, msg) → [model, cmds]`. Commands are plain data, e.g. `{ type: "ValidateLevel"; level }`. `main.ts` carries them out, and any result comes back as a `Msg`. Tests can assert which commands a message produces without running them.
