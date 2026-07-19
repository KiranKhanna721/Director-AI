"use client";

import type { Beat } from "@/lib/types";

interface Props {
  beats: Beat[];
  activeBeatId: string | null;
  onSelect: (beat: Beat) => void;
}

export default function Timeline({ beats, activeBeatId, onSelect }: Props) {
  const activeIndex = beats.findIndex((b) => b.id === activeBeatId);

  return (
    <div className="panel col-bottom">
      <div className="panel-head">
        <span className="panel-title">Timeline &amp; Scene Beats</span>
        <span className="cam-key">{beats.length} beats</span>
      </div>
      <div className="panel-body" style={{ padding: "10px 12px" }}>
        {beats.length === 0 ? (
          <p className="hint-text" style={{ margin: 0 }}>
            Generate a world and call director commands to build the timeline.
          </p>
        ) : (
          <div className="timeline">
            {beats.map((b, i) => {
              const state =
                b.id === activeBeatId ? "active" : i < activeIndex ? "past" : "";
              return (
                <div
                  key={b.id}
                  className={`tl-beat ${state}`}
                  onClick={() => onSelect(b)}
                >
                  <div className="tl-time">{b.time}</div>
                  <div className="tl-title">{b.title}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
