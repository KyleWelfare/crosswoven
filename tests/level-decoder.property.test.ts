import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decodeLevel, encodeLevel } from "../src/core/level-decoder.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { randomWeaves, type Weave } from "./fixtures/random-weave.ts";

describe("decodeLevel properties", (): void => {
  it("decodes an encoded puzzle back to the same puzzle", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const puzzle: Puzzle = decoded(weave.level);
        expect(decodeLevel(encodeLevel(puzzle))).toEqual({ ok: true, puzzle });
      }),
    );
  });
});
