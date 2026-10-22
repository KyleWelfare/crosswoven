---
name: perf-check
description: Runs the render benchmark on the screens that redraw every frame (the game board and every step of How the Puzzles Are Made), compares the numbers with the last recorded results, finds the code behind anything slow or regressed, and suggests concrete fixes. Use when asked to check performance, benchmark, profile, or see whether a drawing change made anything slower.
argument-hint: "[board | tour | empty for both]"
context: fork
agent: general-purpose
model: claude-opus-5-5
allowed-tools: Read, Grep, Glob, Bash(npm run bench:*), Bash(git:*)
---

# Performance check

Suites to run: `$ARGUMENTS` (empty means both).

Do not edit code or docs. Measure, analyze, and report. The user decides what to change and whether the new numbers go into `docs/PERFORMANCE.md`.

## Why these screens

Only two things in the game draw every frame, so they are where frame rate can suffer:

- **Board** (`bench/render.ts`): a worst-case 5×5 and 15×15 board on the real `drawStage`. It stands in for the game screen while dragging and during the win fade
- **Tour** (`bench/tour.ts`): every step of How the Puzzles Are Made, sampled across one full loop of its animation. That screen redraws every frame for as long as it is open, even when nobody touches it

The menu, level list and the game between moves are static DOM and only redraw on a message, so they are not benchmarked.

## Steps

1. Read `docs/PERFORMANCE.md` all the way through: the targets, what each column means, and the latest results table for each suite. Those tables are the baseline
2. Run `npm run bench -- $ARGUMENTS` with a 10 minute timeout. Both suites take about four minutes. Keep the full output
3. If a number looks out of line with the baseline, run that suite once more before you report it. These are single runs, and anything that moves between two runs is noise
4. Compile the comparison (below), then trace each problem to its code (below that)

## Reading the numbers

Budget: 16.7 ms a frame (60 fps), on a phone.

| Signal                       | Threshold                          | Meaning                                                                                           |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Frame interval p90 or max    | Over about 20 ms in a CPU-only row | Dropped frames. The CPU-only rows are the honest ones, since their raster runs on the main thread |
| Issue commands, throttled 4× | Over 8 ms, half the budget         | Not dropping frames yet, but little headroom left on a real phone                                 |
| Issue commands max (tour)    | Much higher than the mean          | Something gets rebuilt mid-loop: sprites, or the board image when the puzzle changes              |
| First frame                  | Over 100 ms, throttled             | Six or more dropped frames when a level or tour step opens                                        |
| Canvas calls / frame         | Any change from the baseline       | Call counts are deterministic, so any change comes from the code, not noise. Explain every change |

Known noise, which is not a finding:

- The very first run of the whole benchmark (GPU 5×5) includes cold start, so its first-frame time is inflated
- First-frame times move by a few milliseconds, sometimes tens of milliseconds, between runs
- On this machine, headless Chrome with a GPU paces frames at about 17.5 ms even for trivial work. If the GPU rows sit at about 17.5 while the CPU-only rows sit at 16.7, that is frame pacing, not drawing cost

## Tracing a problem to code

The bench measures canvas drawing in isolation. For each finding, read the code that runs per frame and name what is responsible:

- `src/view/stage.ts` `drawStage`: the board image, woven squares, thread tiles, crossings and pegs
- `src/view/sprite-cache.ts`: what invalidates sprites (`setGeneration` key: square size, pixel ratio, palette) and the board (`cachedBoard` key: puzzle id and stage size). A key that changes every frame or every step rebuilds everything
- `src/view/tour-scenes.ts`: the overlays drawn on top of each scene (`outline`, `ghost`, `popRings`) are drawn with paths every frame, not sprites. Each one calls `canvasLayout` and `cssColour`, which read layout and computed style
- `src/view/palette.ts` `readPalette`: `getComputedStyle` on every frame
- `src/view/tour.ts` `renderTour`: DOM work each tour frame. The bench does not cover it
- `src/main.ts`: the render loop, and when ticking starts and stops

Use `git log --oneline -- src/view` to find recent drawing changes when a number has regressed.

## Not measured

Say so in the report when it matters. The bench does not cover:

- DOM and style work outside the canvas: `renderTour` updating the timeline and text each frame, `scrollIntoView`, the level list
- Pointer input latency while dragging
- Real phones and weak GPUs. Chrome can throttle the CPU, not the GPU, and CPU-only raster stands in for a weak GPU

If a concern sits in an unmeasured area, describe how to measure it, for example a new bench page or a Performance trace, instead of guessing at a number.

## Suggestions

Make each suggestion concrete:

- **What**: the change, at `file:line`
- **Why**: the measured number it targets, quoted from the output
- **Expected effect**: which row and column should move, and roughly how far
- **Cost**: code complexity, memory, or first-frame time it trades away

Rank them by measured impact. Do not suggest optimizing something that is already well within budget just because it could be faster. If everything holds 60 fps with headroom, say so plainly and keep the suggestions to anything that regressed or is close to a threshold.

## Report

1. **Verdict**: one or two sentences. Does every screen hold 60 fps on the throttled CPU-only setup, and did anything regress?
2. **Results**: the bench's tables as printed, then a short comparison table listing only the rows that changed meaningfully from the baseline (baseline, now, delta)
3. **Findings**: each over a threshold or regressed, with its cause in code
4. **Suggestions**: ranked, in the format above
5. **Not measured**: anything relevant the bench couldn't see
6. Offer to record the new results in `docs/PERFORMANCE.md`
