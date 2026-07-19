import type { StoryLine } from "./types";

/**
 * ============================================================================
 *  Voice narration — the browser SpeechSynthesis API, no external TTS.
 * ============================================================================
 *  Speaks story lines aloud as the scene plays. NARRATION gets a calm, slower
 *  voice; characters get a slightly higher, quicker delivery, so a played-back
 *  scene sounds like a table read rather than one flat voice.
 * ============================================================================
 */

export function narrationSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Prefer an English voice; fall back to whatever the platform offers. */
function pickVoice(narration: boolean): SpeechSynthesisVoice | null {
  if (!narrationSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => /en(-|_|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  // Try to give narration vs characters distinct voices when possible.
  if (narration) {
    return (
      pool.find((v) => /daniel|google uk english male|male/i.test(v.name)) ??
      pool[0]
    );
  }
  return (
    pool.find((v) => /samantha|google us english|female|zira/i.test(v.name)) ??
    pool[pool.length - 1]
  );
}

class Narrator {
  private enabled = false;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.cancel();
  }

  isEnabled() {
    return this.enabled;
  }

  cancel() {
    if (narrationSupported()) window.speechSynthesis.cancel();
  }

  /** Speak a single line. */
  speakLine(line: StoryLine) {
    if (!this.enabled || !narrationSupported()) return;
    const u = new SpeechSynthesisUtterance(line.text);
    const isNarration = /narration|system|dispatch/i.test(line.speaker);
    const v = pickVoice(isNarration);
    if (v) u.voice = v;
    u.rate = isNarration ? 0.92 : 1.02;
    u.pitch = isNarration ? 0.9 : 1.05;
    // Danger/warning lines get a touch more urgency.
    if (line.tone === "danger") {
      u.rate = 1.12;
      u.pitch = 1.1;
    }
    u.volume = 1;
    window.speechSynthesis.speak(u);
  }

  /** Speak a group of lines back to back. */
  speakLines(lines: StoryLine[]) {
    if (!this.enabled || !narrationSupported()) return;
    this.cancel();
    for (const l of lines) this.speakLine(l);
  }
}

// Some browsers populate voices asynchronously — nudge them to load early.
if (narrationSupported()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

export const narrator = new Narrator();
