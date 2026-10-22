import type { Msg } from "../app/messages.ts";
import type { SoundChannel } from "../app/progress.ts";
import { requiredElement } from "./required-element.ts";
import type { SoundSettings } from "./speaker.ts";

/**
 * One popover holds mute and the volume sliders, opened by the speaker button on the menu or in a
 * level. Being a native popover, it closes on Escape or a tap outside with no state of our own.
 */
export interface SoundPanel {
  readonly panel: HTMLElement;
  /** The speaker buttons that open it. */
  readonly openers: readonly HTMLButtonElement[];
  readonly mute: HTMLInputElement;
  readonly sliders: Readonly<Record<SoundChannel, HTMLInputElement>>;
}

const GAP_PX: number = 8;

export function findSoundPanel(root: ParentNode): SoundPanel {
  return {
    panel: requiredElement(root, "#sound-panel", HTMLElement),
    openers: [...root.querySelectorAll<HTMLButtonElement>("button[data-sound]")],
    mute: requiredElement(root, "#mute", HTMLInputElement),
    sliders: {
      effects: requiredElement(root, "#effects-volume", HTMLInputElement),
      music: requiredElement(root, "#music-volume", HTMLInputElement),
    },
  };
}

export function listenToSoundPanel(view: SoundPanel, dispatch: (msg: Msg) => void): void {
  // The opener's click runs before the popover opens, so the panel can be placed under it first.
  for (const opener of view.openers) {
    opener.addEventListener("click", (): void => {
      placeUnder(view.panel, opener);
    });
  }
  // A panel left open would float away from its button as the layout changes.
  window.addEventListener("resize", (): void => {
    if (view.panel.matches(":popover-open")) view.panel.hidePopover();
  });
  view.mute.addEventListener("change", (): void => {
    dispatch({ type: "MuteToggled" });
  });
  for (const channel of ["effects", "music"] as const) {
    const slider: HTMLInputElement = view.sliders[channel];
    slider.addEventListener("input", (): void => {
      dispatch({ type: "VolumeChanged", channel, volume: Number(slider.value) });
    });
  }
}

export function renderSoundPanel(view: SoundPanel, settings: SoundSettings): void {
  if (view.mute.checked !== settings.muted) view.mute.checked = settings.muted;
  for (const channel of ["effects", "music"] as const) {
    const slider: HTMLInputElement = view.sliders[channel];
    if (Number(slider.value) !== settings.volume[channel]) {
      slider.value = String(settings.volume[channel]);
    }
  }
  // The crossed-out icon only shows muted, so the name says it too.
  const name: string = settings.muted ? "Sound, muted" : "Sound";
  for (const opener of view.openers) {
    opener.toggleAttribute("data-muted", settings.muted);
    if (opener.ariaLabel !== name) opener.ariaLabel = name;
  }
}

/** Right-aligned under the button, and kept on screen when the button sits near the left edge. */
function placeUnder(panel: HTMLElement, opener: HTMLElement): void {
  const bounds: DOMRect = opener.getBoundingClientRect();
  panel.style.top = `${String(bounds.bottom + GAP_PX)}px`;
  panel.style.right = `${String(Math.max(window.innerWidth - bounds.right, GAP_PX))}px`;
}
