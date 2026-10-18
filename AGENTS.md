# AGENTS.md

Jump Tuner: a small browser interactive about projectile motion. Drag a launch arrow to set run speed and jump speed so one jump clears every gap in a level. Design mode edits levels while a validator proves each one is solvable.

## Teaching

These sessions are for learning, not just output. Explain every change the way a professor teaching the material would: the concepts behind it (Elm architecture, functional programming, canvas, physics, TypeScript), why this approach over the alternatives, and how it connects to what came before. Introduce new ideas before using them, keep explanations tied to the actual code, and point out what is worth remembering for next time.

## Docs

Project docs live in `docs/`. Read the ones that apply before starting work. When you add a doc, put it in `docs/` and add a row here.

| Doc                        | Read when                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `docs/CODING_STANDARDS.md` | Every change                                                                                               |
| `docs/ARCHITECTURE.md`     | Adding, moving or wiring up code: which layer it belongs in, how state and messages flow, where effects go |
| `docs/DESIGN.md`           | Gameplay or API decisions: the level config, what makes a level valid, physics rules, difficulty           |
| `docs/TESTING.md`          | Writing or changing tests, or any change to `src/core/` or `src/app/`                                      |

## Commands

- `npm run dev`: local dev server
- `npm run check`: lint, typecheck, tests. Run before calling any change done
- `npm run build`: production build in `dist/`
