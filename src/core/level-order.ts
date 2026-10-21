export type OrderResult =
  | { readonly ok: true; readonly order: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

/** The play order must list every level exactly once, and nothing else. */
export function decodeOrder(json: unknown, ids: readonly string[]): OrderResult {
  if (!isStringArray(json)) {
    return { ok: false, errors: ["the order must be an array of level ids"] };
  }
  const order: readonly string[] = json;
  const known: ReadonlySet<string> = new Set<string>(ids);
  const errors: string[] = [];
  order.forEach((id: string, index: number): void => {
    if (order.indexOf(id) !== index) errors.push(`"${id}" is listed more than once`);
    else if (!known.has(id)) errors.push(`"${id}" is not a known level`);
  });
  for (const id of ids) {
    if (!order.includes(id)) errors.push(`"${id}" is missing from the order`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, order };
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item: unknown): boolean => typeof item === "string");
}
