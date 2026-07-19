"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { CameraId, Mood, World, WorldSpec } from "@/lib/types";
import { MOODS } from "@/lib/directorCommands";
import { CAMERA_PRESETS } from "@/lib/cameraPresets";
import { deriveWorldSpec } from "@/lib/worldSpec";

// Used before a world is generated (empty-state backdrop).
const DEFAULT_SPEC: WorldSpec = deriveWorldSpec("Human colony orbiting Saturn");

interface Props {
  world: World | null;
  moodId: Mood["id"];
  cameraId: CameraId;
  /** Receives the live WebGL canvas so the page can record it to a clip. */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

/** Small helpers for smooth lerping of colors/numbers toward a target mood. */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function WorldViewer({ world, moodId, cameraId, onCanvasReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Latest desired state is read inside the animation loop via refs so we never
  // tear down / rebuild the scene on prop changes — everything animates.
  const moodRef = useRef<Mood>(MOODS[moodId]);
  const camRef = useRef<CameraId>(cameraId);

  useEffect(() => {
    moodRef.current = MOODS[moodId];
  }, [moodId]);
  useEffect(() => {
    camRef.current = cameraId;
  }, [cameraId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.set(0, 14, 46);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    renderer.domElement.className = "viewer-canvas";
    // Hand the live canvas up so the page can capture it to a downloadable clip.
    onCanvasReady?.(renderer.domElement);

    // ---- Fog + background ----
    const bgColor = new THREE.Color(MOODS[moodId].fogColor);
    scene.fog = new THREE.FogExp2(bgColor.getHex(), MOODS[moodId].fogDensity);
    scene.background = bgColor.clone();

    // ---- Lights ----
    const ambient = new THREE.AmbientLight(0x4a6cff, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xbfd4ff, 1.15);
    key.position.set(18, 26, 14);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x88aaff, 0.35);
    rim.position.set(-20, 8, -18);
    scene.add(rim);

    // A pulsing point light used by the "emergency" alarm effect.
    const alarm = new THREE.PointLight(0xff2a2a, 0, 60);
    alarm.position.set(0, 10, 6);
    scene.add(alarm);

    // ---- Root that we spin for orbit cameras ----
    const worldRoot = new THREE.Group();
    scene.add(worldRoot);

    // ---- Starfield ----
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 120 + Math.random() * 260;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 + 5;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.9,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ---- World spec (parsed from the prompt) drives all geometry below ----
    const spec: WorldSpec = world?.spec ?? DEFAULT_SPEC;

    // Seeded RNG so a given prompt always builds the same scene.
    const seed = world?.seed ?? 1;
    let s = seed >>> 0;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };

    // Track window-emitting materials so we can boost their glow per mood.
    const windowMats: THREE.MeshStandardMaterial[] = [];
    const winColor = new THREE.Color(spec.windowColor);
    const structColor = new THREE.Color(spec.structureColor);

    function makeWindowMat(): THREE.MeshStandardMaterial {
      const m = new THREE.MeshStandardMaterial({
        color: winColor.clone(),
        emissive: winColor.clone(),
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.1,
      });
      windowMats.push(m);
      return m;
    }

    /** A structure = body + a glowing window strip facing outward. */
    function addStructure(x: number, z: number, w: number, h: number, kind: "box" | "cyl" | "cone") {
      let geo: THREE.BufferGeometry;
      if (kind === "cone") geo = new THREE.ConeGeometry(w * 0.6, h, 10);
      else if (kind === "cyl") geo = new THREE.CylinderGeometry(w * 0.45, w * 0.6, h, 14);
      else geo = new THREE.BoxGeometry(w, h, w);
      const body = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: structColor.clone(), roughness: 0.55, metalness: 0.45 })
      );
      body.position.set(x, h / 2, z);
      worldRoot.add(body);

      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.7, 0.12), makeWindowMat());
      win.position.set(x, h / 2, z);
      win.lookAt(0, h / 2, 0);
      win.translateZ(w * 0.52);
      worldRoot.add(win);
      return body;
    }

    // ---- Planetary backdrop ----
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(34, 48, 48),
      new THREE.MeshStandardMaterial({
        color: spec.planetColor,
        roughness: 1,
        metalness: 0,
        emissive: new THREE.Color(spec.planetColor).multiplyScalar(0.18),
        emissiveIntensity: 0.5,
      })
    );
    planet.position.set(-70, 34, -150);
    scene.add(planet);

    if (spec.hasRings) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(44, 74, 96),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(spec.planetColor).lerp(new THREE.Color(0xffffff), 0.3),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
        })
      );
      ring.rotation.x = Math.PI / 2.35;
      ring.position.copy(planet.position);
      scene.add(ring);
    }

    // ---- Ground ----
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(64, 64),
      new THREE.MeshStandardMaterial({
        color: spec.groundColor,
        roughness: spec.underwater ? 0.4 : 0.85,
        metalness: spec.underwater ? 0.5 : 0.2,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    worldRoot.add(ground);

    const grid = new THREE.GridHelper(
      128,
      64,
      new THREE.Color(spec.accentColor).getHex(),
      new THREE.Color(spec.groundColor).lerp(new THREE.Color(0xffffff), 0.12).getHex()
    );
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.3;
    worldRoot.add(grid);

    // ---- Central landmark (dome / spire / hub) ----
    if (spec.hasDome) {
      const domeMat = new THREE.MeshStandardMaterial({
        color: structColor.clone(),
        roughness: 0.25,
        metalness: 0.6,
        transparent: true,
        opacity: 0.5,
        emissive: winColor.clone().multiplyScalar(0.6),
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
      });
      windowMats.push(domeMat);
      const domeR = spec.archetype === "reef" ? 11 : 9;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(domeR, 40, 40, 0, Math.PI * 2, 0, Math.PI / 2),
        domeMat
      );
      worldRoot.add(dome);
      const domeBase = new THREE.Mesh(
        new THREE.CylinderGeometry(domeR + 0.2, domeR + 0.6, 1.4, 40),
        new THREE.MeshStandardMaterial({ color: structColor.clone().multiplyScalar(0.7), roughness: 0.7, metalness: 0.4 })
      );
      domeBase.position.y = 0.7;
      worldRoot.add(domeBase);
    } else if (spec.spires) {
      // central cathedral spire
      addStructure(0, 0, 3.2, spec.maxHeight, "cone");
    } else {
      // a low central hub
      addStructure(0, 0, 4, 3, "cyl");
    }

    // ---- Settlement structures by archetype ----
    const count = spec.buildingCount;
    if (spec.archetype === "megacity") {
      // dense concentric rings of tall thin towers
      for (let i = 0; i < count; i++) {
        const ring = 1 + Math.floor(rand() * 3);
        const ang = rand() * Math.PI * 2;
        const radius = 8 + ring * (spec.spread / 3) + rand() * 3;
        const h = spec.maxHeight * (0.4 + rand() * 0.6);
        const w = 1.2 + rand() * 1.6;
        addStructure(Math.cos(ang) * radius, Math.sin(ang) * radius, w, h, rand() > 0.7 ? "cyl" : "box");
      }
    } else if (spec.archetype === "reef") {
      // organic clustered rounded blobs
      for (let i = 0; i < count; i++) {
        const ang = rand() * Math.PI * 2;
        const radius = 6 + rand() * spec.spread;
        const r = 1.4 + rand() * 3;
        const mat = new THREE.MeshStandardMaterial({
          color: structColor.clone(),
          roughness: 0.5,
          metalness: 0.3,
          emissive: winColor.clone().multiplyScalar(0.5),
          emissiveIntensity: 0.5,
        });
        windowMats.push(mat);
        const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
        blob.scale.set(1, 0.7 + rand() * 0.8, 1);
        blob.position.set(Math.cos(ang) * radius, r * 0.6, Math.sin(ang) * radius);
        worldRoot.add(blob);
      }
    } else if (spec.archetype === "monastery") {
      // ring of tall thin spires
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + rand() * 0.2;
        const radius = 9 + rand() * spec.spread * 0.5;
        const h = spec.maxHeight * (0.4 + rand() * 0.5);
        addStructure(Math.cos(ang) * radius, Math.sin(ang) * radius, 1.6 + rand(), h, "cone");
      }
    } else if (spec.archetype === "outpost") {
      // a few low wide modules + comms dishes
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + rand() * 0.4;
        const radius = 10 + rand() * spec.spread;
        const w = 2.6 + rand() * 2.4;
        addStructure(Math.cos(ang) * radius, Math.sin(ang) * radius, w, 2 + rand() * spec.maxHeight, "box");
      }
    } else {
      // domeColony — ring of mixed towers + corridors to the dome
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + rand() * 0.3;
        const radius = 16 + rand() * spec.spread;
        const h = 4 + rand() * spec.maxHeight;
        const w = 1.6 + rand() * 2.4;
        addStructure(Math.cos(ang) * radius, Math.sin(ang) * radius, w, h, rand() > 0.5 ? "box" : "cyl");
      }
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const len = 24;
        const corridor = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, len),
          new THREE.MeshStandardMaterial({ color: structColor.clone().multiplyScalar(0.8), roughness: 0.6, metalness: 0.5 })
        );
        corridor.position.set((Math.cos(ang) * len) / 2, 1.2, (Math.sin(ang) * len) / 2);
        corridor.rotation.y = -ang;
        worldRoot.add(corridor);
      }
    }

    // A slowly rotating comms beacon marking the center of the settlement.
    const beacon = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff6060, emissiveIntensity: 1 })
    );
    beacon.position.set(0, (spec.hasDome ? 10.5 : spec.maxHeight + 1), 0);
    worldRoot.add(beacon);

    // ---- Alien craft (hidden unless "alien" mood) ----
    const alienGroup = new THREE.Group();
    const alienBody = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0x0b241a,
        emissive: 0x22ff9d,
        emissiveIntensity: 1.2,
        roughness: 0.3,
        metalness: 0.7,
      })
    );
    alienBody.scale.set(1, 0.32, 1);
    alienGroup.add(alienBody);
    // beam cone
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 22, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x35ffb0,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = -11;
    alienGroup.add(beam);
    alienGroup.position.set(0, 26, 0);
    alienGroup.visible = false;
    // On `scene` (not worldRoot) so it stays visible as an overlay even when the
    // procedural settlement is hidden by a loaded Marble mesh.
    scene.add(alienGroup);

    // ---- Real Marble world (GLB), loaded when a completed job provides one ----
    // When present, we hide the procedural settlement (worldRoot) and drop the
    // actual generated geometry into the scene, auto-fitted and re-lit by the
    // active mood. Backdrop (stars, planet, fog) and effects keep working.
    // Set in cleanup; the async GLB callback checks it before touching the scene.
    let disposed = false;

    // The real generated world ships as a 360° equirectangular panorama. When a
    // job completes, wrap the viewport in it so the UI shows the ACTUAL world
    // (the Marble interactive viewer forbids iframing, and the collider mesh is
    // an untextured proxy). The pano also lights any loaded geometry.
    const marblePanoUrl =
      world?.marble?.status === "completed" ? world?.marble?.panoUrl : undefined;
    if (marblePanoUrl) {
      const texLoader = new THREE.TextureLoader();
      texLoader.setCrossOrigin("anonymous");
      texLoader.load(
        marblePanoUrl,
        (tex) => {
          if (disposed) return;
          tex.mapping = THREE.EquirectangularReflectionMapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          scene.background = tex; // real world imagery surrounds the camera
          scene.environment = tex; // and lights any geometry we drop in
          worldRoot.visible = false; // hide the stylized stand-in
        },
        undefined,
        (err) => {
          console.warn("Marble pano load failed; keeping local scene.", err);
        }
      );
    }

    const marbleMeshUrl = world?.marble?.meshUrl;
    if (marbleMeshUrl) {
      const loader = new GLTFLoader();
      // Marble GLBs may be Draco-compressed; wire a decoder so those still load.
      const draco = new DRACOLoader();
      draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
      loader.setDRACOLoader(draco);

      loader.load(
        marbleMeshUrl,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;

          // Auto-fit: center on origin, sit on the ground, scale to the stage.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 46 / maxDim;
          model.scale.setScalar(scale);
          model.position.set(
            -center.x * scale,
            -center.y * scale + (size.y * scale) / 2,
            -center.z * scale
          );

          // Ensure every surface reacts to the mood lighting (collider meshes
          // often arrive untextured/basic).
          model.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mat = mesh.material as THREE.Material | undefined;
            if (!mat || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
              // With the pano set as scene.environment, a reflective material
              // lets the proxy geometry pick up the real world's colors instead
              // of reading as a dead gray blob.
              mesh.material = new THREE.MeshStandardMaterial({
                color: marblePanoUrl ? 0xc7d2e4 : 0x9aa7c0,
                roughness: marblePanoUrl ? 0.35 : 0.85,
                metalness: marblePanoUrl ? 0.65 : 0.15,
                envMapIntensity: marblePanoUrl ? 1.4 : 1,
              });
            }
          });

          scene.add(model);
          worldRoot.visible = false; // hide the stylized stand-in
          draco.dispose();
        },
        undefined,
        (err) => {
          // Keep the procedural scene on any load/CORS/decode error.
          console.warn("Marble GLB load failed; keeping local scene.", err);
          draco.dispose();
        }
      );
    }

    // ---- Rain (hidden unless "rain" mood) ----
    const rainCount = 3500;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    const rainVel = new Float32Array(rainCount);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 100;
      rainPos[i * 3 + 1] = Math.random() * 60;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      rainVel[i] = 0.4 + Math.random() * 0.8;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.35,
      transparent: true,
      opacity: 0.6,
    });
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.visible = false;
    scene.add(rain);

    // ---- Drifting dust for "abandoned" ----
    const dustCount = 600;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 80;
      dustPos[i * 3 + 1] = Math.random() * 24;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xbdb8a4,
      size: 0.5,
      transparent: true,
      opacity: 0,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // ---- Camera rig state (for smooth transitions) ----
    const camPos = new THREE.Vector3().copy(camera.position);
    const camTarget = new THREE.Vector3(0, 4, 0);
    const desiredPos = new THREE.Vector3().copy(camPos);
    const desiredTarget = new THREE.Vector3().copy(camTarget);
    let orbitAngle = 0;

    // Working color objects (avoid per-frame allocation)
    const cAmbient = new THREE.Color();
    const cKey = new THREE.Color();
    const cFog = new THREE.Color();
    const cBg = new THREE.Color();

    const clock = new THREE.Clock();
    let raf = 0;

    function resize() {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    function animate() {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const mood = moodRef.current;
      const preset = CAMERA_PRESETS[camRef.current];
      const k = 1 - Math.pow(0.001, dt); // frame-rate independent lerp factor (~fast)
      const kSlow = 1 - Math.pow(0.02, dt);

      // --- Lighting lerp toward mood ---
      cAmbient.setHex(mood.ambientColor);
      ambient.color.lerp(cAmbient, k);
      ambient.intensity = lerp(ambient.intensity, mood.ambientIntensity, k);

      cKey.setHex(mood.keyColor);
      key.color.lerp(cKey, k);
      key.intensity = lerp(key.intensity, mood.keyIntensity, k);
      key.position.x = lerp(key.position.x, mood.keyPosition[0], kSlow);
      key.position.y = lerp(key.position.y, mood.keyPosition[1], kSlow);
      key.position.z = lerp(key.position.z, mood.keyPosition[2], kSlow);

      // --- Fog + background lerp ---
      cFog.setHex(mood.fogColor);
      cBg.setHex(mood.fogColor);
      (scene.fog as THREE.FogExp2).color.lerp(cFog, k);
      (scene.fog as THREE.FogExp2).density = lerp(
        (scene.fog as THREE.FogExp2).density,
        mood.fogDensity,
        k
      );
      // Only lerp when the background is still the procedural mood color; once a
      // Marble panorama texture is installed we leave it alone.
      if ((scene.background as THREE.Color)?.isColor) {
        (scene.background as THREE.Color).lerp(cBg, k);
      }
      renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, mood.grade.exposure, k);

      // --- Window / structure glow ---
      const targetGlow = 0.3 + mood.emissiveBoost * 1.3;
      for (const m of windowMats) {
        m.emissiveIntensity = lerp(m.emissiveIntensity, targetGlow, k);
      }

      // --- Stars fade ---
      starMat.opacity = lerp(starMat.opacity, mood.starIntensity, k);

      // --- Effects ---
      const wantAlarm = mood.effects.includes("alarm");
      alarm.intensity = wantAlarm ? (Math.sin(t * 9) * 0.5 + 0.5) * 3.2 : lerp(alarm.intensity, 0, k);
      beacon.rotation.y += dt * (wantAlarm ? 8 : 1.2);
      (beacon.material as THREE.MeshStandardMaterial).emissiveIntensity = wantAlarm
        ? (Math.sin(t * 9) * 0.5 + 0.5) * 2 + 0.3
        : 1;

      const wantRain = mood.effects.includes("rain");
      rain.visible = rainMat.opacity > 0.02 || wantRain;
      rainMat.opacity = lerp(rainMat.opacity, wantRain ? 0.6 : 0, k);
      if (rain.visible) {
        const pos = rainGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < rainCount; i++) {
          let y = pos.getY(i) - rainVel[i] * dt * 40;
          if (y < 0) y = 60;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      const wantAlien = mood.effects.includes("beams");
      alienGroup.visible = wantAlien;
      if (wantAlien) {
        alienGroup.position.y = 24 + Math.sin(t * 1.1) * 1.5;
        alienGroup.rotation.y += dt * 0.4;
        alienBody.rotation.y += dt * 0.8;
      }

      const wantDust = mood.effects.includes("fog");
      dustMat.opacity = lerp(dustMat.opacity, wantDust ? 0.5 : 0, k);
      if (dustMat.opacity > 0.02) {
        const pos = dustGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < dustCount; i++) {
          pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.6);
          pos.setY(i, pos.getY(i) + dt * 0.3);
          if (pos.getY(i) > 24) pos.setY(i, 0);
        }
        pos.needsUpdate = true;
      }

      // --- Camera: compute desired position (with optional orbit) ---
      desiredPos.set(preset.position[0], preset.position[1], preset.position[2]);
      desiredTarget.set(preset.target[0], preset.target[1], preset.target[2]);
      if (preset.orbit) {
        orbitAngle += dt * preset.orbitSpeed;
        const radius = Math.hypot(preset.position[0], preset.position[2]) || 34;
        desiredPos.x = Math.sin(orbitAngle) * radius;
        desiredPos.z = Math.cos(orbitAngle) * radius;
      }
      camPos.lerp(desiredPos, kSlow);
      camTarget.lerp(desiredTarget, kSlow);
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      camera.fov = lerp(camera.fov, preset.fov, kSlow);
      camera.updateProjectionMatrix();

      // gentle idle rotation of the whole world for life
      worldRoot.rotation.y += dt * 0.02;
      stars.rotation.y += dt * 0.005;
      planet.rotation.y += dt * 0.01;

      renderer.render(scene, camera);
    }
    animate();

    // Handle context loss gracefully (keeps demo alive on GPU hiccups)
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    const onRestored = () => {
      clock.start();
      animate();
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    renderer.domElement.addEventListener("webglcontextrestored", onRestored);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onRestored);
      renderer.dispose();
      scene.traverse((obj) => {
        const anyObj = obj as any;
        if (anyObj.geometry) anyObj.geometry.dispose?.();
        if (anyObj.material) {
          const mat = anyObj.material;
          if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m.dispose());
          else mat.dispose?.();
        }
      });
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      onCanvasReady?.(null);
    };
    // Rebuild when the world identity changes (new generation) OR when a real
    // Marble mesh becomes available (~5 min later) so it can be loaded in.
    // mood + camera changes are handled live via refs, no rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world?.id, world?.marble?.meshUrl, world?.marble?.panoUrl]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
