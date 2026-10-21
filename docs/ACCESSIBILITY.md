# Accessibility

What the game supports for screen reader and keyboard users today, and what's still to do.

## Supported

- Undo, Clear and Next level are native buttons with text labels, so they work from the keyboard and show a focus ring (`src/styles/dock.css`)
- The win message sits in an `aria-live="polite"` region, so screen readers announce a solved level
- The masthead braid is decorative and hidden from screen readers
- The page declares its language

## Not yet

- The board is a canvas with no accessible name or text alternative, so a screen reader gets nothing from it
- Threads can only be laid with a pointer: mouse, touch or pen. There's no way to play from the keyboard

## Planned

- [ ] Screen reader support for the board: the pattern, the pegs and their numbers, the threads laid and which squares are woven
- [ ] Keyboard play: move between squares, start a thread at a peg and lay it a square at a time
