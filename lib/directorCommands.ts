import type { Beat, Mood, MoodId, StoryLine } from "./types";

/**
 * Every director command maps to a Mood (how the world looks) plus a set of
 * story lines (what the timeline / story panel says). The 3D viewer animates
 * toward the mood; the UI plays the story.
 */

export const MOODS: Record<MoodId, Mood> = {
  default: {
    id: "default",
    label: "Establishing",
    skyTop: 0x0a1230,
    skyBottom: 0x1b2b57,
    fogColor: 0x0a1024,
    fogDensity: 0.012,
    ambientColor: 0x4a6cff,
    ambientIntensity: 0.55,
    keyColor: 0xbfd4ff,
    keyIntensity: 1.15,
    keyPosition: [18, 26, 14],
    emissiveBoost: 0.55,
    starIntensity: 1,
    effects: [],
    grade: { tint: 0x0a1024, exposure: 1.05 },
  },
  sunset: {
    id: "sunset",
    label: "Golden Hour",
    skyTop: 0x2a1a4a,
    skyBottom: 0xff7a3d,
    fogColor: 0xff8a4c,
    fogDensity: 0.02,
    ambientColor: 0xffb27a,
    ambientIntensity: 0.7,
    keyColor: 0xff8a3c,
    keyIntensity: 1.6,
    keyPosition: [-30, 6, -8],
    emissiveBoost: 0.4,
    starIntensity: 0.25,
    effects: [],
    grade: { tint: 0x2a1224, exposure: 1.15 },
  },
  emergency: {
    id: "emergency",
    label: "Red Alert",
    skyTop: 0x1a0208,
    skyBottom: 0x3a0510,
    fogColor: 0x2a0308,
    fogDensity: 0.028,
    ambientColor: 0xff2a2a,
    ambientIntensity: 0.5,
    keyColor: 0xff3b3b,
    keyIntensity: 1.3,
    keyPosition: [0, 20, 10],
    emissiveBoost: 0.9,
    starIntensity: 0.3,
    effects: ["alarm"],
    grade: { tint: 0x1a0206, exposure: 1.0 },
  },
  alien: {
    id: "alien",
    label: "Contact",
    skyTop: 0x02110c,
    skyBottom: 0x06231a,
    fogColor: 0x032015,
    fogDensity: 0.03,
    ambientColor: 0x22ff9d,
    ambientIntensity: 0.55,
    keyColor: 0x35ffb0,
    keyIntensity: 1.2,
    keyPosition: [0, 30, -4],
    emissiveBoost: 0.7,
    starIntensity: 0.5,
    effects: ["beams"],
    grade: { tint: 0x02160f, exposure: 1.05 },
  },
  abandoned: {
    id: "abandoned",
    label: "Ruins",
    skyTop: 0x141414,
    skyBottom: 0x30302c,
    fogColor: 0x2a2a26,
    fogDensity: 0.045,
    ambientColor: 0x9a9a90,
    ambientIntensity: 0.42,
    keyColor: 0xb9b6a6,
    keyIntensity: 0.7,
    keyPosition: [10, 18, 6],
    emissiveBoost: 0.05,
    starIntensity: 0.15,
    effects: ["fog"],
    grade: { tint: 0x1a1a18, exposure: 0.92 },
  },
  rain: {
    id: "rain",
    label: "Downpour",
    skyTop: 0x0a121c,
    skyBottom: 0x1c2a38,
    fogColor: 0x121c26,
    fogDensity: 0.05,
    ambientColor: 0x5f86b0,
    ambientIntensity: 0.5,
    keyColor: 0x9fc0e8,
    keyIntensity: 0.85,
    keyPosition: [-12, 24, 8],
    emissiveBoost: 0.6,
    starIntensity: 0.1,
    effects: ["rain"],
    grade: { tint: 0x0c141c, exposure: 0.98 },
  },
};

export interface DirectorCommand {
  id: MoodId;
  label: string;
  icon: string;
  hint: string;
  beat: Omit<Beat, "active">;
  story: StoryLine[];
}

export const DIRECTOR_COMMANDS: DirectorCommand[] = [
  {
    id: "sunset",
    label: "Sunset",
    icon: "◑",
    hint: "Golden hour wash",
    beat: { id: "b-sunset", time: "00:42", title: "Golden hour settles over the colony", mood: "sunset" },
    story: [
      { speaker: "NARRATION", text: "The rings catch fire as the local star dips below the hull line.", tone: "calm" },
      { speaker: "MARA", text: "Log it. Days like this are why we came out here.", tone: "calm" },
    ],
  },
  {
    id: "emergency",
    label: "Emergency",
    icon: "▲",
    hint: "Klaxons + red alert",
    beat: { id: "b-emergency", time: "01:15", title: "Hull breach — station goes to red alert", mood: "emergency" },
    story: [
      { speaker: "SYSTEM", text: "WARNING: pressure loss in ring sector 4. Seal all bulkheads.", tone: "danger" },
      { speaker: "MARA", text: "Get everyone to the core. Move, move!", tone: "danger" },
    ],
  },
  {
    id: "alien",
    label: "Alien Attack",
    icon: "◉",
    hint: "Contact from the dark",
    beat: { id: "b-alien", time: "02:03", title: "Unidentified craft descends over the domes", mood: "alien" },
    story: [
      { speaker: "SYSTEM", text: "Unknown signature. Non-human geometry. It's aware of us.", tone: "warning" },
      { speaker: "REN", text: "Those aren't ours. Nothing we built moves like that.", tone: "warning" },
    ],
  },
  {
    id: "abandoned",
    label: "Abandoned",
    icon: "◍",
    hint: "Years later, silence",
    beat: { id: "b-abandoned", time: "12:00", title: "Years later — the colony stands empty", mood: "abandoned" },
    story: [
      { speaker: "NARRATION", text: "Dust drifts through corridors that once hummed with two thousand lives.", tone: "neutral" },
      { speaker: "REN", text: "...anyone still receiving this? Anyone at all?", tone: "neutral" },
    ],
  },
  {
    id: "rain",
    label: "Rain",
    icon: "☂",
    hint: "Terraformed storm",
    beat: { id: "b-rain", time: "03:30", title: "Terraformed skies open — first rain on Saturn", mood: "rain" },
    story: [
      { speaker: "NARRATION", text: "The weather deck holds. Real rain falls on a moon that never knew it.", tone: "calm" },
      { speaker: "MARA", text: "First storm in a hundred years. Let it fall.", tone: "calm" },
    ],
  },
];

export function commandById(id: MoodId): DirectorCommand | undefined {
  return DIRECTOR_COMMANDS.find((c) => c.id === id);
}
