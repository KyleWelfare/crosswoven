import { describe, expect, it } from "vitest";
import { validateLevel, type Verdict } from "../src/core/validator.ts";

const levels: Readonly<Record<string, unknown>> = import.meta.glob("../src/levels/*.json", {
  eager: true,
  import: "default",
});

describe("shipped levels", (): void => {
  it("finds at least one level", (): void => {
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
