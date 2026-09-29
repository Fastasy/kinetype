// Procedural audio. No asset files, so the build carries zero audio weight.
//
// Sound is ranked first on cost-effectiveness by the "Juice It or Lose It" talk,
// and it changes PERCEIVED physics, not just mood. For a typing game the two
// mandatory sounds are correct key and wrong key, and they must be both audible
// and visible, because the player is looking at their keyboard.

type Voice = "correct" | "wrong" | "block" | "commitMid" | "commitHeavy"
  | "hit" | "parry" | "ko" | "spark" | "ui";

interface Recipe {
  freq: number;
  type: OscillatorType;
  duration: number;
  gain: number;
  /** Optional second partial, a fifth or octave above. */
  overtone?: number;
}

const RECIPES: Record<Voice, Recipe> = {
  correct: { freq: 880, type: "square", duration: 0.028, gain: 0.035 },
  wrong: { freq: 150, type: "sawtooth", duration: 0.09, gain: 0.05 },
  // Block: a dull thud with a metallic edge, nothing like a hit landing.
  block: { freq: 320, type: "square", duration: 0.09, gain: 0.055, overtone: 1.33 },
  commitMid: { freq: 300, type: "triangle", duration: 0.1, gain: 0.085, overtone: 1.5 },
  commitHeavy: { freq: 200, type: "sawtooth", duration: 0.16, gain: 0.1, overtone: 1.25 },
  hit: { freq: 110, type: "square", duration: 0.12, gain: 0.09, overtone: 0.5 },
  parry: { freq: 1250, type: "sine", duration: 0.16, gain: 0.09, overtone: 1.5 },
  ko: { freq: 70, type: "sawtooth", duration: 0.5, gain: 0.12, overtone: 0.5 },
  spark: { freq: 1600, type: "sine", duration: 0.1, gain: 0.06, overtone: 2 },
  ui: { freq: 660, type: "sine", duration: 0.05, gain: 0.04 },
};

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture on most browsers. */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    type WindowWithAudio = Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const w = window as WindowWithAudio;
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }

  play(voice: Voice, detune = 0): void {
    if (this.muted) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== "running") return;
    const r = RECIPES[voice];
    const t = ctx.currentTime;
    const note = (freq: number, gainScale: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = r.type;
      osc.frequency.setValueAtTime(freq * (1 + detune), t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(r.gain * gainScale, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + r.duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + r.duration + 0.02);
    };
    note(r.freq, 1);
    if (r.overtone) note(r.freq * r.overtone, 0.45);
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
  }
}
