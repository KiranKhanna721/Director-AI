import type { Archetype, GenerationStage, MarbleWorld, StoryLine, World } from "./types";
import { deriveWorldSpec } from "./worldSpec";

/**
 * Mocked world-generation pipeline. Structured so a real API can be dropped in
 * later: swap `generateWorld` internals for a fetch() and keep the same shape.
 */

export const GENERATION_STAGES: GenerationStage[] = [
  { label: "Parsing prompt", detail: "Extracting setting, tone and scale" },
  { label: "Synthesizing geometry", detail: "Placing domes, spires and habitats" },
  { label: "Lighting the set", detail: "Calibrating star, fog and ambient" },
  { label: "Casting the scene", detail: "Assigning voices and opening beat" },
  { label: "Rendering first frame", detail: "Compositing the establishing shot" },
];

const TITLE_WORDS = ["Halo", "Aurora", "Meridian", "Vantage", "Cinder", "Halcyon", "Perihelion", "Cradle"];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Title suffix + population scale keyed to the settlement archetype, so a
// megacity reads as a "Metropolis" of millions and an outpost as a "Outpost"
// of dozens.
const ARCHETYPE_META: Record<Archetype, { suffix: string; label: string; basePop: number; popSpan: number }> = {
  domeColony: { suffix: "Colony", label: "Dome Colony", basePop: 900, popSpan: 4200 },
  megacity: { suffix: "Metropolis", label: "Megacity", basePop: 1_200_000, popSpan: 8_000_000 },
  outpost: { suffix: "Outpost", label: "Research Outpost", basePop: 12, popSpan: 240 },
  monastery: { suffix: "Sanctuary", label: "Floating Monastery", basePop: 40, popSpan: 600 },
  reef: { suffix: "Reef", label: "Reef City", basePop: 6_000, popSpan: 90_000 },
};

function buildWorld(prompt: string): World {
  const seed = hashString(prompt.trim().toLowerCase());
  const name = TITLE_WORDS[seed % TITLE_WORDS.length];
  const cleaned = prompt.trim().replace(/\.$/, "");
  const spec = deriveWorldSpec(prompt);
  const meta = ARCHETYPE_META[spec.archetype];
  const population = meta.basePop + (seed % meta.popSpan);

  return {
    id: `world-${seed}`,
    prompt,
    title: `${name} ${meta.suffix}`,
    logline: titleCase(cleaned),
    location: cleaned,
    population: `${population.toLocaleString()} residents`,
    archetypeLabel: `${meta.label} · ${spec.planetLabel}`,
    palette: {
      primary: 0x4a6cff,
      secondary: spec.windowColor,
      accent: spec.accentColor,
    },
    seed,
    spec,
    source: "mock",
  };
}

/**
 * Ask the server route (which holds the World Labs key) to START a Marble job.
 * Returns immediately with a "processing" result (Marble takes ~5 min); the
 * client then polls `pollMarbleWorld` in the background. Returns null when the
 * API isn't configured. Never throws.
 */
async function requestMarbleWorld(prompt: string): Promise<MarbleWorld | null> {
  try {
    const res = await fetch("/api/worldlab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      configured: boolean;
      marble: MarbleWorld | null;
    };
    if (!data.configured || !data.marble) return null;
    return data.marble;
  } catch {
    return null;
  }
}

/**
 * Poll a running Marble job once (via the GET route). Returns the latest
 * MarbleWorld, or null if unreachable/unconfigured. Never throws.
 */
export async function pollMarbleWorld(operationId: string): Promise<MarbleWorld | null> {
  try {
    const res = await fetch(`/api/worldlab?id=${encodeURIComponent(operationId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      configured: boolean;
      marble: MarbleWorld | null;
    };
    if (!data.configured || !data.marble) return null;
    return data.marble;
  } catch {
    return null;
  }
}

export const OPENING_STORY: StoryLine[] = [
  { speaker: "NARRATION", text: "Establishing shot. The colony turns slowly against the dark, alive with a thousand lit windows.", tone: "neutral" },
  { speaker: "MARA", text: "Sandbox online. Director, the set is yours — call the shot.", tone: "calm" },
];

export const EXAMPLE_PROMPTS: string[] = [
  "Human colony orbiting Saturn",
  "Neon megacity in the clouds of Venus",
  "Frozen research outpost on Europa",
  "Floating monastery above a gas giant",
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs the mocked async pipeline, reporting progress per stage.
 * onStage(index) fires as each stage begins.
 */
export async function generateWorld(
  prompt: string,
  onStage?: (index: number) => void
): Promise<World> {
  const world = buildWorld(prompt);

  // Fire the (optional) real Marble generation in parallel with the staged
  // progress animation, so a configured key adds an establishing world without
  // slowing the demo down. If unconfigured, this resolves to null instantly.
  const marblePromise = requestMarbleWorld(prompt);

  for (let i = 0; i < GENERATION_STAGES.length; i++) {
    onStage?.(i);
    // Slightly varied timing so the pipeline feels alive, not mechanical.
    await wait(420 + Math.round(Math.random() * 260));
  }

  const marble = await marblePromise;
  if (marble) {
    // Always attach the result — including failures — so the UI can show WHY it
    // fell back to the mock scene instead of failing silently.
    world.marble = marble;
    if (marble.status === "completed") world.source = "marble";
  }

  return world;
}
