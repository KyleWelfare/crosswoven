/** What survives a reload: levels cleared and tutorial tips seen, by id. */
export interface Progress {
  readonly cleared: readonly string[];
  readonly tipsSeen: readonly string[];
}

export const noProgress: Progress = { cleared: [], tipsSeen: [] };

/** Returns `progress` itself when the level was already cleared. */
export function withCleared(progress: Progress, levelId: string): Progress {
  if (progress.cleared.includes(levelId)) return progress;
  return { ...progress, cleared: [...progress.cleared, levelId] };
}

/** Returns `progress` itself when the tip was already seen. */
export function withTipSeen(progress: Progress, tip: string): Progress {
  if (progress.tipsSeen.includes(tip)) return progress;
  return { ...progress, tipsSeen: [...progress.tipsSeen, tip] };
}

/** The first level is always open; each one after opens once the level before it is cleared. */
export function isUnlocked(progress: Progress, order: readonly string[], index: number): boolean {
  if (index === 0) return true;
  const before: string | undefined = order[index - 1];
  return before !== undefined && progress.cleared.includes(before);
}

/**
 * Anything malformed reads as no progress rather than an error: a save edited by hand or written
 * by an older version shouldn't stop the game loading.
 */
export function decodeProgress(json: unknown): Progress {
  if (typeof json !== "object" || json === null) return noProgress;
  const saved: Partial<Record<keyof Progress, unknown>> = json;
  return { cleared: strings(saved.cleared), tipsSeen: strings(saved.tipsSeen) };
}

function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item: unknown): item is string => typeof item === "string"))];
}
