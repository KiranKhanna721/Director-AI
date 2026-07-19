"use client";

interface Props {
  disabled: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  recording: boolean;
  onToggleRecord: () => void;
  canRecord: boolean;
  cinematic: boolean;
  onToggleCinematic: () => void;
}

/**
 * The cinematic transport bar: Play Scene (auto-director), soundscape, voice
 * narration, in-app recording, and a distraction-free cinematic mode.
 */
export default function CineControls({
  disabled,
  playing,
  onTogglePlay,
  soundOn,
  onToggleSound,
  voiceOn,
  onToggleVoice,
  recording,
  onToggleRecord,
  canRecord,
  cinematic,
  onToggleCinematic,
}: Props) {
  return (
    <div className="cine-bar">
      <button
        className={`cine-btn primary ${playing ? "on" : ""}`}
        onClick={onTogglePlay}
        disabled={disabled}
        title="Auto-direct a cinematic sequence from this world"
      >
        {playing ? "⏸ Pause Scene" : "▶ Play Scene"}
      </button>

      <span className="cine-sep" />

      <button
        className={`cine-btn ${soundOn ? "on" : ""}`}
        onClick={onToggleSound}
        disabled={disabled}
        title="Procedural soundscape (Web Audio)"
      >
        {soundOn ? "♪ Sound" : "♪̸ Sound"}
      </button>

      <button
        className={`cine-btn ${voiceOn ? "on" : ""}`}
        onClick={onToggleVoice}
        disabled={disabled}
        title="Voice narration of the story"
      >
        {voiceOn ? "🗣 Voice" : "🗣 Voice"}
      </button>

      <span className="cine-sep" />

      <button
        className={`cine-btn ${recording ? "rec" : ""}`}
        onClick={onToggleRecord}
        disabled={disabled || !canRecord}
        title={canRecord ? "Record the viewport to a downloadable clip" : "Recording unsupported in this browser"}
      >
        {recording ? "■ Stop & Save" : "● Record"}
      </button>

      <button
        className={`cine-btn ${cinematic ? "on" : ""}`}
        onClick={onToggleCinematic}
        disabled={disabled}
        title="Hide UI chrome for a clean shot"
      >
        {cinematic ? "⛶ Exit Cinema" : "⛶ Cinema"}
      </button>
    </div>
  );
}
