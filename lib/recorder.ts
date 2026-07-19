/**
 * ============================================================================
 *  In-app clip recorder — MediaRecorder over the live WebGL canvas.
 * ============================================================================
 *  Captures the viewport to a WebM you can download and drop straight into a
 *  hackathon demo submission (the "45-second demo video"). No screen-capture
 *  permission dialog — it records the canvas pixels directly.
 * ============================================================================
 */

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** Pick the best-supported WebM codec for this browser. */
function bestMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "video/webm";
}

export class ClipRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  get active() {
    return this.rec?.state === "recording";
  }

  start(canvas: HTMLCanvasElement, fps = 30, audioTrack?: MediaStreamTrack | null) {
    if (!recordingSupported() || this.active) return false;
    const stream = canvas.captureStream(fps);
    // Mux the procedural soundscape into the clip when available.
    if (audioTrack) stream.addTrack(audioTrack);
    this.chunks = [];
    const rec = new MediaRecorder(stream, {
      mimeType: bestMimeType(),
      videoBitsPerSecond: 8_000_000,
    });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    rec.start(100); // gather data in 100ms slices
    this.rec = rec;
    return true;
  }

  /** Stop and hand back the finished clip as a Blob. */
  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = this.rec;
      if (!rec || rec.state === "inactive") {
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: bestMimeType() });
        this.chunks = [];
        this.rec = null;
        resolve(blob);
      };
      rec.stop();
    });
  }
}

/** Trigger a browser download for a recorded clip. */
export function downloadClip(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".webm") ? name : `${name}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
