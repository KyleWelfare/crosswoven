# Crosswoven

A logic puzzle in the browser. Lay coloured threads between pegs so the woven cloth matches a pattern. Where two threads cross, their colours mix, and the finished cloth is a pixel-art picture.

Every puzzle is generated from a picture and certified by a validator: exactly one solution, reachable by deduction alone.

## How it's built

- **Levels are generated, then proven.** I draw each picture as a small text grid. A seeded generator covers it with threads and puts numbered pegs at their ends. A search solver proves the puzzle has exactly one solution, and a logic solver proves a player can reach it by deduction alone, without guessing. Where two solutions differ, the generator splits threads there and tries again. CI regenerates every shipped level, so a solver change can't silently alter one.
- **Two independent solvers check each other.** Property tests run thousands of random puzzles: the search solver never misses or invents a solution, the logic solver only ever deduces what's true, and both always agree.
- **Model-view-update.** Game state is one plain object, changed only by a pure `update` function, so undo is a list of past boards and every rule is unit tested without a browser. The board is a canvas drawn from cached sprites, benchmarked (`npm run bench`) to hold 60 fps on a worst-case 15×15 board at phone size, even with the GPU off and the CPU throttled 4×, where the first version managed 10.

More in [docs/](docs/): design, architecture, testing, performance and accessibility.

## What playtesting taught me

The first pack of 16 levels played too easy, and got boring. So I set out to measure why.

**Measuring difficulty.** The usual rating, "the hardest rule the solver needed", said almost nothing. I added a solve profile (`npm run difficulty`): how many pegs the board gives away (only one possible path), how many could pair more than one way, and how many rounds of deduction the solve takes. On 13 of the 16 levels, 69% or more of the pegs were given away, and every level solved in 3 rounds or fewer.

**Turning the dials.** The generator now aims each level at a target number of rounds, keeping the best of 30 seeds, so the pack rises in difficulty instead of landing wherever the first seed fell. Two levers proved to matter:

- Giving nearby threads the same number gives pegs rival partners. On broad pictures it took the hardest reachable puzzle from 4 rounds to 12, but on thin outlines it barely moved, because a thin shape leaves one route however the numbers fall.
- Crossings were the surprise. A two-colour square fixes both of its threads, so a band of crossings is read, not solved. Crossings only joined the puzzle when many threads crossed a thin band and carried on into open space, and not in consecutive rows: crossings stacked row after row run straight like the rungs of a ladder. A redrawn, broken reflection fixed one level that a playtest showed was solved at a glance.

**Modelling an expert.** Rounds measure the solver's proof, and a player skips a proof whenever the obvious move is right. So I modelled what an experienced player sees without thinking: moves into traps, moves that leave no matching number in reach, squares that only one thread could fill. A property test checks the model is never wrong. By its rules, 20 of the 22 levels needed no real deduction at all. I could still generate a puzzle needing 9 rounds of real deduction, but it was a plain red disc with no colour mixing: hard, and dull.

**The diagnosis.** The board shows every square's colour, and that pins each thread to its colour's region before the player starts. PathPix, the genre's best-known game, hides the picture: only the numbered pegs show, and the picture appears when solved. My colour mixing was meant to make the genre feel new, but showing the colours took away the space where the puzzle lives.

## What I prototyped next

Hide the picture. Show only the pegs, plus a mark on each two-colour square saying which two colours cross there. Every other square becomes open field, and the picture appears when solved.

It's working on the `hidden-picture` branch, and the architecture took it with less change than I expected. The generator still lays threads over a picture, and the validator still proves uniqueness, now against only what the player sees. Both modes share one slot model: an unmarked hidden square is a single slot any colour can fill, and both solvers stay an exact-cover search. Every shipped level still regenerates byte for byte.

The measurements say it fixes the core problem. With the colours shown, each colour is a separate puzzle and no deduction ever crosses between them. The three hidden 15×15 levels need 5, 11 and 13 rounds of it, and 4 to 16% of their deductions rule out a thread of another colour. The crossing marks matter less than I hoped, since a mark still fixes the threads through it, but a lone crossing no longer says which colour runs across.

What it still needs before it ships: a playtest (peg colours may sketch the picture enough for players to guess regions, which my player model doesn't do), a gentle ramp of hidden levels to teach it, and a clearer crossing mark.

## Development

```sh
npm install
npm run dev         # local dev server
npm run check       # format check, lint, typecheck, tests
npm run build       # production build in dist/
npm run levels      # generate and certify levels from pictures/
npm run difficulty  # how each level plays, as a markdown table
```
