# Performance

The targets come from `DESIGN.md`: a steady 60 fps while drawing, with a 15×15 puzzle playable on a phone.

## Render benchmark

`npm run bench` measures how much drawing the board costs. It starts the Vite dev server and headless Chrome, sizes the page like an iPhone 16 (393×852 CSS pixels at 3x), and loads `bench/render.html`. That page draws a worst-case board with the real `drawStage`: a red thread along every row and a blue one down every column, so every inner square is a crossing and every edge square holds a tied peg. A 15×15 worst case has 450 thread pieces, 169 crossings and 60 pegs, more than any real level.

Every board runs in two Chrome setups, each at full CPU speed and at 4× CPU throttling:

- **GPU**: Chrome's normal accelerated canvas
- **CPU only**: GPU off, so the canvas rasterises in software on the main thread. This is how Chrome draws on a device whose GPU driver it has blocklisted, and it stands in for a weak GPU, since Chrome can throttle the CPU but not the GPU. Because software raster runs on the main thread, throttling slows it too

The 4× throttle is generous to old hardware: a budget Chromebook or a 2017 phone is more like 5 to 8 times slower per core than the desktop these numbers come from.

| Column                            | Meaning                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Canvas calls / frame              | Every 2D context method called while drawing one frame                                                                        |
| Issue commands                    | CPU time to issue one frame's canvas commands, averaged over 100 frames. The raster work they cause isn't included            |
| First frame, building tiles       | The first draw, which also builds every sprite. It happens again on resize and on a theme change                              |
| Frame interval median / p90 / max | Time between animation frames while redrawing every frame, after 20 warm-up frames. Vsync floors it at about 16.7 ms (60 fps) |

## Tour benchmark

`npm run bench` also plays every step of How the Puzzles Are Made, from `bench/tour.html`, in the same Chrome setups and at the same phone size. That screen redraws every frame for as long as it is open, and each frame of a step draws something different, so each step is sampled at 120 moments spread evenly across one loop of its animation. The page copies the tour's markup and fills in each step's heading and caption, so the canvas gets its real size.

| Column                            | Meaning                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas calls / frame              | Averaged over the sampled frames                                                                                                       |
| Issue commands mean / max         | CPU time for one frame, including the style and layout reads it forces. The max catches sprites built mid-loop as threads first appear |
| First frame                       | The step's first draw, which builds the board and whatever sprites its opening moment needs                                            |
| Frame interval median / p90 / max | As for the board                                                                                                                       |

`npm run bench -- board` or `npm run bench -- tour` runs one suite.

It needs Chrome or Edge. If neither is in a usual place, set `CHROME_PATH`. To try a real device, `npm run dev -- --host` serves the dev build on the local network.

## Results

Measured 2026-10-20 on a desktop with an AMD Radeon RX 9070 XT. Single runs, so expect a few milliseconds of noise, most of all in the first-frame column.

### Before: drawing everything every frame

Each frame filled every square, pip and peg with canvas paths, blurred the board's and every peg's shadow, built a gradient for each crossing, and drew each thread tile through a rotate transform.

| Raster   | Board | CPU | Canvas calls / frame | Issue commands (ms) | First frame, building tiles (ms) | Frame interval median / p90 / max (ms) |
| -------- | ----- | --- | -------------------: | ------------------: | -------------------------------: | -------------------------------------: |
| GPU      | 5×5   | 1×  |                  745 |                0.22 |                             31.2 |                     16.7 / 16.9 / 17.0 |
| GPU      | 15×15 | 1×  |                 6065 |                1.59 |                              7.8 |                     16.7 / 16.8 / 17.1 |
| GPU      | 5×5   | 4×  |                  745 |                1.03 |                             38.5 |                     16.7 / 17.0 / 17.2 |
| GPU      | 15×15 | 4×  |                 6065 |                7.30 |                             23.3 |                     16.7 / 16.9 / 17.1 |
| CPU only | 5×5   | 1×  |                  745 |                0.22 |                             12.3 |                     16.7 / 16.7 / 16.8 |
| CPU only | 15×15 | 1×  |                 6065 |                1.54 |                              5.0 |                     16.7 / 33.3 / 33.4 |
| CPU only | 5×5   | 4×  |                  745 |                1.04 |                             36.1 |                     83.3 / 83.4 / 99.9 |
| CPU only | 15×15 | 4×  |                 6065 |                7.29 |                             22.2 |                  100.0 / 100.0 / 116.7 |

