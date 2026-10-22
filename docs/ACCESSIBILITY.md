# Accessibility

What the game supports for screen reader and keyboard users today, and what's still to do.

## Supported

- Every control is a native button with a text label, so it works from the keyboard and shows a focus ring: the menu, the back buttons, How to Play, Undo, Clear and Next level (`src/styles/dock.css`), and the level tiles (`src/styles/level-list.css`)
- Level tiles are named "Level 3, 7 by 7", with ", cleared" or ", locked" after. A locked tile uses `aria-disabled` rather than `disabled`, so it stays focusable and announced; its pattern thumbnail and padlock are hidden from screen readers
- Each screen has its own `h1`. As a screen appears, focus moves to its heading (Play on the menu), so focus never stays on a button that just vanished (`src/view/screens.ts`)
- How to Play opens from a button in each level's top bar. It's a native modal `<dialog>`: it focuses its heading as it opens, so it starts at the top on a short screen, traps focus, closes on Escape, and returns focus to the button that opened it
- The tutorial card's text sits in an `aria-live="polite"` region, so each step is announced. Skip tutorial and OK are native buttons, and the controls under the shade are made `inert`
- The win message sits in an `aria-live="polite"` region, so screen readers announce a solved level
- How the Puzzles Are Made steps with Back and Next or the arrow keys. Its actor, heading and caption sit in an `aria-live="polite"` region, and the timeline marks the current step with `aria-current="step"`. The board and the badge that counts along with each animation are hidden from screen readers, since the caption describes the step. With reduced motion set, every animation shows its final frame, still
- The masthead braid and the menu's weaving board are decorative and hidden from screen readers. With reduced motion set, the menu board shows its finished weave, still
- The Theme picker is a native `<select>` inside its `<label>`, so it is named "Theme" and works from the keyboard
- The speaker buttons are named "Sound", or "Sound, muted", since the crossed-out icon only shows it. They open the sound panel, a native popover with `role="dialog"` named "Sound", which closes on Escape and announces itself as expanded. Inside, Mute is a checkbox and each volume is a range input inside its `<label>`, so all three work from the keyboard
- Visible words are the accessible names, so voice control users can say what they see: How to Play is named "Rules" on narrow phones, where that's the word it shows. Decorative arrows on the back and Next level buttons use CSS alt text (`content: "‹" / ""`), so they aren't read out
- The page declares its language

## The board

Mouse and touch are the intended controls, so the tutorial teaches only those, and How to Play keeps the keys in a Keyboard controls section that starts collapsed (a native `<details>`). The board's description, read whenever it gets focus, explains them too.

- **Keyboard play.** The board is in the tab order. Arrow keys move a cursor square, Enter or Space picks up the thread at a peg (or a laid thread at that square) and lays it down again. A peg marked 1 ties in one press, as one tap does. While a thread is held, the arrows lay it a square at a time, Backspace takes back a square and Escape drops it. Moving focus off the board drops a held thread. Keys become `BoardKeyPressed` messages, so they go through the same rules as a drag and are unit tested in `tests/update.test.ts`
- **Visible focus.** The cursor is drawn on the canvas as an ink square edged in the page colour, so it shows on every square in both themes. It appears only for keyboard focus, and a press on the board hides it again
- **Screen readers.** The canvas has `role="application"`, so screen readers pass the arrow keys through, with `aria-roledescription="board"`. It's named by the level title and described by the key instructions and a summary: its size, pegs tied and coloured squares woven
- **Narration.** A polite live region announces each square the cursor reaches (its colour, any peg with its number and whether it's tied, the threads through it, whether it's woven), how far a held thread has come, ties with a count of pegs tied, and why a key did nothing (the edge, a thread at full length or already tied, a square it can't enter). Undo and Clear are announced too. The text comes from `src/app/narration.ts`, a pure function of the old model, new model and message, tested in `tests/narration.test.ts`. A solve is left to the win message
- Nothing about the board animates beyond the existing win fade, so reduced motion needs nothing new

## Not yet

- [ ] Checked with a real screen reader (NVDA on Windows). So far the narration has only been read back from the live region in headless Chrome
