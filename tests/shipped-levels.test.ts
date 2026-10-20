import { describe, expect, it } from "vitest";
import { validateLevel, type Verdict } from "../src/core/validator.ts";

const levels: Readonly<Record<string, unknown>> = import.meta.glob("../src/levels/*.json", {
  eager: true,
  import: "default",
});

describe("shipped levels", (): void => {
  // No levels ship yet. This goes red when the first one lands, as the prompt to make it a plain it().
  it.fails("finds at least one level", (): void => {
    expect(Object.keys(levels)).not.toHaveLength(0);
  });

  it.each(Object.entries(levels))(
    "%s passes the validator",
    (path: string, level: unknown): void => {
      const verdict: Verdict = validateLevel(level);
      expect(verdict.ok ? [] : verdict.errors, path).toEqual([]);
    },
  );
});
