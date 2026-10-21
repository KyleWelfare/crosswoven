import type { SquareColour, ThreadColour } from "../core/puzzle.ts";

/** The board's colours, read from the custom properties in src/styles/tokens.css. */
export interface Palette {
  readonly frame: string;
  readonly boardShadow: string;
  readonly pegShadow: string;
  readonly pegShine: string;
  readonly weaveShadow: string;
  readonly shade: string;
  readonly thread: Readonly<Record<ThreadColour, string>>;
  readonly wash: Readonly<Record<SquareColour, string>>;
}

export function readPalette(element: Element): Palette {
  const style: CSSStyleDeclaration = getComputedStyle(element);
  const css = (name: string): string => style.getPropertyValue(name).trim();
  return {
    frame: css("--board-frame"),
    boardShadow: css("--board-shadow"),
    pegShadow: css("--peg-shadow"),
    pegShine: css("--peg-shine"),
    weaveShadow: css("--weave-shadow"),
    shade: css("--thread-shade"),
    thread: {
      red: css("--thread-red"),
      blue: css("--thread-blue"),
      yellow: css("--thread-yellow"),
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
  };
}
