import type { CameraId, MoodId, StoryLine, World } from "./types";

/**
 * ============================================================================
 *  AI Auto-Director
 * ============================================================================
 *  Turns a single generated World into a timed CINEMATIC SEQUENCE — a list of
 *  shots, each with a mood (how the world looks), a camera (how it's framed),
 *  dialogue, and a duration. `Play Scene` runs through these on a timer so one
 *  prompt becomes a watchable short film.
 *
 *  The narration is prompt-aware: it draws on the world's parsed spec and,
 *  when available, the Marble AI caption — so a "mystical forest" and a
 *  "neon megacity" get different arcs, not the same canned space-colony lines.
 * ============================================================================
 */

export interface Shot {
  id: string;
  time: string; // timeline label, e.g. "00:12"
  beatTitle: string;
  mood: MoodId;
  camera: CameraId;
  durationMs: number;
  lines: StoryLine[];
}

/** Pull a short, human place-name from the world for use inside narration. */
function place(world: World): string {
  const loc = world.location.trim().replace(/\.$/, "");
  return loc.length > 0 ? loc : world.title;
}

/** A one-word "inhabitant" noun keyed to the settlement archetype. */
function dwellers(world: World): string {
  switch (world.spec.archetype) {
    case "megacity":
      return "millions";
    case "outpost":
      return "the skeleton crew";
    case "monastery":
      return "the keepers";
    case "reef":
      return "the divers";
    default:
      return "the colonists";
  }
}

function mmss(totalMs: number): string {
  const s = Math.round(totalMs / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * Choose the "crisis" beat for the middle of the arc based on the prompt, so
 * the drama fits the world instead of always being an alien attack.
 */
function crisisFor(world: World): { mood: MoodId; camera: CameraId; title: string; lines: StoryLine[] } {
  const p = `${world.prompt} ${world.marble?.caption ?? ""}`.toLowerCase();
  const here = place(world);

  if (/forest|jungle|swamp|garden|reef|ocean|coral|underwater/.test(p)) {
    return {
      mood: "rain",
      camera: "drone",
      title: "The storm breaks over the canopy",
      lines: [
        { speaker: "NARRATION", text: `Clouds close over ${here}. The first heavy rain drums the leaves.`, tone: "warning" },
        { speaker: "GUIDE", text: "Stay close. The old paths flood fast when it comes down like this.", tone: "warning" },
      ],
    };
  }
  if (/temple|monaster|shrine|sanctuary|cathedral|holy/.test(p)) {
    return {
      mood: "alien",
      camera: "closeup",
      title: "Something answers from the dark",
      lines: [
        { speaker: "SYSTEM", text: "A resonance in the stone. Older than the order that built this place.", tone: "warning" },
        { speaker: "KEEPER", text: "We are not the first to kneel here. Nor, I think, the last.", tone: "warning" },
      ],
    };
  }
  if (/city|metropolis|neon|cyber|street|urban/.test(p)) {
    return {
      mood: "emergency",
      camera: "closeup",
      title: "The grid fails — sirens sweep the towers",
      lines: [
        { speaker: "SYSTEM", text: `WARNING: cascade failure across ${here}. Backup power at nineteen percent.`, tone: "danger" },
        { speaker: "DISPATCH", text: "Get them off the upper decks. We are losing the whole spine.", tone: "danger" },
      ],
    };
  }
  // Default: contact / anomaly — works for space, outpost, generic worlds.
  return {
    mood: "alien",
    camera: "closeup",
    title: "An unknown signature descends",
    lines: [
      { speaker: "SYSTEM", text: "Unidentified craft. Non-standard geometry. It is aware of us.", tone: "warning" },
      { speaker: "REN", text: "That's nothing we built. Nothing that moves like that is ours.", tone: "warning" },
    ],
  };
}

/**
 * Build the full cinematic arc for a world:
 *   Establish → Golden hour → Crisis → Aftermath → Resolution.
 * Prompt-aware throughout.
 */
export function buildSceneScript(world: World): Shot[] {
  const here = place(world);
  const who = dwellers(world);
  const crisis = crisisFor(world);

  const raw: Omit<Shot, "id" | "time">[] = [
    {
      beatTitle: `Establishing — ${world.title} wakes`,
      mood: "default",
      camera: "wide",
      durationMs: 7000,
      lines: [
        { speaker: "NARRATION", text: `${here}. Dawn, of a kind. The world turns slowly against the dark.`, tone: "neutral" },
        { speaker: "MARA", text: "Set is live. Director — the shot is yours.", tone: "calm" },
      ],
    },
    {
      beatTitle: "Golden hour settles",
      mood: "sunset",
      camera: "orbit",
      durationMs: 7000,
      lines: [
        { speaker: "NARRATION", text: `The light goes long and gold. For a moment, ${who} forget the cold outside.`, tone: "calm" },
        { speaker: "MARA", text: "Days like this are why we came all the way out here.", tone: "calm" },
      ],
    },
    {
      beatTitle: crisis.title,
      mood: crisis.mood,
      camera: crisis.camera,
      durationMs: 8000,
      lines: crisis.lines,
    },
    {
      beatTitle: "Aftermath — the world stands empty",
      mood: "abandoned",
      camera: "drone",
      durationMs: 7000,
      lines: [
        { speaker: "NARRATION", text: `Later — much later. Silence moves through ${here} where ${who} used to.`, tone: "neutral" },
        { speaker: "REN", text: "...anyone still receiving this? Anyone at all?", tone: "neutral" },
      ],
    },
    {
      beatTitle: "Resolution — first light returns",
      mood: "default",
      camera: "pov",
      durationMs: 7000,
      lines: [
        { speaker: "NARRATION", text: `And then, against the odds, a light. ${here} is not finished yet.`, tone: "calm" },
        { speaker: "MARA", text: "Roll credits. That's a wrap on the first act.", tone: "calm" },
      ],
    },
  ];

  let t = 0;
  return raw.map((s, i) => {
    const shot: Shot = { ...s, id: `shot-${i}`, time: mmss(t) };
    t += s.durationMs;
    return shot;
  });
}

/** Total runtime of a script, for progress bars / labels. */
export function scriptDuration(shots: Shot[]): number {
  return shots.reduce((sum, s) => sum + s.durationMs, 0);
}
