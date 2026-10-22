<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/banner-dark.png">
    <img src="docs/media/banner-light.png" width="460" alt="Crosswoven">
  </picture>
</p>

A logic puzzle for the browser. Connect numbered pegs with coloured threads to weave a pixel-art picture. Where two threads cross, their colours mix.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/play-dark.gif">
    <img src="docs/media/play.gif" width="420" alt="Solving a level: red and blue threads are dragged between numbered pegs, turning purple where they cross, until the gift picture is complete">
  </picture>
</p>

It's based on Link-a-Pix (also called Paint by Pairs), where you join matching numbers with a path that many squares long. Colour mixing is the twist.

Every level is generated from a picture and checked by a validator: exactly one solution, and you never have to guess.

<p align="center">
  <img src="docs/media/menu.png" width="49%" alt="The title screen, with a woven anchor puzzle beside the Play button">
  <img src="docs/media/game-large-dark.png" width="49%" alt="A 15×15 sailboat level partway solved, in the dark theme">
</p>
<p align="center">
  <img src="docs/media/levels-phone.png" width="24%" alt="The level list on a phone, with cleared, open and locked levels">
  <img src="docs/media/solved-phone.png" width="24%" alt="A solved level on a phone">
</p>

### How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

The game walks through how a level is made:

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/pipeline-dark.gif">
    <img src="docs/media/pipeline.gif" width="720" alt="The pipeline replayed on an anchor picture: threads laid, a second solution found, a thread split, then solved by deduction and certified">
  </picture>
</p>

- Each picture is a small text grid. A generator covers it with threads and puts numbered pegs at the ends
- A search solver checks there's only one solution. If it finds a second, the generator splits a thread where the two differ and tries again
- A logic solver plays it like a person, one deduction at a time, to prove it never needs a guess
- Property tests run both solvers on thousands of random puzzles and check they agree
- CI regenerates every level, so a solver change can't quietly break one
- Game state is one object, changed only by a pure `update` function, so undo is just a list of past boards and the rules are tested without a browser
- The board is a hand-drawn canvas, no libraries. It holds 60 fps on a 15×15 board at phone size with the CPU throttled 4× (the first version got 10)

More in [docs/](docs/).

### What playtesting showed

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

The first levels were too easy. Measuring them backed that up: on most levels, 69% or more of the pegs could only go one way, and none took more than 3 rounds of deduction.

Tuning the generator to aim each level at a difficulty target helped, but the bigger problem is the design: showing the colours tells you where every thread goes before you start.

### How I built it

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

I made the design calls and Claude Code wrote most of the code. My job was deciding what to build, setting the rules it worked under, and checking its output: reviewing each change, and backing claims with tests and data rather than taking them on trust. The design docs and agent rules (`.claude/CLAUDE.md`) are in the repo.

### Credits

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

Music: [Heavenly Loop](https://opengameart.org/content/heavenly-loop) by isaiah658, CC0. Sound effects are synthesised in the browser.

### Development

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

```sh
npm install
npm run dev         # local dev server
npm run check       # format check, lint, typecheck, tests
npm run build       # production build in dist/
npm run levels      # generate and certify levels from pictures/
npm run difficulty  # how each level plays, as a markdown table
```
