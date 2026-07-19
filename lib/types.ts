// Shared types for Director's Sandbox

export type MoodId =
  | "default"
  | "sunset"
  | "emergency"
  | "alien"
  | "abandoned"
  | "rain";

export type CameraId = "wide" | "closeup" | "orbit" | "drone" | "pov";

export type EffectId = "rain" | "alarm" | "beams" | "fog";

/**
 * A Mood is a declarative description of the scene atmosphere. The 3D viewer
 * lerps toward whatever mood is active, so every director command produces a
 * smooth, visible change.
 */
export interface Mood {
  id: MoodId;
  label: string;
  // Colors are hex ints for direct use with THREE.Color
  skyTop: number;
  skyBottom: number;
  fogColor: number;
  fogDensity: number;
  ambientColor: number;
  ambientIntensity: number;
  keyColor: number;
  keyIntensity: number;
  keyPosition: [number, number, number];
  emissiveBoost: number; // adds window/structure glow (0..1)
  starIntensity: number; // 0..1 visibility of starfield
  effects: EffectId[];
  grade: {
    // simple post-ish tint applied to the renderer clear + accent
    tint: number;
    exposure: number;
  };
}

export interface CameraPreset {
  id: CameraId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  orbit: boolean;
  orbitSpeed: number;
}

export interface Beat {
  id: string;
  time: string; // e.g. "00:00"
  title: string;
  mood?: MoodId;
  active?: boolean;
}

export interface StoryLine {
  speaker: string;
  text: string;
  tone?: "neutral" | "warning" | "danger" | "calm";
}

/** Result of a real World Labs (Marble) generation, when configured. */
export interface MarbleWorld {
  status: "completed" | "processing" | "failed";
  operationId?: string; // async job id, used by the client to poll for the result
  viewerUrl?: string; // world_marble_url — the interactive Marble viewer
  previewImageUrl?: string; // assets.thumbnail_url — establishing plate
  meshUrl?: string; // assets.mesh.collider_mesh_url — GLB, can be loaded in-viewer
  panoUrl?: string; // assets.imagery.pano_url — 360° panorama
  caption?: string; // assets.caption
  message?: string;
}

/** Distinct settlement layouts the local generator can build. */
export type Archetype =
  | "domeColony" // orbital/surface colony under a dome
  | "megacity" // dense field of tall towers
  | "outpost" // sparse low research modules
  | "monastery" // tall thin spires around a central tower
  | "reef"; // organic clustered rounded forms (underwater)

/** Named planetary/environment backdrops. */
export type PlanetKind =
  | "saturn"
  | "venus"
  | "europa"
  | "neptune"
  | "mars"
  | "gasGiant"
  | "moon"
  | "deepSpace";

/**
 * A WorldSpec is the parsed, structured meaning of the prompt. The 3D viewer
 * builds geometry, palette and backdrop directly from it, so different prompts
 * produce visibly different scenes.
 */
export interface WorldSpec {
  archetype: Archetype;
  planet: PlanetKind;
  planetLabel: string;
  hasDome: boolean;
  hasRings: boolean;
  spires: boolean;
  underwater: boolean;
  buildingCount: number;
  maxHeight: number;
  spread: number; // how far structures spread from center
  groundColor: number;
  structureColor: number;
  windowColor: number;
  planetColor: number;
  accentColor: number;
}

export interface World {
  id: string;
  prompt: string;
  title: string;
  logline: string;
  location: string;
  population: string;
  archetypeLabel: string;
  palette: {
    primary: number;
    secondary: number;
    accent: number;
  };
  seed: number;
  /** Parsed prompt → drives the generated 3D geometry & palette. */
  spec: WorldSpec;
  /** Present only when the World Labs API was configured and returned data. */
  marble?: MarbleWorld;
  /** How this world's base was produced — drives the "MARBLE" vs "MOCK" badge. */
  source: "marble" | "mock";
}

export interface GenerationStage {
  label: string;
  detail: string;
}
