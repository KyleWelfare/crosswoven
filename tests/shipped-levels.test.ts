import { describe, expect, it } from "vitest";
import { validateLevel, type Verdict } from "../src/core/validator.ts";

const levels: Readonly<Record<string, unknown>> = import.meta.glob("../src/levels/*.json", {
  eager: true,
  import: "default",
});

describe("shipped levels", (): void => {
  it("all pass the validator", (): void => {
    for (const [path, level] of Object.entries(levels)) {
      const verdict: Verdict = validateLevel(level);
      expect(verdict.ok ? [] : verdict.errors, path).toEqual([]);
    }
  });
});
