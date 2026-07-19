# Director's Sandbox

Generate an AI world from a prompt, then **direct it in real time** — call
cinematic scene changes and switch cameras instantly. A hackathon MVP built
around one magical workflow.

![Director's Sandbox](https://img.shields.io/badge/stack-Next.js%2015%20%C2%B7%20React%2019%20%C2%B7%20Three.js-6c8bff)

## The workflow

1. **Prompt** a world — e.g. _"Human colony orbiting Saturn."_
2. Watch the **mocked generation pipeline** build and load it into a live 3D viewer.
3. Call **director commands** — Sunset · Emergency · Alien Attack · Abandoned · Rain — each triggers a smooth, visible scene change.
4. Switch **cameras** instantly — Wide · Close Up · Orbit · Drone · POV (or press `1`–`5`).
5. The **timeline** logs each scene beat; the **story panel** plays matching dialogue.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## How it works

- **`components/WorldViewer.tsx`** — a single Three.js scene. It never rebuilds on
  a command; instead it *lerps* toward whatever `mood` and `camera` props are
  active, so every change is animated (lighting, fog, sky, glow, rain, dust,
  alien craft, red-alert klaxon).
- **`lib/directorCommands.ts`** — each command = a declarative `Mood` (how it
  looks) + story beat + dialogue.
- **`lib/cameraPresets.ts`** — camera rigs (position / target / fov / orbit).
- **`lib/worldGen.ts`** — the mocked async pipeline. Swap its internals for a
  real API call and everything else keeps working.

## State

All app state lives in `app/page.tsx` (`useState`) and flows down as props —
deliberately simple and easy to follow for a demo.

## What's mocked

- World generation (staged async pipeline, deterministic per prompt).
- NPC dialogue is scripted per command.
- Recording/export is represented by the on-screen `REC` cue only.
