# Design

Decisions for version one. Architecture lives in `ARCHITECTURE.md`, testing in `TESTING.md`.

## The game

Crosswoven is a logic puzzle. A grid shows a coloured pattern and some numbered, coloured pegs. The player lays threads between the pegs so the woven cloth matches the pattern. Solving it reveals a pixel-art picture.

### Rules

- There are three thread colours: red, blue and yellow
- Every peg is the end of exactly one thread. A peg shows its colour and the length of its thread, counted in squares from peg to peg with both pegs included
- A thread joins two pegs of the same colour and the same number. A peg marked 1 is a whole thread on its own, one square long
- Threads run between orthogonally adjacent squares and never revisit a square. A thread can't pass through a peg
- Each square in the pattern shows the threads that pass through it:

  | Square | Threads through it      |
  | ------ | ----------------------- |
  | Blank  | None                    |
  | Red    | One red                 |
  | Blue   | One blue                |
  | Yellow | One yellow              |
  | Purple | One red and one blue    |
  | Orange | One red and one yellow  |
  | Green  | One blue and one yellow |

- Two threads can share a square only if they're different colours and cross straight over each other at right angles: one runs across, the other down. This is what makes the colours depend on each other
- Pegs sit on single-colour squares
- The puzzle is solved when every peg is tied and every square matches the pattern

The numbers keep each thread within reach of its pegs, so deductions stay local and puzzles scale to large grids, as in Link-a-Pix. Without them, any two pegs of a colour could pair from anywhere on the board, and an experiment found no unique 15×15 puzzles at all; with them, most random 15×15 layouts were unique before any tuning.

### The guarantee

Every shipped puzzle has exactly one solution, and it can be reached by deduction alone, without guessing. The validator proves both for every level (see Validation).

The game accepts any weave that follows the rules, so uniqueness isn't about which answer counts. A second solution means a fork no deduction can settle. If the two solutions differ in places that depend on each other, a player can take one thread from each and reach a dead end, which is guessing and backtracking. Uniqueness is the simplest way to rule that out.

## Play

- Drag from a peg to lay a thread. Drag back along it to take steps off. Drag from any square of an existing thread to reroute it from there; where two threads cross, that picks up the one laid last. Dragging from a peg that already has a thread starts that thread again, and tapping it clears the thread
- A thread is a string cut to its peg's number: it can't grow longer, and it ties only at a peg of its colour and number once all of its length is used. Any other peg blocks it, and so do blank squares. It can cross squares of other colours, so the board doesn't steer the player towards the solution. Reaching a peg that already had a thread replaces that thread
- A square holds as many threads as it shows colours: one, or two crossing. Laying a thread into a full square cuts a thread already there, as in Flow, shown live while drawing. A thread whose colour the square doesn't show is cut first, then the one laid last. Each half stays at its peg and can be joined up again; a half with no peg is dropped
- A thread being drawn shows no running count of its squares. The peg numbers are enough, and the board stays calmer
- Nothing else stops a move that breaks a rule. The board is checked once every peg is tied
- **Hint mode** is a toggle. While it's on, squares that break a rule are flagged live, and a Hint button highlights one forced move with a one-line reason ("this 3 can only reach the other 3 by going down")
- Undo and Clear. Clear can be undone too
- The puzzle is solved when every peg is tied, every square has exactly its colours, and threads run straight through two-colour squares. The board then locks, the threads and pegs fade back to leave the finished picture, and the level's title and a Next button appear

### Levels

- Hand-drawn picture puzzles, rising in difficulty, unlocked in order. 14 so far, listed in `pictures/`: two openers that teach threads and crossings, then pictures where crossings play a part, ending with ones whose crossing threads run on into open areas and take long chains of deduction. Each picture sets a target number of rounds (see Level pipeline), and the targets rise along the play order. `pictures/backlog/` holds pictures that don't ship, kept as development material: ones that give nearly every thread away, and broad single-colour ones that are hard but have no colour mixing, such as Red Giant
- Grid sizes from 5×5 to 15×15. Larger grids are possible with numbered pegs, but 15×15 is the most a phone screen holds for version one
- Each level shows its difficulty, Easy or Medium, rated by the hardest deduction it needs. A Hard tier waits on playtesting
- Progress (cleared or not) is saved in local storage. No accounts, scores or sound

## Menu

