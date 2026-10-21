import {
  MAX_SIZE,
  MIN_SIZE,
  THREAD_COLOURS,
  formatPoint,
  isThreadColour,
  threadsThrough,
  type Peg,
  type Point,
  type Puzzle,
  type SquareColour,
  type ThreadColour,
} from "./puzzle.ts";

export type DecodeResult =
  | { readonly ok: true; readonly puzzle: Puzzle }
  | { readonly ok: false; readonly errors: readonly string[] };

type Pattern = readonly (readonly SquareColour[])[];

type JsonObject = Readonly<Record<string, unknown>>;

type PegEntry = Omit<Peg, "colour">;

const SUPPORTED_VERSION: number = 2;

const squareCodes: ReadonlyMap<string, SquareColour> = new Map<string, SquareColour>([
  [".", "blank"],
  ["R", "red"],
  ["B", "blue"],
  ["Y", "yellow"],
  ["P", "purple"],
  ["O", "orange"],
  ["G", "green"],
]);

/** Checks shape only: whether the pattern can be woven is the validator's job. */
export function decodeLevel(json: unknown): DecodeResult {
  if (!isJsonObject(json)) return { ok: false, errors: ["the level must be a JSON object"] };

  const errors: string[] = [];
  checkVersion(json["version"], errors);
  const id: string | undefined = decodeText(json, "id", errors);
  const title: string | undefined = decodeText(json, "title", errors);
  const pattern: Pattern | undefined = decodePattern(json["pattern"], errors);
  const entries: readonly PegEntry[] | undefined = decodePegEntries(json["pegs"], errors);
  // Placement and counts only mean something once the pattern and every peg are well formed.
  const pegs: readonly Peg[] | undefined =
    pattern && entries ? placePegs(entries, pattern, errors) : undefined;
  if (pattern && pegs) checkPegCounts(pegs, pattern, errors);

  if (errors.length > 0 || id === undefined || title === undefined || !pattern || !pegs) {
    return { ok: false, errors };
  }
  const width: number = pattern[0]?.length ?? 0;
  return { ok: true, puzzle: { id, title, width, height: pattern.length, pattern, pegs } };
}

function checkVersion(value: unknown, errors: string[]): void {
  if (value === undefined) errors.push(`missing field "version"`);
  else if (value !== SUPPORTED_VERSION) {
    errors.push(
      `unsupported version ${JSON.stringify(value)}; expected ${String(SUPPORTED_VERSION)}`,
    );
  }
}

function decodeText(json: JsonObject, field: string, errors: string[]): string | undefined {
  const value: unknown = json[field];
  if (value === undefined) errors.push(`missing field "${field}"`);
  else if (typeof value !== "string" || value.length === 0) {
    errors.push(`"${field}" must be a non-empty string`);
  } else return value;
  return undefined;
}

function decodePattern(value: unknown, errors: string[]): Pattern | undefined {
  if (value === undefined) {
    errors.push(`missing field "pattern"`);
    return undefined;
  }
  if (!Array.isArray(value) || !value.every((row: unknown): boolean => typeof row === "string")) {
    errors.push(`"pattern" must be an array of strings`);
    return undefined;
  }

  const rows: readonly string[][] = (value as readonly string[]).map((row: string): string[] =>
    Array.from(row),
  );
  const countBefore: number = errors.length;
  checkSize(rows, errors);
  const pattern: Pattern = rows.map((row: readonly string[], y: number): SquareColour[] =>
    row.map((code: string, x: number): SquareColour => decodeSquare(code, x, y, errors)),
  );
  return errors.length === countBefore ? pattern : undefined;
}

function checkSize(rows: readonly (readonly string[])[], errors: string[]): void {
  const range: string = `${String(MIN_SIZE)} to ${String(MAX_SIZE)}`;
  if (!inSizeRange(rows.length)) {
    errors.push(`the pattern has ${String(rows.length)} rows; it needs ${range}`);
  }
  const first: readonly string[] | undefined = rows[0];
  if (!first) return;
  if (!inSizeRange(first.length)) {
    errors.push(`row 0 has ${String(first.length)} squares; rows need ${range}`);
  }
  rows.forEach((row: readonly string[], y: number): void => {
    if (row.length !== first.length) {
      errors.push(
        `row ${String(y)} has ${String(row.length)} squares; row 0 has ${String(first.length)}`,
      );
    }
  });
}

