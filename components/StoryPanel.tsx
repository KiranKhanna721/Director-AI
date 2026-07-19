"use client";

import type { StoryLine, World } from "@/lib/types";

interface Props {
  world: World | null;
  lines: StoryLine[];
}

export default function StoryPanel({ world, lines }: Props) {
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-head">
        <span className="panel-title">Story</span>
        {world && <span className="cam-key">{world.title}</span>}
      </div>
      <div className="panel-body">
        {world && (
          <div className="facts" style={{ marginBottom: 14 }}>
            <div className="fact-row">
              <span className="fact-key">Type</span>
              <span className="fact-val">{world.archetypeLabel}</span>
            </div>
            <div className="fact-row">
              <span className="fact-key">Location</span>
              <span className="fact-val">{world.location}</span>
            </div>
            <div className="fact-row">
              <span className="fact-key">Population</span>
              <span className="fact-val">{world.population}</span>
            </div>
          </div>
        )}

        {lines.length === 0 && (
          <p className="hint-text" style={{ marginTop: 0 }}>
            Scene dialogue appears here as you direct the world.
          </p>
        )}

        {lines.map((l, i) => (
          <div key={`${l.speaker}-${i}`} className={`story-line ${l.tone ?? ""}`}>
            <div className="story-speaker">{l.speaker}</div>
            <div className="story-text">{l.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
