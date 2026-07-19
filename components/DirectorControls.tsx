"use client";

import { DIRECTOR_COMMANDS } from "@/lib/directorCommands";
import type { MoodId } from "@/lib/types";

interface Props {
  activeMood: MoodId;
  onCommand: (id: MoodId) => void;
  disabled: boolean;
}

export default function DirectorControls({ activeMood, onCommand, disabled }: Props) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Director Commands</span>
      </div>
      <div className="panel-body">
        <div className="cmd-grid">
          {DIRECTOR_COMMANDS.map((c) => (
            <button
              key={c.id}
              className={`cmd-btn ${activeMood === c.id ? "active" : ""}`}
              onClick={() => onCommand(c.id)}
              disabled={disabled}
            >
              <span className="cmd-icon">{c.icon}</span>
              <span className="cmd-label">{c.label}</span>
              <span className="cmd-hint">{c.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
