import type { CameraId, CameraPreset } from "./types";

export const CAMERA_PRESETS: Record<CameraId, CameraPreset> = {
  wide: {
    id: "wide",
    label: "Wide Shot",
    position: [0, 14, 46],
    target: [0, 4, 0],
    fov: 42,
    orbit: false,
    orbitSpeed: 0,
  },
  closeup: {
    id: "closeup",
    label: "Close Up",
    position: [9, 4.5, 12],
    target: [2, 3.2, 0],
    fov: 34,
    orbit: false,
    orbitSpeed: 0,
  },
  orbit: {
    id: "orbit",
    label: "Orbit",
    position: [0, 9, 34],
    target: [0, 4, 0],
    fov: 46,
    orbit: true,
    orbitSpeed: 0.12,
  },
  drone: {
    id: "drone",
    label: "Drone",
    position: [-18, 26, 20],
    target: [0, 2, 0],
    fov: 55,
    orbit: true,
    orbitSpeed: 0.05,
  },
  pov: {
    id: "pov",
    label: "POV",
    position: [3, 2.2, 16],
    target: [0, 3, -6],
    fov: 68,
    orbit: false,
    orbitSpeed: 0,
  },
};

export const CAMERA_ORDER: CameraId[] = [
  "wide",
  "closeup",
  "orbit",
  "drone",
  "pov",
];