The game opens on a menu:

- **Play**: the level list. Each level is a numbered tile showing its pattern in the board's pale washes and its grid size. The title stays hidden, since it names the picture that solving reveals. Every level is open until progress is saved; then cleared levels are marked and the rest unlock in order
- **How to Play**: a simple modal with the rules, improved later if there's time
- Each screen past the menu has a back button: a level goes back to the list, the list to the menu
- **How the Puzzles Are Made**: a slideshow of how a level is made and proven

## How the Puzzles Are Made

The validator is the heart of the project, but a player never sees it. How the Puzzles Are Made is an animated slideshow that takes one real picture through the level pipeline, so a visitor sees that work first. It takes priority over level count.

The visitor steps through it with Back and Next (or the arrow keys). It takes a 9×9 sailboat kept in `pictures/how-it-works/`, outside the level pack: its red mast runs down through the yellow sail as an orange stripe and on into the hull, so the crossing reads as part of the object. Its first laying has a second solution, which is what it needs. Each step is a looping animation, drawn on the game's own board renderer as a pure function of time (`src/view/tour-scenes.ts`, eased by `tween.ts`), and `src/app/tour.ts` builds the steps from the record:

1. **Start from a picture**: the picture paints itself in along the threads that will weave it, with the colour mixes from How to Play listed under the caption
2. **Lay threads**: the generator's threads grow out of their pegs one after another, each peg popping in as its thread starts
3. **Find a second solution**: the search solver's two solutions swap back and forth, the differing threads unweaving and reweaving, with the squares where they differ outlined
4. **Split a thread**: the thread to cut pulses, then snaps into two pieces whose ends pop. The pair would repeat while there's a second solution
5. **Exactly one solution**: the search flickers through every path the pegs could be joined by, then the one weave that works locks in
6. **The obvious threads first, then each round of deduction**: the paths each round of the logic solver rules out flash as dashed ghosts and fade, then the threads it settles grow in
7. **Certified**: the threads fade back to leave the picture, as when a level is won

Beside the board (above it on a phone) a timeline has one entry per step, named for who does the work: the picture, the generator, the search solver, the logic solver or the validator, each in its own colour, so the two solvers read as separate. The current step is lit, ones already seen are half lit, and ones ahead are greyed. A badge above the board counts along with the animation ("Solution 2 of 2", "Weighing route 8 of 20"). With reduced motion set, each step shows its final frame, still.

Not built yet: playing by itself, and a closing animation of the whole pipeline end to end. The search proves this picture unique after trying only 13 paths, because it always takes the most constrained choice first, so the steps quote the paths it weighed rather than a large count of combinations.

The slideshow is drawn live on the canvas with the game's own board renderer, from the record `npm run levels` saves (`src/core/pipeline-record.ts`, written to `src/how-it-works/record.ts` as a typed module). The browser doesn't run the generator or search solver, so the shipped game still includes only the logic solver, and the demo can't fail while someone is watching. A test regenerates the record, so it can't drift from the pipeline.

## Pictures

Pictures are real objects: a heart, a fish, a mushroom. Most squares are single colours or blank, drawn like ordinary pixel art.

Two-colour squares are an accent, not the main material. At a two-colour square one thread runs straight across and the other straight down, so:

- Both of its colours must continue into the neighbours on the matching sides: one colour into the squares left and right of it, the other into the squares above and below
- It can't sit on the edge of the grid
- Two-colour squares only form straight bands, so they suit things that are bands in real life: a stripe, a belt, a ribbon, a strap

A picture that wants a mixed colour as a freeform area (a purple grape, a green leaf) should use a single colour there instead.

A two-colour square fixes both of its threads, so crossings tend to give their threads away: a band of them is read, not solved. They add to the puzzle only when many threads cross a thin band and carry on into open areas on both sides, where the band fixes the middle of each thread but not where it ends or which peg it pairs with: a ribbon down a box (Parcel), posts standing in the sea (Pier), a broken reflection in the water (Sunset). Thick bands, and bands whose threads run along them rather than across, stay inert (Bridge, in `pictures/backlog/`). Nor should the crossings sit in consecutive rows: threads crossing a band row after row stack like the rungs of a ladder and run straight, so a player reads them off. Break the band up with single-colour squares between its crossings, as in Sunset's reflection, so the threads around it have to bend.

