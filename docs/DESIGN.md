# Design

Decisions for version one. Architecture lives in `ARCHITECTURE.md`, testing in `TESTING.md`.

## The game

Crosswoven is a logic puzzle. A grid shows a coloured pattern and some coloured pegs. The player lays threads between the pegs so the woven cloth matches the pattern. Solving it reveals a pixel-art picture.

### Rules

- There are three thread colours: red, blue and yellow
- Every peg is the end of exactly one thread, and a thread joins two pegs of its colour. Pegs show colour only, so working out which pegs pair up is part of the puzzle
- Threads run between orthogonally adjacent squares and never revisit a square. A thread can't pass through a peg; reaching a peg of its colour ends it
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

### The guarantee

Every shipped puzzle has exactly one solution, and it can be reached by deduction alone, without guessing. The validator proves both for every level (see Validation).

## Play

- Drag from a peg to lay a thread. Drag back along it to take steps off. Drag from any square of an existing thread to reroute it from there. Dragging from a peg that already has a thread starts that thread again
- Nothing stops a move that breaks a rule. The board is checked once every peg is tied
- **Hint mode** is a toggle. While it's on, squares that break a rule are flagged live, and a Hint button highlights one forced move with a one-line reason ("this red peg can only go up: every other neighbour has no red")
- Undo and Clear
- On a win, the threads fade back and the cloth fills in with the finished picture

### Levels

- About 12 hand-drawn picture puzzles, rising in difficulty, unlocked in order
- Grid sizes from 5×5 to 15×15
- Each level shows its difficulty: Easy, Medium or Hard, rated by the hardest deduction it needs
- Progress (cleared or not) is saved in local storage. No accounts, scores or sound

## Puzzle format

A level is versioned JSON. The pattern is one string per row; pegs are coordinates, and each peg takes the colour of its square.

```json
{
  "version": 1,
  "id": "lattice",
  "title": "Lattice",
  "pattern": [".RRR.", "BPBPB", "BPBPB", "BPBRR", "BR.RR"],
  "pegs": [
    { "x": 2, "y": 0 },
    { "x": 3, "y": 0 },
    { "x": 4, "y": 1 },
    { "x": 4, "y": 2 },
    { "x": 2, "y": 3 },
    { "x": 0, "y": 4 },
    { "x": 1, "y": 4 },
    { "x": 3, "y": 4 }
  ]
}
```

This example is a real generated puzzle with exactly one solution. It uses only red and blue.

- **Pattern codes:** `.` blank, `R` red, `B` blue, `Y` yellow, `P` purple, `O` orange, `G` green
- **Coordinates:** squares, with `x` to the right and `y` down from the top-left

### Decoder rules

The decoder turns unknown JSON into a `Puzzle` or a list of readable errors. It rejects:

- Missing fields, wrong types, unsupported version
- A grid smaller than 5×5 or larger than 15×15, or rows of different lengths
- Unknown pattern codes
- Pegs outside the grid, on blank or two-colour squares, or duplicated
- An odd number of pegs of any colour, or a colour in the pattern with no pegs

Errors name the problem and the place: "peg 4 at (2, 7) is on a purple square".

The decoder checks shape only. Whether the pattern can be woven at all is the validator's job.

## Validation

The validator certifies a puzzle. It runs in the level pipeline and in CI. The shipped game only includes the logic solver, for hints.

| Check      | Rule                                                             |
| ---------- | ---------------------------------------------------------------- |
| Decodes    | The level passes the decoder                                     |
| Solvable   | At least one solution exists                                     |
| Unique     | Exactly one solution exists                                      |
| No guesses | The logic solver reaches the solution using deduction rules only |
| Difficulty | The hardest rule the logic solver needed sets the level's rating |

Two solvers back this up, and each checks the other:

- **Search solver:** backtracking search. Finds every solution (stopping at two), so it proves solvable and unique
- **Logic solver:** applies deduction rules one at a time, the way a person would, recording each step and its reason. If it gets stuck before the end, the puzzle needs guessing and is rejected. Its steps also power hints in the game

## Level pipeline

Claude draws each picture as a small text grid in the repo, using the pattern codes. `npm run levels` then turns each picture into a level:

1. The generator lays threads that weave the picture, choosing how each colour splits into threads and where the pegs go. It's seeded, so the same picture and seed always give the same level
2. The validator certifies the result. If it fails, the generator tries another seed
3. If no seed works, the script reports which squares are at fault, so the picture can be fixed. Some pictures can't be woven at all: for example, a purple square on the edge of the grid has no room to cross
4. Certified levels are written to `src/levels/`

CI re-validates every shipped level, so a generator change can't silently break one.

## Look

Kept from the prototype and refined later:

- A weave theme. Crossings alternate over and under on a checkerboard, like plain-weave cloth
- Squares show a pale wash of their target colour, deeper once the threads there match. Two-colour squares show two small pips naming their colours
- Pegs are hollow until tied
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

- When every peg is tied but the board is wrong, what does the player see: just "not solved yet", or a count of wrong squares?
- Does the shipped game keep a "Show answer" button?
- Do level files store the solution, or is it always derived by the solver?
- Which deduction rules the logic solver uses, and how they map to Easy, Medium and Hard. To decide when building the validator
- What a hint does when the player's board already has mistakes
- Which 12 pictures make the level pack
- Squares at 15×15 on a phone are about 24 px. Is that enough to drag accurately, or do large puzzles need zoom?
