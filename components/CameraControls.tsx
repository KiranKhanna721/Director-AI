"use client";

import { CAMERA_ORDER, CAMERA_PRESETS } from "@/lib/cameraPresets";
import type { CameraId } from "@/lib/types";

interface Props {
  active: CameraId;
  onSelect: (id: CameraId) => void;
  disabled: boolean;
}

export default function CameraControls({ active, onSelect, disabled }: Props) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Cameras</span>
      </div>
      <div className="panel-body">
        <div className="cam-col">
          {CAMERA_ORDER.map((id, i) => {
            const preset = CAMERA_PRESETS[id];
            return (
              <button
                key={id}
                className={`cam-btn ${active === id ? "active" : ""}`}
                onClick={() => onSelect(id)}
                disabled={disabled}
              >
                <span className="cam-name">{preset.label}</span>
                <span className="cam-key">{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
