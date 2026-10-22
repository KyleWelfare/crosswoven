<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/banner-dark.png">
    <img src="docs/media/banner-light.png" width="460" alt="Crosswoven">
  </picture>
</p>

<p align="center"><b><a href="https://kylewelfare.github.io/crosswoven/">Play it in your browser</a></b></p>

Draw a pixel-art picture, and the pipeline turns it into a puzzle with exactly one solution that you can reach without guessing. If a picture can't be made into one, it points to the squares at fault.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/pipeline-dark.gif">
    <img src="docs/media/pipeline.gif" width="720" alt="The pipeline replayed on an anchor picture: threads laid, a second solution found, a thread split, then solved by deduction and certified">
  </picture>
</p>

The puzzle is a logic game: connect numbered pegs with coloured threads to weave the picture. Where two threads cross, their colours mix. It's based on Link-a-Pix (also called Paint by Pairs), where you join matching numbers with a path that many squares long. Colour mixing is what's new.

<br>

### How a level is made

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

Each picture is a small text grid in three colours, from 5×5 to 15×15. A generator covers it with threads and puts a numbered peg at each end. Then two solvers have to agree before the level ships:

1. A search solver looks for every solution. If it finds a second one, the generator splits a thread where the two differ and tries again
2. A logic solver plays it like a person, one deduction at a time, to prove you never have to guess

Some pictures can't be woven at all. A purple square on the edge of the grid has no room for its two threads to cross, for example. The pipeline reports those squares so the picture can be fixed.

On 71,421 random puzzles with one solution, the deduction rules solved all but 15 without guessing. The numbered pegs are what make this work: without them I couldn't find a single 15×15 puzzle with only one solution, and with them most random layouts had one. 15×15 is the limit because of phone screens, not the solvers.

CI regenerates every shipped level, so a solver or generator change can't quietly break one. The game also replays this whole process step by step, under How the Puzzles Are Made on the menu.

<br>

### The game

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/play-dark.gif">
    <img src="docs/media/play.gif" width="420" alt="Solving a level: red and blue threads are dragged between numbered pegs, turning purple where they cross, until the gift picture is complete">
  </picture>
</p>

<p align="center">
  <img src="docs/media/menu.png" width="49%" alt="The title screen, with a woven anchor puzzle beside the Play button">
  <img src="docs/media/game-large-dark.png" width="49%" alt="A 15×15 sailboat level partway solved, in the dark theme">
</p>
<p align="center">
  <img src="docs/media/levels-phone.png" width="24%" alt="The level list on a phone, with cleared, open and locked levels">
  <img src="docs/media/solved-phone.png" width="24%" alt="A solved level on a phone">
</p>

14 levels, a tutorial, saved progress, light and dark themes, and sound. It works on desktop and phones in either orientation. You can also play from the keyboard alone, and a screen reader reads out each square as you move and each thread as you tie it.

The board is a hand-drawn canvas, with no libraries. It runs at 60 fps on a 15×15 board at phone size with the CPU slowed down 4×. The first version managed 10.

All the game's state lives in one object, and only a pure `update` function changes it. That makes undo a list of past boards, and lets the rules be tested without a browser.

More in [docs/](docs/).

<br>

### How I built it

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

I made the design calls and Claude Code wrote most of the code. Before it wrote any game code, I set up the checks that would let me trust what it wrote:

- **Strict from the first commit.** Strict TypeScript, ESLint requiring an explicit type on every declaration, a Prettier format check and CI on every push to main. `npm run check` runs all of it, and nothing counts as done until it passes
- **Tests where the logic lives.** The rules, solvers and game state are pure code that runs without a browser, so every change to them is tested directly. Property tests run thousands of random puzzles through both solvers and fail if they ever disagree
- **Levels can't silently break.** CI regenerates and re-validates every shipped level, so if a change to the generator or solvers alters a level, the build fails until it's regenerated and reviewed
- **Checks for what tests can't see.** `npm run screenshots` captures every screen at desktop, phone portrait and phone landscape size, in both themes, and audits the layout for overflow, small tap targets and tiny text. `npm run bench` times the board in headless Chrome with the CPU throttled, so a slower frame shows up as a number
- **Written rules.** The agent works under an architecture doc, coding standards and a testing plan, all in [docs/](docs/) and `.claude/CLAUDE.md`
- **Repeatable checks as skills.** The checks I ran most are written up as Claude Code skills in `.claude/skills/`, so they run the same way every time instead of depending on how I phrased the request. `review-commit` reviews a change adversarially, hunting for bugs and weak types. `review-next` works back through the history one commit at a time: it fixes clear-cut findings, then has a fresh agent check those fixes before anything is committed. `design-review` screenshots every screen at each size and proposes exact CSS changes. `perf-check` reruns the render benchmark and traces any slowdown to the code behind it

That setup is why I could move fast without reading every line on faith. When Claude changed something, I trusted a green check, a passing property test or a clean screenshot audit, not its own say-so.

<br>

### Credits

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/braid-dark.png">
  <img src="docs/media/braid-light.png" width="146" alt="">
</picture>

Music: [Heavenly Loop](https://opengameart.org/content/heavenly-loop) by isaiah658, CC0. Sound effects are synthesised in the browser.

<br>

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
