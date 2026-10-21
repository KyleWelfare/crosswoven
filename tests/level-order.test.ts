import { describe, expect, it } from "vitest";
import { decodeOrder } from "../src/core/level-order.ts";

const ids: readonly string[] = ["key", "heart", "sun"];

describe("decodeOrder", (): void => {
  it("accepts every level exactly once, in any order", (): void => {
    expect(decodeOrder(["sun", "key", "heart"], ids)).toEqual({
      ok: true,
      order: ["sun", "key", "heart"],
    });
  });

  it("rejects anything but an array of ids", (): void => {
    expect(decodeOrder({ order: ids }, ids)).toEqual({
      ok: false,
      errors: ["the order must be an array of level ids"],
    });
    expect(decodeOrder(["key", 2], ids)).toMatchObject({ ok: false });
  });

  it("names duplicates, unknown ids and missing levels", (): void => {
    expect(decodeOrder(["key", "key", "kite", "sun"], ids)).toEqual({
      ok: false,
      errors: [
        `"key" is listed more than once`,
        `"kite" has no level`,
        `"heart" is missing from the order`,
      ],
    });
  });
});
