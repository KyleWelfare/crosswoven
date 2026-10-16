# Design

Decisions for version one. Architecture lives in `ARCHITECTURE.md`, testing in `TESTING.md`.

## The game

A character runs along platforms and jumps automatically at each platform's edge. Before the run, the player sets one launch arrow for the whole level: its horizontal leg is **run speed**, its vertical leg is **jump speed**. One setting has to clear every gap. Gravity comes from the level's **planet**.

The lesson: horizontal and vertical motion are independent. Jump speed alone sets the height (`h = jump² / 2g`), run speed only stretches the arc sideways, and jump length needs both (`d = run · 2·jump / g`).

### Play

- Drag the arrow's tip to change both speeds, or one leg to change only that one. The arrow snaps to the level's snap positions. Keyboard: arrow keys adjust, Space jumps
- A dotted preview shows the arc up to its first peak, labelled with the height. The rest of the run is left to reasoning
- Pressing Jump plays the run. Each try leaves a ghost trail; the last five are kept
- When a run fails, a hint names how it failed (see Results)
- After clearing a level, the solution map is revealed with the player's attempts plotted on it

### Levels

Five hand-made levels, one idea each, unlocked in order:

| Level             | Constraint                             | What it teaches                                       |
| ----------------- | -------------------------------------- | ----------------------------------------------------- |
| 1 · Gap           | One flat gap, jump speed locked        | Run speed stretches the same jump further             |
| 2 · Short landing | Narrow landing platform                | You aim for a range, not a threshold                  |
| 3 · Ledge         | A higher platform, jump speed unlocked | Only jump speed sets the height, and it counts twice  |
| 4 · Ceiling       | A block caps the peak                  | Height is capped; make up the distance with run speed |
| 5 · Planets       | The same layout on Moon and Jupiter    | Gravity scales the whole arc                          |

Progress (cleared or not, try count per level) is saved in local storage. No accounts, scores or ratings. No sound in version one.

### Design mode

- Move, resize, add and remove platforms and ceilings. Everything snaps to 10 units
- Switch planet
- On every change the validator reruns and shows the verdict, each check's result, the solution map coloured by failure type, and one example solution drawn on the level
- Undo and redo (Ctrl+Z / Ctrl+Shift+Z and buttons)
- Copy the level as JSON. Paste a level in; it goes through the decoder and shows readable errors if it's invalid
- The working level is saved in local storage
- "Play this level" switches to Play mode. Rejected levels can be played, with a banner saying which check failed. Hand-made and generated levels are always valid

Arrow ranges and steps aren't editable in the UI, only in the config.

### Look

Graph-paper notebook: grid paper, ink platforms and ceilings, a bright character and arc, dimension labels on gaps and ledges. Works in light and dark themes.

## The level config

The config is the API used by designers, a content agent or a tutor. It's versioned JSON with named fields.

```json
{
  "version": 1,
  "id": "ceiling",
  "world": { "width": 800, "height": 360 },
  "planet": "earth",
  "platforms": [
    { "x": 0, "width": 170, "top": 60 },
    { "x": 300, "width": 80, "top": 60 },
    { "x": 500, "width": 60, "top": 140 },
    { "x": 680, "width": 120, "top": 60 }
  ],
  "ceilings": [{ "x": 380, "width": 120, "bottom": 210 }],
  "arrow": {
    "runSpeed": { "min": 120, "max": 320, "step": 10 },
    "jumpSpeed": { "min": 300, "max": 700, "step": 20 }
  }
}
```

- **Units:** world units, units/s and units/s². y points up from the bottom of the world
- **World:** every level is 800×360 for now. The size is in the config so variable sizes later don't need a format change
- **Planets:** `moon` (g = 700), `earth` (1300), `jupiter` (2100). Scaled for play, not real ratios
- **Arrow:** defaults are run speed 120–320 step 10 and jump speed 300–700 step 20, giving 441 snap positions. A level may override them. A locked speed is a range with `min` equal to `max`; its leg is drawn greyed with a lock and can't be dragged
- **Flag:** placed on the last platform, a fixed distance from its right edge
- **Ceilings** extend from `bottom` to the top of the world

### Decoder rules

The decoder turns unknown JSON into a `Level` or a list of readable errors. It rejects:

- Missing fields, wrong types, unknown planet, unsupported version
- Anything outside the world
- Platforms out of left-to-right order or overlapping
- Platforms narrower than the minimum width
- A first platform that doesn't start at the left edge or is too short to start on
- A last platform too short to hold the flag
- Ceilings overlapping platforms
- Arrow ranges with `min > max`, a step that doesn't divide the range, or a non-positive step

Errors name the problem and the piece: "platform 3 overlaps platform 2".

## Physics

- One `simulate(level, run, jump)`, used by both the game and the validator, so they can't disagree
- Fixed timestep of 1/240 s. Runs are capped at 10 s
- The character is an 18×18 box, so what you see is what collides
- It starts near the left of the first platform and runs at run speed. When its box passes a platform's right edge it jumps with jump speed, and gravity pulls it down

### Results

| Result      | When                                                       |
| ----------- | ---------------------------------------------------------- |
| Cleared     | Reaches the flag on the last platform                      |
| Hit ceiling | The box touches a ceiling                                  |
| Hit ledge   | The box hits a platform's side before landing on top       |
| Fell short  | Drops below the world before reaching the next platform    |
| Flew past   | Drops below the world after passing over the next platform |

Each failure has one built-in hint. Hints aren't configurable per level.

## Validation

Every input a player can give is a snap position, so the validator simulates all of them. Its verdict is exact, not an estimate.

A level **ships** when all three checks pass:

| Check       | Rule                                                    |
| ----------- | ------------------------------------------------------- |
| Solvable    | At least 1 snap position clears it                      |
| Fair margin | At least 4 clear it, so nobody hunts for a single pixel |
| Not trivial | At most 25% clear it, so the setting matters            |

Thresholds live in one place so they're easy to tune.

The validator also returns the result for every snap position (for the solution map), a breakdown of failures by type, and one example solution near the middle of the clearing region.

In Design mode it runs in a Web Worker. If the level changes while a validation is running, only the latest result is used.

### Difficulty

Difficulty is the share of snap positions that clear the level:

| Band   | Share                             |
| ------ | --------------------------------- |
| Easy   | 15–25%                            |
| Medium | 5–15%                             |
| Hard   | 1–5% (still at least 4 positions) |

### Solution map

A grid of every arrow setting: run speed across, jump speed up. Clearing settings are highlighted; failed settings are coloured by failure type, so the map shows the physics (a ceiling appears as a band across the top, short and past in opposite corners).

## Generator

Seeded, so the same seed always gives the same level. Given a difficulty band, it picks a planet, platform count, gaps, heights and an optional ceiling from seeded ranges, validates the result, and keeps it if it ships and lands in the band. Otherwise it tries again.

The generator is in version one because it drives the main property test. An endless-mode screen built on it can be cut.

## Targets

- Desktop and phones, mouse and touch. On phones in portrait the stage shrinks and the panels stack below it
- Steady 60 fps while dragging and animating on a mid-range phone
- The solution map updates within about 100 ms of a change in Design mode

## Stretch goals

- Endless mode
- Suggested fixes for rejected levels in Design mode ("raise the ceiling 20 units")
- Sound
- Variable world sizes
