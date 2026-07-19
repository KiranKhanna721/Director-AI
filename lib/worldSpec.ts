import type { Archetype, PlanetKind, WorldSpec } from "./types";

/**
 * Turn a free-text prompt into a structured WorldSpec. This is the "generation
 * brain" for the local (no-API) path: keyword rules decide the settlement
 * archetype, the planetary backdrop, and the palette. Different prompts →
 * visibly different 3D scenes.
 *
 * (When the World Labs key is configured, real Marble geometry is layered in on
 * top; this remains the always-available fallback.)
 */

interface PlanetProfile {
  planet: PlanetKind;
  label: string;
  planetColor: number;
  groundColor: number;
  windowColor: number;
  accentColor: number;
  hasRings: boolean;
}

const PLANETS: Record<PlanetKind, PlanetProfile> = {
  saturn: { planet: "saturn", label: "Saturn", planetColor: 0xc9a878, groundColor: 0x14203a, windowColor: 0x8ad0ff, accentColor: 0xffb27a, hasRings: true },
  venus: { planet: "venus", label: "Venus", planetColor: 0xe0913f, groundColor: 0x3a2418, windowColor: 0xff6cf0, accentColor: 0xff5ec4, hasRings: false },
  europa: { planet: "europa", label: "Europa", planetColor: 0xcfe6f2, groundColor: 0x1b2e3c, windowColor: 0x9ff0ff, accentColor: 0x7fd8ff, hasRings: false },
  neptune: { planet: "neptune", label: "Neptune", planetColor: 0x2f6bd6, groundColor: 0x0a2236, windowColor: 0x6ff0d8, accentColor: 0x35e6c0, hasRings: false },
  mars: { planet: "mars", label: "Mars", planetColor: 0xb5502f, groundColor: 0x3a2016, windowColor: 0xffc07a, accentColor: 0xff8a3c, hasRings: false },
  gasGiant: { planet: "gasGiant", label: "the gas giant", planetColor: 0xd0a56a, groundColor: 0x22283a, windowColor: 0xbfd4ff, accentColor: 0xffd27a, hasRings: true },
  moon: { planet: "moon", label: "the moon", planetColor: 0x9a9aa2, groundColor: 0x2a2a30, windowColor: 0xbfd4ff, accentColor: 0xcdd8ff, hasRings: false },
  deepSpace: { planet: "deepSpace", label: "deep space", planetColor: 0x6a4a8a, groundColor: 0x141a30, windowColor: 0x8ad0ff, accentColor: 0x9a76ff, hasRings: false },
};

interface ArchetypeProfile {
  archetype: Archetype;
  label: string;
  hasDome: boolean;
  spires: boolean;
  buildingCount: number;
  maxHeight: number;
  spread: number;
  structureColor: number;
}

const ARCHETYPES: Record<Archetype, ArchetypeProfile> = {
  domeColony: { archetype: "domeColony", label: "Dome Colony", hasDome: true, spires: false, buildingCount: 12, maxHeight: 16, spread: 22, structureColor: 0x223a63 },
  megacity: { archetype: "megacity", label: "Megacity", hasDome: false, spires: false, buildingCount: 46, maxHeight: 34, spread: 30, structureColor: 0x1a2340 },
  outpost: { archetype: "outpost", label: "Research Outpost", hasDome: false, spires: false, buildingCount: 7, maxHeight: 6, spread: 26, structureColor: 0x2c3240 },
  monastery: { archetype: "monastery", label: "Floating Monastery", hasDome: false, spires: true, buildingCount: 9, maxHeight: 30, spread: 16, structureColor: 0x3a3350 },
  reef: { archetype: "reef", label: "Reef City", hasDome: true, spires: false, buildingCount: 28, maxHeight: 18, spread: 26, structureColor: 0x1f4a54 },
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function detectArchetype(p: string): Archetype {
  // Order matters — more specific first.
  if (/\b(reef|coral|underwater|abyss|ocean|sea|aquatic)\b/.test(p)) return "reef";
  if (/\b(monaster|temple|cathedral|shrine|spire|sanctuar)\w*/.test(p)) return "monastery";
  if (/\b(megacity|metropolis|city|neon|downtown|skyline|urban)\b/.test(p)) return "megacity";
  if (/\b(outpost|research|lab|base|mining|camp|listening|observatory)\b/.test(p)) return "outpost";
  if (/\b(colony|habitat|settlement|dome|biodome|ark)\b/.test(p)) return "domeColony";
  return "domeColony";
}

function detectPlanet(p: string): PlanetKind {
  if (/\bsaturn\b/.test(p)) return "saturn";
  if (/\bvenus\b/.test(p)) return "venus";
  if (/\b(europa|frozen|ice|icy|glaci|snow)\w*/.test(p)) return "europa";
  if (/\bneptune\b/.test(p)) return "neptune";
  if (/\bmars\b|\bmartian\b/.test(p)) return "mars";
  if (/\b(gas giant|jupiter|jovian)\b/.test(p)) return "gasGiant";
  if (/\b(moon|lunar|luna)\b/.test(p)) return "moon";
  return "deepSpace";
}

export function deriveWorldSpec(prompt: string): WorldSpec {
  const p = prompt.toLowerCase();
  const seed = hashString(p.trim());
  const jitter = (seed % 1000) / 1000; // 0..1 stable per prompt

  const arche = ARCHETYPES[detectArchetype(p)];
  const planet = PLANETS[detectPlanet(p)];

  // Scale hints from adjectives / numbers in the prompt.
  const mega = /\b(mega|huge|vast|sprawling|massive|giant)\b/.test(p);
  const tiny = /\b(small|tiny|remote|lonely|solitary|abandoned)\b/.test(p);
  const underwater = /\b(beneath|under|underwater|submerged|deep|abyss|ocean|sea)\b/.test(p);

  let buildingCount = arche.buildingCount;
  let maxHeight = arche.maxHeight;
  if (mega) {
    buildingCount = Math.round(buildingCount * 1.5);
    maxHeight = Math.round(maxHeight * 1.3);
  }
  if (tiny) {
    buildingCount = Math.max(4, Math.round(buildingCount * 0.5));
    maxHeight = Math.round(maxHeight * 0.7);
  }
  // small stable variation so two similar prompts still differ a little
  buildingCount += Math.round(jitter * 6);

  return {
    archetype: arche.archetype,
    planet: planet.planet,
    planetLabel: planet.label,
    hasDome: arche.hasDome,
    hasRings: planet.hasRings,
    spires: arche.spires,
    underwater,
    buildingCount,
    maxHeight,
    spread: arche.spread,
    groundColor: planet.groundColor,
    structureColor: arche.structureColor,
    windowColor: planet.windowColor,
    planetColor: planet.planetColor,
    accentColor: planet.accentColor,
  };
}
