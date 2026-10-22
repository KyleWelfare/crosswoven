# Accessibility

What the game supports for screen reader and keyboard users today, and what's still to do.

## Supported

- Every control is a native button with a text label, so it works from the keyboard and shows a focus ring: the menu, the back buttons, How to Play, Undo, Clear and Next level (`src/styles/dock.css`), and the level tiles (`src/styles/level-list.css`)
- Level tiles are named "Level 3, 7 by 7", with ", cleared" or ", locked" after. A locked tile uses `aria-disabled` rather than `disabled`, so it stays focusable and announced; its pattern thumbnail and padlock are hidden from screen readers
- Each screen has its own `h1`. As a screen appears, focus moves to its heading (Play on the menu), so focus never stays on a button that just vanished (`src/view/screens.ts`)
- How to Play opens from a button in each level's top bar. It's a native modal `<dialog>`: it traps focus, closes on Escape, and returns focus to the button that opened it
- The tutorial card's text sits in an `aria-live="polite"` region, so each step is announced. Skip tutorial and OK are native buttons, and the controls under the shade are made `inert`
- The win message sits in an `aria-live="polite"` region, so screen readers announce a solved level
- How the Puzzles Are Made steps with Back and Next or the arrow keys. Its actor, heading and caption sit in an `aria-live="polite"` region, and the timeline marks the current step with `aria-current="step"`. The board and the badge that counts along with each animation are hidden from screen readers, since the caption describes the step. With reduced motion set, every animation shows its final frame, still
- The masthead braid and the menu's weaving board are decorative and hidden from screen readers. With reduced motion set, the menu board shows its finished weave, still
- The Theme picker is a native `<select>` inside its `<label>`, so it is named "Theme" and works from the keyboard
- The speaker buttons are named "Sound", or "Sound, muted", since the crossed-out icon only shows it. They open the sound panel, a native popover with `role="dialog"` named "Sound", which closes on Escape and announces itself as expanded. Inside, Mute is a checkbox and each volume is a range input inside its `<label>`, so all three work from the keyboard
- Visible words are the accessible names, so voice control users can say what they see: How to Play is named "Rules" on narrow phones, where that's the word it shows. Decorative arrows on the back and Next level buttons use CSS alt text (`content: "‹" / ""`), so they aren't read out
- The page declares its language

## Not yet

- The board is a canvas with no accessible name or text alternative, so a screen reader gets nothing from it
- Threads can only be laid with a pointer: mouse, touch or pen. There's no way to play from the keyboard

## Planned

- [ ] Screen reader support for the board: the pattern, the pegs and their numbers, the threads laid and which squares are woven
- [ ] Keyboard play: move between squares, start a thread at a peg and lay it a square at a time
