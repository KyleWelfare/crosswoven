# Testing

Unit and property tests with Vitest and fast-check. `npm test` runs them once, `npm run test:watch` reruns on change, and CI runs them on pushes to `main` and on pull requests.

## What gets tested

The pure layers carry the logic, so they carry the tests. Everything in `src/core/` and `src/app/` runs in Node with no browser.

| Area            | What to cover                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decoder         | Valid puzzles decode. Each kind of bad input is rejected with a readable error naming the problem and the place: missing fields, wrong types, size out of range, ragged rows, unknown codes, pegs off the grid or on blank or two-colour squares, lengths that aren't whole numbers from 1 up, odd peg counts per colour and length                                   |
| Candidate paths | Every path of exactly the length, never through another peg and only straight through crossings. Pegs too far apart, or the wrong parity, get none. A pair over the cap is reported                                                                                                                                                                                   |
| Search solver   | Small hand-made puzzles with zero, one and several solutions. Each rule on its own: crossings must run straight at right angles, two threads of one colour never share a square, threads end at pegs, pegs pair by colour and length, a length-1 peg is a thread on its own                                                                                           |
| Logic solver    | Each deduction rule on its own, on a minimal board where it fires. A puzzle that needs guessing leaves it stuck. Every hint is a move in the solution and comes with a reason. Solving in rounds takes every deduction open at once, easy before medium, and reaches the same verdict as solving one step at a time                                                   |
| Solve profile   | Given threads, pegs with rivals, paths per peg, rounds and obvious threads, each on a reference puzzle where it shows                                                                                                                                                                                                                                                 |
| Validator       | Reference puzzles with known verdicts: too open, unsolvable, two solutions, needs guessing, ships. The difficulty rating matches the hardest rule used                                                                                                                                                                                                                |
| Generator       | Same picture and seed, same level. A target picks the seed nearest it, and no bias lays as before. A picture that can't be woven is reported with the squares at fault                                                                                                                                                                                                |
| Shipped levels  | Every file in `src/levels/` decodes, passes the validator and has its file name as its id. Each picture still generates its level, with one level per picture and the pictures' play order, and rounds of deduction never drop along that order, so a solver or generator change that alters any level fails until `npm run levels` is rerun and the levels committed |
| Pipeline record | How It Works' record regenerates from its picture, each rejected laying carries its second solution, and every thread settles exactly once                                                                                                                                                                                                                            |
| How It Works    | The steps open on the picture with nothing checked, fail uniqueness wherever a second solution shows, add each round's threads to those before, and end with every check passed                                                                                                                                                                                       |
| Update          | Each `Msg` produces the expected model and commands. The input model is never mutated                                                                                                                                                                                                                                                                                 |

`src/view/`, `scripts/` and `main.ts` aren't unit tested. Keep them thin so there's little in them to get wrong.

## Property tests

Example tests check the cases we thought of. Property tests check rules that must hold for every input, using fast-check to generate thousands of cases.

- **The core guarantee:** for any picture and seed, a level the generator returns passes the validator.
- **The search solver never misses:** lay random threads that follow the rules, derive the pattern and pegs from them, and the search solver's solutions include those threads.
- **The search solver never invents:** every solution it returns weaves the same pattern and pegs and breaks no rule, checked by code written independently of the solver (`tests/fixtures/random-weave.ts`).
- **The solvers agree:** whenever the logic solver finishes a puzzle, its answer matches the search solver's.
- **The logic solver only deduces what's true:** every step it makes holds in every solution the search solver finds, and it never reports a contradiction on a puzzle that has a solution.
- **The generator is deterministic:** the same picture and seed always give the same level.
- **Decoding round-trips:** a valid puzzle encoded to JSON and decoded again comes back equal.
- **Update purity:** for any model and message, `update` leaves its input unchanged.

When fast-check finds a failure it shrinks it to a minimal case. Add that case to the example tests so it stays covered.

## Conventions

- Tests live in `tests/`, one file per module: `tests/validator.test.ts` covers `src/core/validator.ts`. Property tests go in `*.property.test.ts`
- Reference puzzles used by several tests live in `tests/fixtures/`
- Tests are deterministic. No `Math.random()`, no real timers, no clock. Property tests use a fixed seed in CI, and a failure prints the seed to reproduce it
- Test names describe behaviour: `"rejects a peg on a purple square"`, not `"test pegs"`
- A bug fix comes with a test that fails without the fix
