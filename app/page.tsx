"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PromptBar from "@/components/PromptBar";
import DirectorControls from "@/components/DirectorControls";
import CameraControls from "@/components/CameraControls";
import StoryPanel from "@/components/StoryPanel";
import Timeline from "@/components/Timeline";
import LoadingOverlay from "@/components/LoadingOverlay";
import CineControls from "@/components/CineControls";
import { CAMERA_ORDER, CAMERA_PRESETS } from "@/lib/cameraPresets";
import { commandById, MOODS } from "@/lib/directorCommands";
import { generateWorld, OPENING_STORY, pollMarbleWorld } from "@/lib/worldGen";
import { buildSceneScript, type Shot } from "@/lib/sceneScript";
import { Soundscape } from "@/lib/soundscape";
import { narrator } from "@/lib/narration";
import { ClipRecorder, downloadClip, recordingSupported } from "@/lib/recorder";
import type { Beat, CameraId, MoodId, StoryLine, World } from "@/lib/types";

// Three.js touches window/WebGL — load client-side only.
const WorldViewer = dynamic(() => import("@/components/WorldViewer"), {
  ssr: false,
});

export default function Page() {
  const [world, setWorld] = useState<World | null>(null);
  const [generating, setGenerating] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1);
  const [pendingPrompt, setPendingPrompt] = useState("");

  const [moodId, setMoodId] = useState<MoodId>("default");
  const [cameraId, setCameraId] = useState<CameraId>("wide");

  const [beats, setBeats] = useState<Beat[]>([]);
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const [story, setStory] = useState<StoryLine[]>([]);

  const [cue, setCue] = useState(false);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Cinematic feature state ----
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const [cinematic, setCinematic] = useState(false);

  const soundscapeRef = useRef<Soundscape | null>(null);
  const recorderRef = useRef<ClipRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scriptRef = useRef<Shot[]>([]);
  const shotIdxRef = useRef(0);
  const scriptWorldRef = useRef<string | null>(null);

  const flashCue = useCallback(() => {
    setCue(false);
    requestAnimationFrame(() => setCue(true));
    if (cueTimer.current) clearTimeout(cueTimer.current);
    cueTimer.current = setTimeout(() => setCue(false), 520);
  }, []);

  // ---- Auto-director playback ----------------------------------------------
  const stopScene = useCallback(() => {
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    playTimerRef.current = null;
    setPlaying(false);
    narrator.cancel();
  }, []);

  const stepScene = useCallback(() => {
    const script = scriptRef.current;
    const i = shotIdxRef.current;
    if (i >= script.length) {
      setPlaying(false);
      return;
    }
    const shot = script[i];
    setMoodId(shot.mood);
    setCameraId(shot.camera);
    setStory(shot.lines);
    setActiveBeatId(shot.id);
    flashCue();
    shotIdxRef.current = i + 1;
    playTimerRef.current = setTimeout(stepScene, shot.durationMs);
  }, [flashCue]);

  const togglePlay = useCallback(() => {
    if (playing) {
      // Pause — keep position so play resumes from the next shot.
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
      setPlaying(false);
      narrator.cancel();
      return;
    }
    if (!world) return;
    const needsFresh =
      scriptWorldRef.current !== world.id ||
      shotIdxRef.current >= scriptRef.current.length;
    if (needsFresh) {
      const script = buildSceneScript(world);
      scriptRef.current = script;
      shotIdxRef.current = 0;
      scriptWorldRef.current = world.id;
      setBeats(
        script.map((s) => ({
          id: s.id,
          time: s.time,
          title: s.beatTitle,
          mood: s.mood,
        }))
      );
    }
    setPlaying(true);
    stepScene();
  }, [playing, world, stepScene]);

  // ---- Soundscape -----------------------------------------------------------
  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      if (!soundscapeRef.current) soundscapeRef.current = new Soundscape();
      if (next) soundscapeRef.current.start(moodId); // gesture-driven
      else soundscapeRef.current.setMuted(true);
      return next;
    });
  }, [moodId]);

  useEffect(() => {
    if (soundOn) soundscapeRef.current?.apply(moodId);
  }, [moodId, soundOn]);

  useEffect(() => () => soundscapeRef.current?.dispose(), []);

  // ---- Voice narration ------------------------------------------------------
  const toggleVoice = useCallback(() => {
    setVoiceOn((on) => {
      const next = !on;
      narrator.setEnabled(next);
      if (!next) narrator.cancel();
      return next;
    });
  }, []);

  useEffect(() => {
    if (voiceOn && story.length) narrator.speakLines(story);
  }, [story, voiceOn]);

  // ---- Recording ------------------------------------------------------------
  useEffect(() => setCanRecord(recordingSupported()), []);

  const handleCanvasReady = useCallback((c: HTMLCanvasElement | null) => {
    canvasRef.current = c;
  }, []);

  const toggleRecord = useCallback(async () => {
    if (!recorderRef.current) recorderRef.current = new ClipRecorder();
    const rec = recorderRef.current;
    if (rec.active) {
      const blob = await rec.stop();
      setRecording(false);
      if (blob) downloadClip(blob, `directors-sandbox-${Date.now()}`);
    } else {
      if (!canvasRef.current) return;
      // Include the live soundscape track when sound is on.
      const audio = soundOn ? soundscapeRef.current?.captureAudioTrack() ?? null : null;
      if (rec.start(canvasRef.current, 30, audio)) setRecording(true);
    }
  }, [soundOn]);

  const toggleCinematic = useCallback(() => setCinematic((c) => !c), []);

  // ---- Generation -----------------------------------------------------------
  const handleGenerate = useCallback(
    async (prompt: string) => {
      stopScene();
      setGenerating(true);
      setStageIndex(-1);
      setPendingPrompt(prompt);
      setMoodId("default");
      setCameraId("wide");
      setStory([]);
      setBeats([]);
      setActiveBeatId(null);
      scriptRef.current = [];
      shotIdxRef.current = 0;
      scriptWorldRef.current = null;

      const w = await generateWorld(prompt, (i) => setStageIndex(i));

      setWorld(w);
      setStory(OPENING_STORY);
      const opening: Beat = {
        id: "b-open",
        time: "00:00",
        title: "Establishing shot — the colony wakes",
        mood: "default",
      };
      setBeats([opening]);
      setActiveBeatId(opening.id);
      setGenerating(false);
      setStageIndex(-1);
    },
    [stopScene]
  );

  const handleCommand = useCallback(
    (id: MoodId) => {
      if (!world) return;
      const cmd = commandById(id);
      if (!cmd) return;
      stopScene(); // manual direction overrides autoplay
      setMoodId(id);
      setStory(cmd.story);
      flashCue();
      setBeats((prev) => {
        const existing = prev.find((b) => b.id === cmd.beat.id);
        const next = existing
          ? prev.map((b) => (b.id === cmd.beat.id ? { ...cmd.beat } : b))
          : [...prev, { ...cmd.beat }];
        return next;
      });
      setActiveBeatId(cmd.beat.id);
    },
    [world, flashCue, stopScene]
  );

  const handleCamera = useCallback((id: CameraId) => {
    setCameraId(id);
  }, []);

  const handleBeatSelect = useCallback((beat: Beat) => {
    setActiveBeatId(beat.id);
    if (beat.mood) setMoodId(beat.mood);
    const cmd = beat.mood ? commandById(beat.mood) : undefined;
    if (cmd) setStory(cmd.story);
    else setStory(OPENING_STORY);
  }, []);

  // Background poll for the real Marble world (~5 min).
  useEffect(() => {
    const op = world?.marble?.operationId;
    if (!world || !op || world.marble?.status !== "processing") return;

    let cancelled = false;
    const worldId = world.id;
    const started = Date.now();
    const MAX_MS = 6.5 * 60 * 1000;
    const INTERVAL_MS = 6000;

    async function tick() {
      if (cancelled) return;
      const m = await pollMarbleWorld(op!);
      if (cancelled) return;
      if (m && m.status !== "processing") {
        setWorld((prev) =>
          prev && prev.id === worldId
            ? { ...prev, marble: m, source: m.status === "completed" ? "marble" : prev.source }
            : prev
        );
        return;
      }
      if (Date.now() - started < MAX_MS) {
        timer = setTimeout(tick, INTERVAL_MS);
      }
    }

    let timer = setTimeout(tick, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [world?.id, world?.marble?.operationId, world?.marble?.status]);

  // Stop playback on unmount.
  useEffect(() => () => stopScene(), [stopScene]);

  // Keyboard: 1-5 cameras, Space play/pause, C cinematic.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!world || generating) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key.toLowerCase() === "c") {
        toggleCinematic();
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= CAMERA_ORDER.length) {
        setCameraId(CAMERA_ORDER[n - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [world, generating, togglePlay, toggleCinematic]);

  const activeCamLabel = CAMERA_PRESETS[cameraId].label;
  const activeMoodLabel = MOODS[moodId].label;

  return (
    <div className={`stage ${cinematic ? "cinematic" : ""}`}>
      {/* Left column */}
      <div className="col-left">
        <PromptBar
          onGenerate={handleGenerate}
          generating={generating}
          hasWorld={!!world}
        />
        <DirectorControls
          activeMood={moodId}
          onCommand={handleCommand}
          disabled={!world || generating}
        />
      </div>

      {/* Center viewer */}
      <div className="viewer-wrap">
        <WorldViewer
          world={world}
          moodId={moodId}
          cameraId={cameraId}
          onCanvasReady={handleCanvasReady}
        />

        <div className="frame-marks">
          <span className="tl" />
          <span className="tr" />
          <span className="bl" />
          <span className="br" />
        </div>

        <div className={`cue-flash ${cue ? "on" : ""}`} />

        <div className="viewer-overlay-top">
          <span className={`rec-dot ${recording ? "live" : ""}`}>
            {recording ? "● REC" : "REC"}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {world && (
              <span className={`source-badge ${world.source}`}>
                {world.source === "marble" ? "◆ MARBLE" : "◦ MOCK"}
              </span>
            )}
            <span className="shot-chip">
              {activeCamLabel} · {activeMoodLabel}
            </span>
          </div>
        </div>

        {/* Cinematic transport */}
        <CineControls
          disabled={!world || generating}
          playing={playing}
          onTogglePlay={togglePlay}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          voiceOn={voiceOn}
          onToggleVoice={toggleVoice}
          recording={recording}
          onToggleRecord={toggleRecord}
          canRecord={canRecord}
          cinematic={cinematic}
          onToggleCinematic={toggleCinematic}
        />

        {/* Marble establishing plate */}
        {world?.marble && (world.marble.previewImageUrl || world.marble.viewerUrl) && (
          <div className="marble-plate">
            <div className="marble-plate-head">
              <span>Establishing · Marble</span>
              {world.marble.viewerUrl && (
                <a
                  href={world.marble.viewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="marble-enter"
                >
                  Enter world ↗
                </a>
              )}
            </div>
            {world.marble.previewImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={world.marble.previewImageUrl}
                alt="Marble establishing world"
                className="marble-plate-img"
              />
            ) : (
              <div className="marble-plate-empty">World generated on World Labs</div>
            )}
          </div>
        )}

        {world?.marble?.status === "processing" && (
          <div className="marble-processing">
            ◆ Marble world rendering… ~5 min. Direct the scene meanwhile.
          </div>
        )}

        {world?.marble?.status === "failed" && (
          <div className="marble-error">
            <b>World Labs fell back to local scene.</b>
            <span>{world.marble.message ?? "Request failed."}</span>
            <span className="marble-error-hint">
              {/network|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|CERT|SELF_SIGNED|UNABLE_TO_VERIFY|EPROTO|ECONNRESET|TIMEOUT/i.test(
                world.marble.message ?? ""
              )
                ? "Node can't reach api.worldlabs.ai (proxy / TLS / DNS). See the terminal for details."
                : "Check your key & billing at platform.worldlabs.ai, then regenerate."}
            </span>
          </div>
        )}

        {world && (
          <div className="viewer-overlay-bottom">
            <h1 className="world-title-lg">{world.title}</h1>
            <p className="world-logline">{world.logline}</p>
          </div>
        )}

        {!world && !generating && (
          <div className="empty-state">
            <div className="empty-inner">
              <div className="empty-glyph">◐</div>
              <h2 className="empty-h">Direct your first scene</h2>
              <p className="empty-p">
                Enter a world prompt on the left and hit <b>Generate World</b>.
                Then hit <b>▶ Play Scene</b> to auto-direct a cinematic — or take
                the controls yourself.
              </p>
            </div>
          </div>
        )}

        {generating && (
          <LoadingOverlay prompt={pendingPrompt} stageIndex={stageIndex} />
        )}
      </div>

      {/* Right column */}
      <div className="col-right">
        <CameraControls
          active={cameraId}
          onSelect={handleCamera}
          disabled={!world || generating}
        />
        <StoryPanel world={world} lines={story} />
      </div>

      {/* Bottom timeline */}
      <Timeline
        beats={beats}
        activeBeatId={activeBeatId}
        onSelect={handleBeatSelect}
      />
    </div>
  );
}