## Puzzle format

A level is versioned JSON. The pattern is one string per row; pegs are coordinates with the length of their thread, and each peg takes the colour of its square.

```json
{
  "version": 2,
  "id": "lattice",
  "title": "Lattice",
  "pattern": [".RRR.", "BPBPB", "BPBPB", "BPBRR", "BR.RR"],
  "pegs": [
    { "x": 2, "y": 0, "length": 6 },
    { "x": 3, "y": 0, "length": 7 },
    { "x": 4, "y": 1, "length": 10 },
    { "x": 4, "y": 2, "length": 10 },
    { "x": 2, "y": 3, "length": 4 },
    { "x": 0, "y": 4, "length": 4 },
    { "x": 1, "y": 4, "length": 6 },
    { "x": 3, "y": 4, "length": 7 }
  ]
}
```

This example has exactly one solution. It uses only red and blue.

- **Pattern codes:** `.` blank, `R` red, `B` blue, `Y` yellow, `P` purple, `O` orange, `G` green
- **Coordinates:** squares, with `x` to the right and `y` down from the top-left
- **Length:** squares in the thread, both pegs included. A peg with length 1 is a thread on its own

### Decoder rules

The decoder turns unknown JSON into a `Puzzle` or a list of readable errors. It rejects:

- Missing fields, wrong types, unsupported version
- A grid smaller than 5×5 or larger than 15×15, or rows of different lengths
- Unknown pattern codes
- Pegs outside the grid, on blank or two-colour squares, or duplicated
- A length that isn't a whole number from 1 up
- An odd number of pegs of any colour and length above 1, since those pair up, or a colour in the pattern with no pegs

Errors name the problem and the place: "peg 4 at (2, 7) is on a purple square".

The decoder checks shape only. Whether the pattern can be woven at all is the validator's job.

## Validation

The validator certifies a puzzle. It runs in the level pipeline and in CI. The shipped game only includes the logic solver, for hints.

| Check      | Rule                                                             |
| ---------- | ---------------------------------------------------------------- |
| Decodes    | The level passes the decoder                                     |
| Checkable  | No pair of pegs has more than 100,000 possible paths             |
| Solvable   | At least one solution exists                                     |
| Unique     | Exactly one solution exists                                      |
| No guesses | The logic solver reaches the solution using deduction rules only |
| Difficulty | The hardest rule the logic solver needed sets the level's rating |

Both solvers start from the same idea: for each pair of pegs that could join (same colour, same number, close enough to reach each other), list every path of exactly that length that follows the rules. Each solver then works on those candidate paths.

- **Search solver:** chooses one path per peg so that every square gets exactly the threads the pattern asks for. Finds every solution (stopping at two), so it proves solvable and unique
- **Logic solver:** rules out candidate paths one deduction at a time, the way a person would, recording each step and its reason. If it gets stuck before the end, the puzzle needs guessing and is rejected. Its steps also power hints in the game

Each solver is checked against the other, so a bug in one shows up as a disagreement.

### Deduction rules

Each rule rules out candidate paths. On 71,421 random unique puzzles they finished all but 15. There is no Hard tier yet; whether there should be one is settled after playtesting the level pack.

| Rule       | Difficulty | Statement                                                                                                                         |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Partner    | Easy       | A peg can only pair with a peg of its colour and number that its thread could reach. If only one can, they pair                   |
| Only path  | Easy       | When a pair has one path left, that is its thread                                                                                 |
| Shared     | Medium     | Squares that every remaining path of a peg passes through belong to that peg's thread; no other thread of its colour may use them |
| Only reach | Medium     | A square that only one peg's paths can reach must be on that peg's thread, so its paths that miss the square are ruled out        |

Crossings need no rule of their own. Candidate paths only run straight through two-colour squares, and two colours can never both cross a square the same way: they would share every square onward to the edge of the grid. So once paths are listed, every crossing is already perpendicular.

A puzzle's difficulty is the hardest rule its solve needs. Trial and error ("assume this, follow it, hit a contradiction") is not a rule: a puzzle that needs it counts as needing guessing and is rejected.

The rating alone can't say how a level feels. `npm run difficulty` (`src/core/solve-profile.ts`) also counts how many pegs the board gives away (one possible path before any deduction), how many could pair more than one way, and how many rounds the solve takes when each round makes every deduction open at its start. Rounds are the longest chain of reasoning; many steps per round means the player never has to search. Playtesting found the first pack too easy, and the profile shows why: most pegs are given and most levels solve in one round or none.