function inSizeRange(size: number): boolean {
  return size >= MIN_SIZE && size <= MAX_SIZE;
}

function decodeSquare(code: string, x: number, y: number, errors: string[]): SquareColour {
  const square: SquareColour | undefined = squareCodes.get(code);
  if (square) return square;
  errors.push(`unknown pattern code "${code}" at ${formatPoint({ x, y })}`);
  return "blank";
}

function decodePegEntries(value: unknown, errors: string[]): readonly PegEntry[] | undefined {
  if (value === undefined) {
    errors.push(`missing field "pegs"`);
    return undefined;
  }
  if (!Array.isArray(value)) {
    errors.push(`"pegs" must be an array`);
    return undefined;
  }

  const entries: PegEntry[] = [];
  (value as readonly unknown[]).forEach((json: unknown, index: number): void => {
    const entry: PegEntry | undefined = decodePegEntry(json, index, errors);
    if (entry) entries.push(entry);
  });
  return entries.length === value.length ? entries : undefined;
}

function decodePegEntry(json: unknown, index: number, errors: string[]): PegEntry | undefined {
  if (!isPoint(json)) {
    errors.push(`peg ${String(index)} must be an object with integer "x" and "y"`);
    return undefined;
  }
  const label: string = `peg ${String(index)} at ${formatPoint(json)}`;
  const length: unknown = json["length"];
  if (length === undefined) errors.push(`${label} is missing "length"`);
  else if (typeof length !== "number" || !Number.isInteger(length) || length < 1) {
    errors.push(
      `${label} has length ${JSON.stringify(length)}; it must be a whole number from 1 up`,
    );
  } else return { x: json.x, y: json.y, length };
  return undefined;
}

function isPoint(value: unknown): value is JsonObject & Point {
  return isJsonObject(value) && Number.isInteger(value["x"]) && Number.isInteger(value["y"]);
}

function placePegs(
  entries: readonly PegEntry[],
  pattern: Pattern,
  errors: string[],
): readonly Peg[] | undefined {
  const countBefore: number = errors.length;
  const pegs: Peg[] = [];
  const firstIndexAt: Map<string, number> = new Map<string, number>();

  entries.forEach((entry: PegEntry, index: number): void => {
    const label: string = `peg ${String(index)} at ${formatPoint(entry)}`;
    const square: SquareColour | undefined = pattern[entry.y]?.[entry.x];
    if (square === undefined) {
      errors.push(`${label} is outside the grid`);
      return;
    }
    const key: string = formatPoint(entry);
    const firstIndex: number | undefined = firstIndexAt.get(key);
    if (firstIndex !== undefined) {
      errors.push(`${label} is a duplicate of peg ${String(firstIndex)}`);
      return;
    }
    firstIndexAt.set(key, index);
    if (isThreadColour(square)) pegs.push({ ...entry, colour: square });
    else errors.push(`${label} is on a ${square} square`);
  });
  return errors.length === countBefore ? pegs : undefined;
}

function checkPegCounts(pegs: readonly Peg[], pattern: Pattern, errors: string[]): void {
  const used: ReadonlySet<ThreadColour> = new Set<ThreadColour>(
    pattern
      .flat()
      .flatMap((square: SquareColour): readonly ThreadColour[] => threadsThrough(square)),
  );
  for (const colour of THREAD_COLOURS) {
    const ofColour: readonly Peg[] = pegs.filter((peg: Peg): boolean => peg.colour === colour);
    if (ofColour.length === 0 && used.has(colour)) {
      errors.push(`the pattern uses ${colour} but there are no ${colour} pegs`);
    }
    checkPairs(colour, ofColour, errors);
  }
}

/** A length-1 peg is a whole thread; longer ones pair with a peg of the same colour and length. */
function checkPairs(colour: ThreadColour, pegs: readonly Peg[], errors: string[]): void {
  const lengths: readonly number[] = [...new Set(pegs.map((peg: Peg): number => peg.length))]
    .filter((length: number): boolean => length > 1)
    .sort((a: number, b: number): number => a - b);
  for (const length of lengths) {
    const count: number = pegs.filter((peg: Peg): boolean => peg.length === length).length;
    if (count % 2 === 1) {
      errors.push(
        `${colour} pegs of length ${String(length)} can't all pair up (found ${String(count)})`,
      );
    }
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
