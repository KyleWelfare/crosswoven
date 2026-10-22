import type { Progress } from "../app/progress.ts";
import type { SoundCue } from "../app/sound-cues.ts";
import type { ThreadColour } from "../core/puzzle.ts";

/**
 * Plays the game's sound: plucked-string effects synthesised here, so there are no effect files
 * to license, and an optional music loop. Holds the one AudioContext, which browsers only let
 * start from a tap or key press.
 */
export interface Speaker {
  readonly musicUrl: string | undefined;
  graph: Graph | undefined;
  settings: SoundSettings;
  hidden: boolean;
}

export type SoundSettings = Pick<Progress, "muted" | "volume">;

interface Graph {
  readonly context: AudioContext;
  readonly effects: GainNode;
  readonly music: GainNode;
  /** One plucked note per step of the scale, synthesised once. */
  readonly plucks: readonly AudioBuffer[];
}

// The mix with both sliders at full: nothing near full scale, as a phone speaker distorts loud
// plucks.
const MASTER_GAIN: number = 0.7;
// The loop is mastered quietly, peaking at a quarter of full scale, so it needs more gain than
// the plucks to sit level with the softest of them.
const MUSIC_GAIN: number = 0.5;
const EFFECTS_GAIN: number = 0.6;
const MUSIC_FADE_IN_S: number = 3;
const EFFECTS_LOWPASS_HZ: number = 3200;

/** D major pentatonic over two octaves: any two notes sound fine together, so overlaps never clash. */
const SCALE_HZ: readonly number[] = [
  293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.26, 739.99, 880, 987.77,
];

/** Each colour starts a step higher, so red, blue and yellow threads are told apart by ear. */
const COLOUR_OFFSET: Readonly<Record<ThreadColour, number>> = { red: 0, blue: 1, yellow: 2 };

export function createSpeaker(musicUrl: string | undefined, settings: SoundSettings): Speaker {
  return { musicUrl, graph: undefined, settings, hidden: document.hidden };
}

/**
 * Builds the audio graph on the first press and resumes it on later ones until it runs: some
 * mobile browsers only unlock audio on a particular kind of gesture.
 */
export function wakeOnGesture(speaker: Speaker): void {
  const wake = (): void => {
    if (!speaker.graph) {
      speaker.graph = buildGraph(speaker.settings);
      void startMusic(speaker, speaker.graph);
    }
    applyState(speaker);
    if (speaker.graph.context.state === "running") {
      for (const type of GESTURES) document.removeEventListener(type, wake, true);
    }
  };
  for (const type of GESTURES) document.addEventListener(type, wake, true);
  // Music playing from a background tab or a locked phone would be unwelcome.
  document.addEventListener("visibilitychange", (): void => {
    speaker.hidden = document.hidden;
    applyState(speaker);
  });
}

const GESTURES: readonly string[] = ["pointerdown", "touchend", "click", "keydown"];

export function setSettings(speaker: Speaker, settings: SoundSettings): void {
  const before: SoundSettings = speaker.settings;
  speaker.settings = settings;
  if (before.muted !== settings.muted) applyState(speaker);
  if (before.volume !== settings.volume && speaker.graph) {
    const now: number = speaker.graph.context.currentTime;
    // A short glide, so dragging a slider doesn't click.
    speaker.graph.effects.gain.setTargetAtTime(effectsGain(settings), now, 0.03);
    speaker.graph.music.gain.setTargetAtTime(musicGain(settings), now, 0.03);
  }
}

/** Squared, as loudness follows gain far from linearly: halfway on a slider then sounds halfway. */
function effectsGain(settings: SoundSettings): number {
  return EFFECTS_GAIN * settings.volume.effects ** 2;
}

function musicGain(settings: SoundSettings): number {
  return MUSIC_GAIN * settings.volume.music ** 2;
}

export function play(speaker: Speaker, cues: readonly SoundCue[]): void {
  const graph: Graph | undefined = speaker.graph;
  if (!graph || speaker.settings.muted || graph.context.state !== "running") return;
  for (const cue of cues) {
    for (const note of notesFor(cue)) pluck(graph, note);
  }
}

interface Note {
  readonly step: number;
  /** Seconds after now. */
  readonly delay: number;
  readonly gain: number;
}

