"use client";

import { useState } from "react";
import { EXAMPLE_PROMPTS } from "@/lib/worldGen";

interface Props {
  onGenerate: (prompt: string) => void;
  generating: boolean;
  hasWorld: boolean;
}

export default function PromptBar({ onGenerate, generating, hasWorld }: Props) {
  const [value, setValue] = useState("Human colony orbiting Saturn");

  function submit() {
    const p = value.trim();
    if (!p || generating) return;
    onGenerate(p);
  }

  return (
    <div className="panel">
      <div className="panel-body">
        <div className="brand">
          <div className="brand-mark">◐</div>
          <div>
            <div className="brand-name">Director&apos;s Sandbox</div>
            <div className="brand-sub">Realtime Scene Console</div>
          </div>
        </div>

        <div className="section-label">World Prompt</div>
        <textarea
          className="prompt-input"
          rows={2}
          value={value}
          placeholder="Describe a world to generate…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={generating}
        />

        <div className="chip-row">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              className="chip"
              disabled={generating}
              onClick={() => setValue(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={submit} disabled={generating}>
            {generating ? "Generating…" : hasWorld ? "◐  Regenerate World" : "◐  Generate World"}
          </button>
        </div>

        <p className="hint-text">
          An instant local scene is directable immediately; a real{" "}
          <code style={{ color: "var(--muted)" }}>World Labs Marble</code> world
          renders in ~5 min and drops in as the live backdrop.
        </p>
      </div>
    </div>
  );
}
