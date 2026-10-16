# Jump Tuner — design

Write this before any code. Answer each question in your own words; delete the prompts as you go.

## Config API

- What does a level look like? (platforms, ceilings, planet, arrow ranges and steps, difficulty, hints)
- Who writes levels (designer, content agent, tutor), and what do they need to know to write a good one?
- Units and coordinates: px, px/s, px/s²? Which way is y?

## What makes a level valid

- Has a solution
- Fair margin: how many snap positions must work?
- Not trivial: what share is too many?
- Geometry rules: on screen, no overlaps, flag reachable, anything else?
- Which of these are thresholds you'll tune, and to what?

## Validation approach

- What can the types rule out on their own?
- What does the decoder reject, and what do its errors say?
- What can only simulation tell you?
- Why is a grid search over snap positions enough here? When wouldn't it be?

## Physics

- Timestep: fixed? What size? How do the game and the validator stay in agreement?
- Collision rules: landing, hitting a ledge side, hitting a ceiling, falling in a pit
- When does the character jump?

## Rendering

- Canvas 2D: how do you handle high-DPI and resizing?
- When do you redraw: on state change, every frame, only during animation?

## Code structure

- Model, messages, update, view: what goes where?
- What runs in the worker, and how do results get back?
- What's pure and testable without a browser?

## Difficulty

- How is difficulty defined?
- How does the generator aim at a difficulty band?

## Open questions

- Preview up to the peak, or a blind first try?
- Reveal the solution map after a win?
- Should Design mode suggest fixes for rejected levels?