With a GPU every case held 60 fps, but CPU-only raster at 4× fell to 10 to 12 fps. The 5×5 board was almost as slow as the 15×15, so the cost was pixels rather than calls: the canvas is about 1,083 × 1,083 device pixels and all of it was repainted from paths and blurs every frame. Switching parts off at 15×15, 4× throttled, put about 34 ms on the board alone, 60 ms on the rotated thread tiles and 33 ms on blurred shadows.

### After: copying cached sprites

The board is now laid out in device pixels and drawn from sprites that are rebuilt only when the square size or palette changes, and the board image also when the level or stage size does:

- [x] The board (frame, squares and the board's shadow) is one offscreen canvas, copied once per frame
- [x] Thread tiles are cached in all four quarter turns, so each copy lands on whole pixels with no transform or resampling
- [x] Each crossing is one tile holding both threads and the shadow between them
- [x] Pegs are sprites, so their shadows and gradients are drawn once

| Raster   | Board | CPU | Canvas calls / frame | Issue commands (ms) | First frame, building tiles (ms) | Frame interval median / p90 / max (ms) |
| -------- | ----- | --- | -------------------: | ------------------: | -------------------------------: | -------------------------------------: |
| GPU      | 5×5   | 1×  |                   64 |                0.08 |                             73.7 |                     16.7 / 17.0 / 17.1 |
| GPU      | 15×15 | 1×  |                  344 |                0.33 |                             10.6 |                     16.7 / 17.0 / 17.1 |
| GPU      | 5×5   | 4×  |                   64 |                0.38 |                             40.7 |                     16.7 / 17.0 / 17.2 |
| GPU      | 15×15 | 4×  |                  344 |                1.57 |                             25.0 |                     16.7 / 17.0 / 17.2 |
| CPU only | 5×5   | 1×  |                   64 |                0.09 |                             22.6 |                     16.7 / 16.7 / 16.8 |
| CPU only | 15×15 | 1×  |                  344 |                0.36 |                             12.3 |                     16.7 / 16.7 / 16.8 |
| CPU only | 5×5   | 4×  |                   64 |                0.45 |                             80.2 |                     16.7 / 16.7 / 33.3 |
| CPU only | 15×15 | 4×  |                  344 |                1.78 |                             51.0 |                     16.7 / 16.7 / 16.8 |

Every case now holds 60 fps, including CPU-only raster at 4× throttling, which went from 100 ms to 16.7 ms a frame. A 15×15 frame is 342 image copies, down from 6,065 canvas calls, and issuing it takes 1.6 ms instead of 7.3 ms on the throttled CPU.

The cost moved to the first frame, which now builds the board image, the rotated tiles, the crossing tiles and the peg sprites: up to about 80 ms on a throttled CPU-only device. That is a single dropped frame or two on load, rotation or a theme change. The GPU 5×5 first frame of 73.7 ms is the first run of the whole benchmark and includes cold start.

### Woven squares

Squares whose threads match the pattern switch to a stronger colour, so the picture fills in as the player weaves. Each frame works out which squares are woven (`wovenSquares` in `src/app/weave.ts`) and copies a cached stronger tile over each one. The worst case weaves every square, adding 225 copies to a 15×15 frame.

| Raster   | Board | CPU | Canvas calls / frame | Issue commands (ms) | First frame, building tiles (ms) | Frame interval median / p90 / max (ms) |
| -------- | ----- | --- | -------------------: | ------------------: | -------------------------------: | -------------------------------------: |
| GPU      | 5×5   | 1×  |                   89 |                0.17 |                             79.2 |                     16.7 / 16.8 / 17.0 |
| GPU      | 15×15 | 1×  |                  569 |                0.49 |                             10.7 |                     16.7 / 16.9 / 17.0 |
| GPU      | 5×5   | 4×  |                   89 |                0.58 |                             47.9 |                     16.7 / 16.8 / 17.1 |
| GPU      | 15×15 | 4×  |                  569 |                3.07 |                             31.6 |                     16.7 / 16.9 / 17.0 |
| CPU only | 5×5   | 1×  |                   89 |                0.11 |                             22.1 |                     16.7 / 16.7 / 16.8 |
| CPU only | 15×15 | 1×  |                  569 |                0.54 |                             11.9 |                     16.7 / 16.7 / 16.8 |
| CPU only | 5×5   | 4×  |                   89 |                0.70 |                             89.3 |                     16.7 / 16.7 / 16.8 |
| CPU only | 15×15 | 4×  |                  569 |                3.33 |                             66.4 |                     16.7 / 16.7 / 16.8 |

Every case still holds 60 fps. Issuing a throttled 15×15 frame now takes about 3.3 ms of the 16.7 ms budget, almost all of it the extra copies: counting threads per square in flat typed arrays instead of a map per square made no measurable difference.

### How the Puzzles Are Made

Measured 2026-10-21 on the same desktop. Every step holds 60 fps in every setup. The slowest setup, CPU-only raster at 4× throttling:

| Step                         | Scene   | Canvas calls / frame | Issue commands mean / max (ms) | First frame (ms) | Frame interval median / p90 / max (ms) |
| ---------------------------- | ------- | -------------------: | -----------------------------: | ---------------: | -------------------------------------: |
| 1. Start from a picture      | paint   |                   27 |                    0.25 / 0.80 |             44.5 |                     16.7 / 16.7 / 16.8 |
| 2. Lay threads               | lay     |                   82 |                    0.67 / 1.50 |             42.4 |                     16.7 / 16.7 / 16.8 |
| 3. Find a second solution    | compare |                  138 |                    0.84 / 1.60 |             97.0 |                     16.7 / 16.7 / 16.8 |
| 4. Split a thread            | split   |                  123 |                    0.84 / 1.60 |             96.9 |                     16.7 / 16.7 / 16.8 |
| 5. Exactly one solution      | search  |                   71 |                    0.62 / 1.60 |             50.8 |                     16.7 / 16.7 / 16.8 |
| 6. The obvious threads first | deduce  |                  132 |                    0.70 / 1.40 |             48.4 |                     16.7 / 16.8 / 16.8 |
| 7. Pegs with one partner     | deduce  |                  104 |                    0.76 / 1.50 |             91.1 |                     16.7 / 16.7 / 16.8 |
| 8. Squares a thread must use | deduce  |                  120 |                    0.84 / 1.60 |             97.3 |                     16.7 / 16.7 / 16.8 |
| 9. Certified                 | reveal  |                   78 |                    0.56 / 1.40 |             96.0 |                     16.7 / 16.7 / 16.8 |
| 10. Start to finish          | recap   |                   93 |                    0.69 / 1.40 |             44.0 |                     16.7 / 16.7 / 16.8 |

The tour board is 7×7, so a frame takes well under a millisecond of the 16.7 ms budget even when throttled. The cost is in a step's first frame: up to about 97 ms where its opening moment already shows crossings, which drops a frame or two as the player presses Next. In this run the GPU setups read a frame interval median of about 17.5 ms, on the board suite too. That comes from headless Chrome's frame pacing on this machine, not from drawing.

## Open

- [ ] Check frame rate on a real low-end phone or Chromebook once one is available
- [ ] If dragging ever needs more headroom, redraw only the squares that changed instead of the whole board
