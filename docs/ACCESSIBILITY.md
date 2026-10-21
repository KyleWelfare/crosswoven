# Accessibility

What the game supports for screen reader and keyboard users today, and what's still to do.

## Supported

- Every control is a native button with a text label, so it works from the keyboard and shows a focus ring: the menu, the back buttons, Undo, Clear and Next level (`src/styles/dock.css`), and the level tiles (`src/styles/level-list.css`)
- Level tiles are named "Level 3, 7 by 7"; their pattern thumbnails are hidden from screen readers
- Each screen has its own `h1`. As a screen appears, focus moves to its heading (Play on the menu), so focus never stays on a button that just vanished (`src/view/screens.ts`)
- How to Play is a native modal `<dialog>`: it traps focus, closes on Escape, and returns focus to the button that opened it
- The win message sits in an `aria-live="polite"` region, so screen readers announce a solved level
- The masthead braid is decorative and hidden from screen readers
- The page declares its language

## Not yet

- The board is a canvas with no accessible name or text alternative, so a screen reader gets nothing from it
- Threads can only be laid with a pointer: mouse, touch or pen. There's no way to play from the keyboard

## Planned

- [ ] Screen reader support for the board: the pattern, the pegs and their numbers, the threads laid and which squares are woven
- [ ] Keyboard play: move between squares, start a thread at a peg and lay it a square at a time
