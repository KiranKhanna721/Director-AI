import type { MoodId } from "./types";

/**
 * ============================================================================
 *  Procedural soundscape — Web Audio, zero asset files.
 * ============================================================================
 *  A small synthesizer that reacts to the active mood. Everything is generated
 *  live (oscillators + filtered noise), so there are no audio downloads and the
 *  bed cross-fades smoothly as the director changes the scene:
 *
 *    default    → deep space drone
 *    sunset     → warm, mellow pad
 *    emergency  → pulsing red-alert klaxon
 *    alien      → shimmering, detuned contact tone
 *    abandoned  → hollow low wind
 *    rain       → filtered white-noise downpour
 *
 *  Browser autoplay policy requires a user gesture, so call `start()` from a
 *  click (the Sound toggle) before the context will produce audio.
 * ============================================================================
 */

type MoodAudio = {
  droneHz: number; // base pad frequency
  droneType: OscillatorType;
  detuneHz: number; // second osc offset for movement
  rain: number; // 0..1 rain noise level
  wind: number; // 0..1 low wind level
  pulse: number; // >0 = klaxon pulse rate (Hz)
  gain: number; // overall bed level
};

const PROFILES: Record<MoodId, MoodAudio> = {
  default: { droneHz: 55, droneType: "sine", detuneHz: 55.4, rain: 0, wind: 0.08, pulse: 0, gain: 0.5 },
  sunset: { droneHz: 82, droneType: "triangle", detuneHz: 123, rain: 0, wind: 0.04, pulse: 0, gain: 0.45 },
  emergency: { droneHz: 70, droneType: "sawtooth", detuneHz: 70, rain: 0, wind: 0, pulse: 1.6, gain: 0.5 },
  alien: { droneHz: 98, droneType: "sine", detuneHz: 104.5, rain: 0, wind: 0.05, pulse: 0, gain: 0.5 },
  abandoned: { droneHz: 44, droneType: "sine", detuneHz: 44.3, rain: 0, wind: 0.28, pulse: 0, gain: 0.42 },
  rain: { droneHz: 60, droneType: "sine", detuneHz: 60.2, rain: 0.5, wind: 0.1, pulse: 0, gain: 0.5 },
};

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private oscA: OscillatorNode | null = null;
  private oscB: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private muted = true;
  private current: MoodId = "default";

  /** Lazily build the graph. Must be called from a user gesture. */
  start(mood: MoodId) {
    if (this.started) {
      this.setMuted(false);
      this.apply(mood);
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0; // fade in via apply()
    this.master.connect(ctx.destination);

    // --- Drone: two slightly detuned oscillators through a lowpass ---
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.5;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = "lowpass";
    droneLp.frequency.value = 900;
    this.droneGain.connect(droneLp).connect(this.master);

    this.oscA = ctx.createOscillator();
    this.oscB = ctx.createOscillator();
    this.oscA.connect(this.droneGain);
    this.oscB.connect(this.droneGain);

    // --- Noise: looping buffer for rain / wind through a bandpass ---
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = buffer;
    this.noiseSrc.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = "bandpass";
    this.noiseFilter.frequency.value = 1400;
    this.noiseFilter.Q.value = 0.6;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseSrc.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);

    this.oscA.start();
    this.oscB.start();
    this.noiseSrc.start();
    this.started = true;
    this.muted = false;
    this.apply(mood);
  }

  /** Cross-fade the whole bed to a new mood. Safe to call anytime. */
  apply(mood: MoodId) {
    this.current = mood;
    if (!this.ctx || !this.started) return;
    const p = PROFILES[mood];
    const now = this.ctx.currentTime;
    const t = now + 0.9; // ~1s cross-fade

    this.oscA!.type = p.droneType;
    this.oscB!.type = p.droneType;
    this.oscA!.frequency.setTargetAtTime(p.droneHz, now, 0.3);
    this.oscB!.frequency.setTargetAtTime(p.detuneHz, now, 0.3);

    const noiseLevel = Math.max(p.rain, p.wind * 0.7);
    this.noiseFilter!.frequency.setTargetAtTime(p.rain > 0 ? 3500 : 500, now, 0.3);
    this.noiseFilter!.Q.value = p.rain > 0 ? 0.4 : 1.2;
    this.noiseGain!.gain.linearRampToValueAtTime(noiseLevel, t);

    this.master!.gain.linearRampToValueAtTime(this.muted ? 0 : p.gain, t);

    // Klaxon pulse for emergencies.
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    if (p.pulse > 0 && !this.muted) {
      const intervalMs = 1000 / p.pulse;
      this.pulseTimer = setInterval(() => this.blip(), intervalMs);
    }
  }

  /** A short rising klaxon blip used by the emergency mood. */
  private blip() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(440, now);
    o.frequency.exponentialRampToValueAtTime(880, now + 0.18);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    o.connect(g).connect(this.master!);
    o.start(now);
    o.stop(now + 0.34);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    const p = PROFILES[this.current];
    this.master.gain.linearRampToValueAtTime(muted ? 0 : p.gain, this.ctx.currentTime + 0.4);
    if (muted && this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    } else if (!muted) {
      this.apply(this.current); // restore pulse if needed
    }
  }

  isStarted() {
    return this.started;
  }

  /**
   * Tap the live audio bed as a MediaStreamTrack so the clip recorder can mux
   * the procedural score into the captured video. Returns null if audio hasn't
   * started yet (needs a user gesture first).
   */
  captureAudioTrack(): MediaStreamTrack | null {
    if (!this.ctx || !this.master || !this.started) return null;
    const dest = this.ctx.createMediaStreamDestination();
    this.master.connect(dest); // fan-out; speakers keep playing too
    return dest.stream.getAudioTracks()[0] ?? null;
  }

  dispose() {
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    try {
      this.oscA?.stop();
      this.oscB?.stop();
      this.noiseSrc?.stop();
      this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.started = false;
  }
}
