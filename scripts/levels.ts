import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { generateLevel, type Generation } from "../src/core/generator.ts";
import { decodePicture, encodeLevel, type PictureResult } from "../src/core/level-decoder.ts";
import { formatPoint } from "../src/core/puzzle.ts";

const PICTURES: string = "pictures";
const LEVELS: string = join("src", "levels");

function makeLevel(file: string): boolean {
  const decoded: PictureResult = decodePicture(
    JSON.parse(readFileSync(join(PICTURES, file), "utf8")),
  );
  if (!decoded.ok) {
    console.error(`${file}: ${decoded.errors.join("; ")}`);
    return false;
  }
  if (decoded.picture.id !== basename(file, ".json")) {
    console.error(`${file}: id "${decoded.picture.id}" doesn't match the file name`);
    return false;
  }
  const generation: Generation = generateLevel(decoded.picture);
  if (!generation.ok) {
    console.error(
      `${file}: can't be woven; check ${generation.badSquares.map(formatPoint).join(" ")}`,
    );
    return false;
  }
  writeFileSync(join(LEVELS, file), `${levelJson(generation)}\n`);
  console.log(
    `${file}: ${generation.difficulty}, ${String(generation.puzzle.pegs.length)} pegs, ` +
      `${String(generation.attempts.length)} attempts`,
  );
  return true;
}

/** One peg per line, which Prettier then leaves alone. */
function levelJson(generation: Extract<Generation, { ok: true }>): string {
  return JSON.stringify(encodeLevel(generation.puzzle), null, 2).replace(
    /\{\s+"x": (\d+),\s+"y": (\d+),\s+"length": (\d+)\s+\}/g,
    '{ "x": $1, "y": $2, "length": $3 }',
  );
}

const files: readonly string[] = readdirSync(PICTURES)
  .filter((file: string): boolean => file.endsWith(".json"))
  .sort();
const made: readonly boolean[] = files.map(makeLevel);
if (made.includes(false)) process.exitCode = 1;
