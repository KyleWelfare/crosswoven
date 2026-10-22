---
name: design-review
description: Screenshots every screen of the game (menu, How to Play, level list, a level fresh, partway, solved, large and tall, and every step of How the Puzzles Are Made) at desktop, phone portrait and phone landscape size, studies them, and proposes specific CSS and copy changes, each naming the selector, property and value or the exact new text. Use when asked for a design review, visual QA, layout or responsive checks, or design suggestions.
argument-hint: "[dark | both] [shot names to limit to, e.g. tour,game]"
context: fork
agent: general-purpose
model: claude-opus-5-5
allowed-tools: Read, Grep, Glob, Bash(npm run screenshots:*), Bash(git:*)
---

# Design review

Arguments: `$ARGUMENTS`

- `dark` or `both` sets the theme (default light). Pass it as `--theme dark` or `--theme both`
- Any other words are shot names to limit to, passed as `--only word1,word2`. A shot is taken when its name contains one of them, for example `tour` or `game`

Do not edit code. Look, analyze, and report. The user decides what to apply.

## Steps

1. Read the design intent so suggestions serve it rather than taste: the **Look**, **Play**, **Menu** and **How the Puzzles Are Made** sections of `docs/DESIGN.md`, and `docs/ACCESSIBILITY.md`
2. Read what you'll be suggesting changes to: `index.html`, `src/styles/tokens.css` (the spacing, type and colour tokens) and every stylesheet in `src/styles/`. A suggestion must name a real selector and use the existing tokens where one fits
3. Run `npm run screenshots -- --out screenshots` plus the theme and `--only` options from the arguments, with a 10 minute timeout. Images land in `screenshots/<theme>/<viewport>/<shot>.png`, which is gitignored
4. Read `screenshots/manifest.md`. Each shot has an automatic audit: horizontal overflow, screens whose content is taller than the screen, tap targets under 44×44 CSS pixels, and the smallest text on screen. Treat it as leads to confirm in the images, not as findings. On the rules shot it also counts the menu behind the dialog
5. Look at every image with Read. Compare the same screen across its three viewports side by side, then the same viewport across screens, since most problems show up as inconsistency

The shots are taken with reduced motion on, so each tour step shows its final frame and the win panel is fully faded in. Viewports: desktop 1440×900, phone portrait 393×852, phone landscape 852×393.

## What to look for

Every finding must be something you can point to in a screenshot, with a reason grounded in layout, legibility, accessibility or the design doc. For each viewport and screen, check:

- **Use of space**: is the board as large as the viewport allows? Large empty bands, content crowded at one edge, or a key control below the fold
- **Alignment and rhythm**: shared left edges and centre lines, and gaps that follow the `--space-*` scale. Two gaps that should match but don't. Elements that line up on one screen and not on its sibling
- **Hierarchy**: whether the eye lands on the most important thing first (the board in play, Next level when solved, the step heading in the tour). Type sizes, weights and colours that compete
- **Consistency across screens**: the back bar, buttons, headings and spacing should look the same on every screen at the same viewport
- **Responsive behaviour**: landscape phones are the tightest, at 393 px tall. Text wrapping into widows, lines over about 75 characters on desktop, controls that wrap or clip, the timeline and board fighting for room
- **Touch and legibility**: targets under 44 px on phones, text under 14 px for anything a player must read, peg numbers too small to read on a 15×15 board
- **Contrast**: work out the contrast ratio from the token values in `tokens.css` for any text that looks faint, especially de-emphasised timeline steps and eyebrows. WCAG AA needs 4.5:1 for body text and 3:1 for large text
- **Dark mode**, when taken: shadows that vanish, washes that go muddy, colours that clash with the dark background
- **Content**: copy a first-time player would stumble on, captions longer than the space suits them, labels that don't say what a button does, text repeated on one screen, and words that differ between screens for the same thing

## Rules for suggestions

- **No vibe suggestions.** "Make it pop", "feels cramped", "more modern", "cleaner", "add some polish" and "improve the hierarchy" are not suggestions. Say what to change and to what
- **Check before you suggest.** Read the rule you're changing first. Don't propose a value that's already set, and quote the current value
- **Prefer tokens** (`var(--space-4)`) over raw values. If no token fits, say so and propose a value
- **Scope by viewport.** A fix for landscape phones goes in the media query that already handles them, if there is one, rather than changing every viewport
- **One problem, one change.** If a fix has a side effect on another screen or viewport, say which shot to check afterwards
- **Severity**: `high` breaks or hides something (clipping, overflow, an unreadable or unreachable control), `medium` hurts use or comprehension, `low` is polish

Format each suggestion like this:

```
### [severity] Short title
Shots: portrait/06-game-solved, landscape/06-game-solved
Seen: what is visibly wrong, concretely, with sizes or positions where you can estimate them
Why: the principle or requirement it breaks
Change: src/styles/dock.css:42, `.win { gap: var(--space-2); }` → `gap: var(--space-4);`
Check after: the shots to retake to confirm
```

For copy changes, the `Change:` line quotes the current text with its file and line, then the new text.

## Report

1. **Summary**: the three to five changes that would improve the game most, one line each
2. **Suggestions**: grouped by screen (menu, How to Play, level list, game, How the Puzzles Are Made), highest severity first, in the format above
3. **Working well**: at most three short bullets, so nobody "fixes" those in a later pass. Each one names a specific thing
4. Offer to apply chosen suggestions and retake only the affected shots with `--only`, so before and after can be compared