A hint shows the next square or link the player can draw and the rule that forced it.

`Puzzle` stores squares as readable colour names. The solvers convert the pattern once to bitmasks of thread colours (red 1, blue 2, yellow 4, so purple is 3), because their work is set operations: what a square still needs, whether a colour may enter, whether a square is satisfied.

## Level pipeline

Claude draws each picture as a small text grid in the repo, using the pattern codes. `npm run levels` then turns each picture into a level:

1. The generator covers each colour's squares with threads, running straight through two-colour squares, and puts numbered pegs at their ends. It's seeded, so the same picture and seed always give the same level
   - A picture can set `lengths: [min, max]`, 2 to 5 by default. Each thread the generator grows aims for a length in that range, but these are targets, not limits. A thread that runs out of free squares stops short of `min`, and a lone square joins a neighbouring thread shorter than `max` or else becomes a length-1 thread. Splitting ignores `min`, and a thread forced through a band of crossings can run past `max`
   - A picture can set `sameNumbers` from 0 to 1, 0 by default: the chance a new thread aims for the length of a nearby thread of its colour instead of a random length. Repeated numbers give pegs rival partners, which makes broad pictures much harder; on thin outlines a thread rarely has a second route anyway
2. The validator certifies the result. If the puzzle has more than one solution, the generator re-lays threads where the two solutions differ, usually by splitting them shorter, and tries again. If that doesn't converge, it tries another seed. A picture with `targetRounds` has all 30 seeds settled this way, and the generator keeps the one whose solve takes closest to that many rounds, then the one with fewest obvious threads (straight runs, and threads a peg sends straight into a band), then the one that gives away fewest pegs. Rounds measure the solver's proof, which a player skips when the obvious answer is right. Without a target it keeps the first seed that works. A picture can instead pin `seed` to keep one laying found by searching more seeds than the generator tries, as Red Giant in the backlog does
3. Some pictures can't be woven at all: for example, a purple square on the edge of the grid has no room to cross. The script reports the squares at fault, so the picture can be fixed. If the picture can be woven but no seed works, it reports the squares that last caused trouble instead
4. Certified levels are written to `src/levels/`, with the play order from `pictures/order.json`, which must list every picture once

Short threads keep candidate paths few and deductions local; long threads through open areas are what make puzzles ambiguous or slow to check.

CI re-validates every shipped level and regenerates it from its picture, so a generator change can't silently break or change one. A change that alters any level fails CI until `npm run levels` is rerun and the new levels are committed.

## Look

Kept from the prototype and refined later:

- A weave theme. Crossings alternate over and under on a checkerboard, like plain-weave cloth
- Where two threads cross, both are dyed their mixed colour through the middle of the square, blending back to their own colours at its edges. The mixing shows in the threads, not only the squares. Wrong crossings mix too, which shows the mismatch
- Squares show a pale wash of their target colour, deeper once the threads there match. The colour alone names a two-colour square's threads, with no other mark, to keep the board calm
- Pegs show their number, and are hollow until tied
- Light and dark themes

## Targets

- Desktop with a mouse, and phones with touch in portrait. A 15×15 puzzle must be playable on a phone
- Steady 60 fps while drawing
- A hint appears within about 100 ms

## Out of scope for version one

- Design mode and player-made puzzles
- Keyboard play and screen reader support
- Daily or endless generated puzzles

## Open questions

- Whether there's a Hard tier, and what earns it. To settle after playtesting the level pack, along with counting steps below
- Is there a maximum thread length? Long threads in open areas have many candidate paths, which slows both solvers. For now the validator rejects a pair with more than 100,000 paths
- When every peg is tied but the board is wrong, what does the player see: just "not solved yet", or a count of wrong squares?
- Does the shipped game keep a "Show answer" button?
- Do level files store the solution, or is it always derived by the solver?
- Should the rating use the solve profile (rounds, given pegs) as well as the hardest rule? A large puzzle that only needs Easy rules can still be a long solve, and one that needs Medium once can still be dull
- What a hint does when the player's board already has mistakes
- Squares at 15×15 on a phone are about 24 px. Is that enough to drag accurately, or do large puzzles need zoom?
