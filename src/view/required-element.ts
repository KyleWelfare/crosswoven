export function requiredElement<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new () => T,
): T {
  const element: Element | null = root.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`${selector} not found`);
  return element;
}
