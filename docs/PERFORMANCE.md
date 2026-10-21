# Performance

The targets come from `DESIGN.md`: a steady 60 fps while drawing, with a 15×15 puzzle playable on a phone.

## Render benchmark

`npm run bench` measures how much drawing the board costs. It starts the Vite dev server and headless Chrome, sizes the page like an iPhone 16 (393×852 CSS pixels at 3x), and loads `bench/render.html`. That page draws a worst-case board with the real `drawStage`: a red thread along every row and a blue one down every column, so every inner square is a crossing and every edge square holds a tied peg. A 15×15 worst case has 450 thread pieces, 169 crossings and 60 pegs, more than any real level.

Each board runs at full CPU speed and at 4× CPU throttling, which stands in for a mid-range phone. The script prints a markdown table:

| Column                            | Meaning                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Canvas calls / frame              | Every 2D context method called while drawing one frame                                                                        |
| Issue commands                    | CPU time to issue one frame's canvas commands, averaged over 100 frames. The GPU work they cause isn't included               |
| First frame, building tiles       | The first draw, which also builds the thread tiles. It happens again on resize and on a theme change                          |
| Frame interval median / p90 / max | Time between animation frames while redrawing every frame, after 20 warm-up frames. Vsync floors it at about 16.7 ms (60 fps) |

It needs Chrome or Edge. If neither is in a usual place, set `CHROME_PATH`.

Chrome can throttle the CPU but not the GPU, so the frame intervals show the GPU of the machine running the benchmark. Check GPU cost on a real phone: `npm run dev -- --host` serves the dev build on the local network.

## Results

Measured 2026-10-20 on a desktop with an AMD Radeon RX 9070 XT, before any caching of static layers.

| Board | CPU | Canvas calls / frame | Issue commands (ms) | First frame, building tiles (ms) | Frame interval median / p90 / max (ms) |
| ----- | --- | -------------------: | ------------------: | -------------------------------: | -------------------------------------: |
| 5×5   | 1×  |                  745 |                0.21 |                             34.8 |                     16.7 / 17.0 / 17.1 |
| 15×15 | 1×  |                 6065 |                1.56 |                              8.1 |                     16.7 / 16.9 / 17.0 |
| 5×5   | 4×  |                  745 |                1.04 |                             38.4 |                     16.7 / 16.9 / 17.1 |
| 15×15 | 4×  |                 6065 |                7.95 |                             23.8 |                     16.7 / 16.9 / 17.0 |

Every case holds 60 fps. The heaviest, 15×15 at 4× throttling, spends about 8 ms of the 16.7 ms frame budget issuing commands. Building tiles costs more on the 5×5 board because its squares, and so its tiles, are larger.

Canvas calls in one 15×15 frame: beginPath 796, fill 796, save 680, restore 680, translate 619, rotate 619, drawImage 619, arc 570, roundRect 226, createLinearGradient 169, fillRect 169, createRadialGradient 60, stroke 60.

## Where the frame goes

Most of each frame redraws things that only change on resize or a theme change:

- [ ] Draw the board (frame, squares, pips and the board's shadow) once into an offscreen canvas and copy it each frame. This removes about 800 fills, roundRects and arcs
- [ ] Pre-render pegs as sprites, like the thread tiles. This removes 60 blurred shadows and 60 radial gradients per frame
- [ ] Bake the crossing shadow into a tile for the thread underneath. This removes 169 gradients per frame

That leaves a frame of roughly 700 image copies. Do this when dragging lands, since that is when every frame is redrawn, and rerun the benchmark and a real-phone check afterwards.
