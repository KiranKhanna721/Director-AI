"use client";

import { GENERATION_STAGES } from "@/lib/worldGen";

interface Props {
  prompt: string;
  stageIndex: number; // -1 = not started, else current stage
}

export default function LoadingOverlay({ prompt, stageIndex }: Props) {
  const total = GENERATION_STAGES.length;
  const progress = Math.min(100, Math.round(((stageIndex + 1) / total) * 100));

  return (
    <div className="load-overlay">
      <div className="load-card">
        <div className="load-title">Generating World</div>
        <div className="load-prompt">“{prompt}”</div>

        {GENERATION_STAGES.map((stage, i) => {
          const cls = i < stageIndex ? "done" : i === stageIndex ? "active" : "";
          return (
            <div key={stage.label} className={`load-stage ${cls}`}>
              <div className="load-tick">{i < stageIndex ? "✓" : ""}</div>
              <div>
                <div className="load-stage-label">{stage.label}</div>
                <div className="load-stage-detail">{stage.detail}</div>
              </div>
            </div>
          );
        })}

        <div className="load-bar">
          <div className="load-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
