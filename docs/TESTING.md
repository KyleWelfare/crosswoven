# Testing

Unit and property tests with Vitest and fast-check. `npm test` runs them once, `npm run test:watch` reruns on change, and CI runs them on every push.

## What gets tested

The pure layers carry the logic, so they carry the tests. Everything in `src/core/` and `src/app/` runs in Node with no browser.

| Area           | What to cover                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Physics        | Each collision rule on its own: landing on a platform top, hitting a ledge side, hitting a ceiling, falling short, flying past, reaching the flag. Edge cases at exact boundaries (landing on a platform's corner, peaking exactly at a ceiling) |
| Config decoder | Valid levels decode. Each kind of bad input is rejected with a readable error naming the problem: missing fields, wrong types, overlapping platforms, out-of-range values, flag off the last platform                                            |
| Validator      | Reference levels with known verdicts: one with no solution, one that's trivial, one that ships. Each check passes and fails where expected. The example solution it returns actually clears the level                                            |
| Generator      | Same seed, same level. Generated levels land in the requested difficulty band                                                                                                                                                                    |
| Update         | Each `Msg` produces the expected model and commands. The input model is never mutated                                                                                                                                                            |

`src/view/`, `src/worker/` and `main.ts` aren't unit tested. Keep them thin so there's little in them to get wrong.

## Property tests

Example tests check the cases we thought of. Property tests check rules that must hold for every input, using fast-check to generate thousands of cases.

- **The core guarantee:** for any seed, a generated level decodes, the validator accepts it, and replaying its example solution through `simulate` reaches the flag.
- **The validator never lies:** if it says a level has no solution, no snap position reaches the flag when simulated.
- **Physics is deterministic:** the same level and arrow always give the same result and path.
- **Decoding round-trips:** a valid level encoded to JSON and decoded again comes back equal.
- **Update purity:** for any model and message, `update` leaves its input unchanged.

When fast-check finds a failure it shrinks it to a minimal case. Add that case to the example tests so it stays covered.

## Conventions

- Tests live in `tests/`, one file per module: `tests/physics.test.ts` covers `src/core/physics.ts`. Property tests go in `*.property.test.ts`
- Reference levels used by several tests live in `tests/fixtures/`
- Tests are deterministic. No `Math.random()`, no real timers, no clock. Property tests use a fixed seed in CI, and a failure prints the seed to reproduce it
- Test names describe behaviour: `"lands on a platform when falling through its top"`, not `"test landing"`
- A bug fix comes with a test that fails without the fix
