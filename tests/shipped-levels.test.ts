import { describe, expect, it } from "vitest";
import { decodeOrder, type OrderResult } from "../src/core/level-order.ts";
import { validateLevel, type Verdict } from "../src/core/validator.ts";
import order from "../src/levels/order.json";

const levels: Readonly<Record<string, unknown>> = import.meta.glob(
  ["../src/levels/*.json", "!../src/levels/order.json"],
  { eager: true, import: "default" },
);

function idOf(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.json$/, "");
}

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

  it("plays every level exactly once", (): void => {
    const result: OrderResult = decodeOrder(order, Object.keys(levels).map(idOf));
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
