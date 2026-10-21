import { describe, expect, it } from "vitest";
import { generateLevel, type Generation } from "../src/core/generator.ts";
import {
  decodeLevel,
  decodePicture,
  encodeLevel,
  type DecodeResult,
  type PictureResult,
} from "../src/core/level-decoder.ts";
import { decodeOrder, type OrderResult } from "../src/core/level-order.ts";
import { formatPoint } from "../src/core/puzzle.ts";
import { validateLevel, type Verdict } from "../src/core/validator.ts";
import order from "../src/levels/order.json";
import pictureOrder from "../pictures/order.json";

const levels: Readonly<Record<string, unknown>> = import.meta.glob(
  ["../src/levels/*.json", "!../src/levels/order.json"],
  { eager: true, import: "default" },
);

const pictures: Readonly<Record<string, unknown>> = import.meta.glob(
  ["../pictures/*.json", "!../pictures/order.json"],
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
    "%s passes the validator, with the id of its file name",
    (path: string, level: unknown): void => {
      const verdict: Verdict = validateLevel(level);
      expect(verdict.ok ? [] : verdict.errors, path).toEqual([]);
      if (verdict.ok) expect(verdict.puzzle.id).toBe(idOf(path));
    },
  );

  // The game keys levels by the id inside each file, so the order is checked against those.
  it("plays every level exactly once", (): void => {
    const ids: readonly string[] = Object.values(levels).flatMap((level: unknown): string[] => {
      const decoded: DecodeResult = decodeLevel(level);
      return decoded.ok ? [decoded.puzzle.id] : [];
    });
    const result: OrderResult = decodeOrder(order, ids);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("has one level per picture, in the pictures' order", (): void => {
    expect(Object.keys(levels).map(idOf).sort()).toEqual(Object.keys(pictures).map(idOf).sort());
    expect(order).toEqual(pictureOrder);
  });

  it.each(Object.entries(pictures))(
    "%s still generates its shipped level",
    (path: string, json: unknown): void => {
      const picture: PictureResult = decodePicture(json);
      if (!picture.ok) throw new Error(`${path}: ${picture.errors.join("; ")}`);
      const generation: Generation = generateLevel(picture.picture);
      if (!generation.ok) {
        const squares: string = generation.badSquares.map(formatPoint).join(" ");
        throw new Error(`${path} no longer generates a level: ${generation.reason} at ${squares}`);
      }
      expect(encodeLevel(generation.puzzle)).toEqual(levels[`../src/levels/${idOf(path)}.json`]);
    },
  );
});