function notesFor(cue: SoundCue): readonly Note[] {
  switch (cue.kind) {
    case "step":
      return [{ step: scaleStep(cue.colour, cue.length), delay: 0, gain: 0.16 }];
    case "tie": {
      const step: number = scaleStep(cue.colour, cue.length);
      return [
        { step, delay: 0, gain: 0.28 },
        { step: step + 2, delay: 0.06, gain: 0.24 },
      ];
    }
    case "undo":
      return [
        { step: 2, delay: 0, gain: 0.14 },
        { step: 0, delay: 0.07, gain: 0.14 },
      ];
    case "clear":
      return [4, 2, 0].map((step: number, i: number): Note => ({
        step,
        delay: i * 0.06,
        gain: 0.14,
      }));
    case "solve":
      return [0, 2, 4, 5, 7, 9].map((step: number, i: number): Note => ({
        step,
        delay: i * 0.09,
        gain: 0.26,
      }));
    case "preview":
      return [{ step: 5, delay: 0, gain: 0.2 }];
  }
}

/** Climbs the scale as a thread grows, so a long drag rises in pitch. */
function scaleStep(colour: ThreadColour, length: number): number {
  return Math.min(COLOUR_OFFSET[colour] + length - 1, SCALE_HZ.length - 1);
}

function pluck(graph: Graph, note: Note): void {
  const buffer: AudioBuffer | undefined = graph.plucks[note.step];
  if (!buffer) return;
  const source: AudioBufferSourceNode = graph.context.createBufferSource();
  source.buffer = buffer;
  const gain: GainNode = graph.context.createGain();
  gain.gain.value = note.gain;
  source.connect(gain).connect(graph.effects);
  source.start(graph.context.currentTime + note.delay);
}

function buildGraph(settings: SoundSettings): Graph {
  const context: AudioContext = new AudioContext();
  const master: GainNode = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);
  const soften: BiquadFilterNode = context.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = EFFECTS_LOWPASS_HZ;
  soften.connect(master);
  const effects: GainNode = context.createGain();
  effects.gain.value = effectsGain(settings);
  effects.connect(soften);
  const music: GainNode = context.createGain();
  music.gain.value = 0;
  music.connect(master);
  const plucks: readonly AudioBuffer[] = SCALE_HZ.map((hz: number): AudioBuffer =>
    pluckBuffer(context, hz),
  );
  return { context, effects, music, plucks };
}

async function startMusic(speaker: Speaker, graph: Graph): Promise<void> {
  if (!speaker.musicUrl) return;
  try {
    const response: Response = await fetch(speaker.musicUrl);
    const loop: AudioBuffer = await graph.context.decodeAudioData(await response.arrayBuffer());
    // A buffer source loops without the gap an <audio> element leaves at the seam.
    const source: AudioBufferSourceNode = graph.context.createBufferSource();
    source.buffer = loop;
    source.loop = true;
    source.connect(graph.music);
    source.start();
    const now: number = graph.context.currentTime;
    graph.music.gain.setValueAtTime(0, now);
    graph.music.gain.linearRampToValueAtTime(musicGain(speaker.settings), now + MUSIC_FADE_IN_S);
  } catch {
    // The game plays on silently if the loop can't load.
  }
}

/** Suspending rather than silencing stops the music where it is and saves a phone's battery. */
function applyState(speaker: Speaker): void {
  const context: AudioContext | undefined = speaker.graph?.context;
  if (!context) return;
  if (speaker.settings.muted || speaker.hidden) void context.suspend();
  else void context.resume();
}

/**
 * Karplus-Strong: a burst of noise circulating through a delay line one period long, averaged
 * each pass, rings and fades like a plucked string. Smoothing the burst first takes the edge off.
 */
function pluckBuffer(context: AudioContext, hz: number): AudioBuffer {
  const seconds: number = 1.4;
  const decay: number = 0.996;
  const length: number = Math.floor(context.sampleRate * seconds);
  const buffer: AudioBuffer = context.createBuffer(1, length, context.sampleRate);
  const out: Float32Array = buffer.getChannelData(0);
  const ring: Float32Array = new Float32Array(Math.round(context.sampleRate / hz));
  for (let i: number = 0; i < ring.length; i++) ring[i] = Math.random() * 2 - 1;
  for (let pass: number = 0; pass < 2; pass++) {
    for (let i: number = 1; i < ring.length; i++)
      ring[i] = ((ring[i] ?? 0) + (ring[i - 1] ?? 0)) / 2;
  }
  let peak: number = 0;
  for (let i: number = 0; i < length; i++) {
    const at: number = i % ring.length;
    const sample: number = ring[at] ?? 0;
    ring[at] = decay * 0.5 * (sample + (ring[(at + 1) % ring.length] ?? 0));
    out[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak > 0) for (let i: number = 0; i < length; i++) out[i] = (out[i] ?? 0) / peak;
  return buffer;
}
