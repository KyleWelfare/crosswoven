# AGENTS.md

Crosswoven: a browser logic puzzle. Lay coloured threads between pegs so the woven cloth matches a pattern; where two threads cross, their colours mix. Every shipped puzzle is generated from a picture and certified by a validator to have exactly one solution, reachable without guessing.

## Docs

Project docs live in `docs/`. Read the ones that apply before starting work. When you add a doc, put it in `docs/` and add a row here.

| Doc                        | Read when                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `docs/CODING_STANDARDS.md` | Every change                                                                                                          |
| `docs/ARCHITECTURE.md`     | Adding, moving or wiring up code: which layer it belongs in, how state and messages flow, where effects go            |
| `docs/DESIGN.md`           | Gameplay or API decisions: rules, the puzzle format, what makes a puzzle valid, hints, difficulty, the level pipeline |
| `docs/TESTING.md`          | Writing or changing tests, or any change to `src/core/` or `src/app/`                                                 |

## Commands

- `npm run dev`: local dev server
- `npm run check`: lint, typecheck, tests. Run before calling any change done
- `npm run build`: production build in `dist/`
