# Testing

Unit and property tests with Vitest and fast-check. `npm test` runs them once, `npm run test:watch` reruns on change, and CI runs them on every push.

## What gets tested

The pure layers carry the logic, so they carry the tests. Everything in `src/core/` and `src/app/` runs in Node with no browser.

| Area           | What to cover                                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decoder        | Valid puzzles decode. Each kind of bad input is rejected with a readable error naming the problem and the place: missing fields, wrong types, size out of range, ragged rows, unknown codes, pegs off the grid or on blank or two-colour squares, odd peg counts |
| Search solver  | Small hand-made puzzles with zero, one and several solutions. Each rule on its own: crossings must run straight at right angles, two threads of one colour never share a square, threads end at pegs                                                             |
| Logic solver   | Each deduction rule on its own, on a minimal board where it fires. A puzzle that needs guessing leaves it stuck. Every hint is a move in the solution and comes with a reason                                                                                    |
| Validator      | Reference puzzles with known verdicts: unsolvable, two solutions, needs guessing, ships. The difficulty rating matches the hardest rule used                                                                                                                     |
| Generator      | Same picture and seed, same level. A picture that can't be woven is reported with the squares at fault                                                                                                                                                           |
| Shipped levels | Every file in `src/levels/` decodes and passes the validator, so a solver or generator change can't silently break a level                                                                                                                                       |
| Update         | Each `Msg` produces the expected model and commands. The input model is never mutated                                                                                                                                                                            |

`src/view/`, `scripts/` and `main.ts` aren't unit tested. Keep them thin so there's little in them to get wrong.

## Property tests

Example tests check the cases we thought of. Property tests check rules that must hold for every input, using fast-check to generate thousands of cases.

- **The core guarantee:** for any picture and seed, a level the generator returns passes the validator.
- **The search solver never misses:** lay random threads that follow the rules, derive the pattern and pegs from them, and the search solver's solutions include those threads.
- **The search solver never invents:** every solution it returns weaves the same pattern and pegs and breaks no rule, checked by code written independently of the solver (`tests/fixtures/random-weave.ts`).
- **The solvers agree:** whenever the logic solver finishes a puzzle, its answer matches the search solver's.
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
