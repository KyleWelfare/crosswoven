import type { MixedColour, SquareColour, ThreadColour } from "../core/puzzle.ts";

/** The board's colours and font, read from the custom properties in src/styles/tokens.css. */
export interface Palette {
  readonly frame: string;
  readonly boardShadow: string;
  readonly pegShadow: string;
  readonly pegShine: string;
  readonly pegRim: string;
  /** On a tied peg; an untied one shows its number in its thread's colour. */
  readonly pegNumber: string;
  readonly weaveShadow: string;
  readonly font: string;
  /** Mixed colours dye both threads where they cross. */
  readonly thread: Readonly<Record<ThreadColour | MixedColour, string>>;
  readonly wash: Readonly<Record<SquareColour, string>>;
  /** Squares whose threads already match the pattern. */
  readonly woven: Readonly<Record<SquareColour, string>>;
}

export function readPalette(element: Element): Palette {
  const style: CSSStyleDeclaration = getComputedStyle(element);
  const css = (name: string): string => style.getPropertyValue(name).trim();
  return {
    frame: css("--board-frame"),
    boardShadow: css("--board-shadow"),
    pegShadow: css("--peg-shadow"),
    pegShine: css("--peg-shine"),
    pegRim: css("--peg-rim"),
    pegNumber: css("--peg-number"),
    weaveShadow: css("--weave-shadow"),
    font: css("--font-body"),
    thread: {
      red: css("--thread-red"),
      blue: css("--thread-blue"),
      yellow: css("--thread-yellow"),
      purple: css("--thread-purple"),
      orange: css("--thread-orange"),
      green: css("--thread-green"),
    },
    wash: {
      blank: css("--wash-blank"),
      red: css("--wash-red"),
      blue: css("--wash-blue"),
      yellow: css("--wash-yellow"),
      purple: css("--wash-purple"),
      orange: css("--wash-orange"),
      green: css("--wash-green"),
    },
    woven: {
      blank: css("--wash-blank"),
      red: css("--woven-red"),
      blue: css("--woven-blue"),
      yellow: css("--woven-yellow"),
      purple: css("--woven-purple"),
      orange: css("--woven-orange"),
      green: css("--woven-green"),
    },
  };
}
