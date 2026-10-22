import { describe, expect, it } from "vitest";
import {
  decodeProgress,
  isUnlocked,
  noProgress,
  withCleared,
  withMuteToggled,
  withTheme,
  withTipSeen,
  withVolume,
  type Progress,
} from "../src/app/progress.ts";

describe("progress", (): void => {
  it("adds a cleared level once", (): void => {
    const cleared: Progress = withCleared(noProgress, "key");
    expect(cleared).toEqual({ ...noProgress, cleared: ["key"] });
    expect(withCleared(cleared, "key")).toBe(cleared);
    expect(noProgress.cleared).toEqual([]);
  });

  it("adds a seen tip once", (): void => {
    const seen: Progress = withTipSeen(noProgress, "drag");
    expect(seen).toEqual({ ...noProgress, tipsSeen: ["drag"] });
    expect(withTipSeen(seen, "drag")).toBe(seen);
  });

  it("changes the theme only when it differs", (): void => {
    const dark: Progress = withTheme(noProgress, "dark");
    expect(dark).toEqual({ ...noProgress, theme: "dark" });
    expect(withTheme(dark, "dark")).toBe(dark);
  });

  it("opens the first level, then each level once the one before it is cleared", (): void => {
    const order: readonly string[] = ["key", "ladder", "heart"];
    const unlocked = (progress: Progress): boolean[] =>
      order.map((_: string, i: number): boolean => isUnlocked(progress, order, i));
    expect(unlocked(noProgress)).toEqual([true, false, false]);
    expect(unlocked(withCleared(noProgress, "key"))).toEqual([true, true, false]);
    expect(unlocked(withCleared(withCleared(noProgress, "key"), "ladder"))).toEqual([
      true,
      true,
      true,
    ]);
    expect(isUnlocked(noProgress, order, 3)).toBe(false);
  });

  it("decodes what it saves", (): void => {
    const progress: Progress = {
      cleared: ["key", "ladder"],
      tipsSeen: ["drag"],
      theme: "light",
      muted: true,
      volume: { effects: 0.4, music: 0 },
    };
    expect(decodeProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress);
  });

  it("reads anything that isn't an object as no progress", (): void => {
    for (const json of [null, undefined, 3, "key", true]) {
      expect(decodeProgress(json)).toBe(noProgress);
    }
  });

  it("keeps only the strings of each list, once each, and drops a list that isn't one", (): void => {
    expect(decodeProgress({ cleared: ["key", 4, null, "key"], tipsSeen: "drag" })).toEqual({
      cleared: ["key"],
      tipsSeen: [],
      theme: "system",
      muted: false,
      volume: { effects: 1, music: 1 },
    });
    expect(decodeProgress({})).toEqual(noProgress);
  });

  it("reads an unknown or missing theme as System, as a save from before themes has none", (): void => {
    expect(decodeProgress({ cleared: [], tipsSeen: [], theme: "sepia" }).theme).toBe("system");
    expect(decodeProgress({ cleared: ["key"], tipsSeen: [] }).theme).toBe("system");
  });

  it("toggles mute", (): void => {
    const muted: Progress = withMuteToggled(noProgress);
    expect(muted.muted).toBe(true);
    expect(withMuteToggled(muted)).toEqual(noProgress);
  });

  it("reads mute as on only when saved as true, so sound is on for an older save", (): void => {
    expect(decodeProgress({ muted: true }).muted).toBe(true);
    for (const muted of [false, "true", 1, undefined]) {
      expect(decodeProgress({ muted }).muted).toBe(false);
    }
  });

  it("sets a volume, clamped to 0 to 1, and returns the same progress when unchanged", (): void => {
    const quieter: Progress = withVolume(noProgress, "effects", 0.5);
    expect(quieter.volume).toEqual({ effects: 0.5, music: 1 });
    expect(withVolume(quieter, "effects", 0.5)).toBe(quieter);
    expect(withVolume(noProgress, "music", -1).volume.music).toBe(0);
    expect(withVolume(noProgress, "music", 3)).toBe(noProgress);
  });

  it("reads a missing or out-of-range volume as full, so an older save keeps the game's mix", (): void => {
    expect(decodeProgress({}).volume).toEqual({ effects: 1, music: 1 });
    expect(decodeProgress({ volume: { effects: 0.3, music: 2 } }).volume).toEqual({
      effects: 0.3,
      music: 1,
    });
    expect(decodeProgress({ volume: "loud" }).volume).toEqual({ effects: 1, music: 1 });
  });
});
