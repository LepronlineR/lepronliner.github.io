import { addSceneLighting, createHorizonHaze, createStarField } from "./environment.js";
import { createLandmarks, updateLandmarkHover } from "./island-content.js";
import {
  createControls,
  createLabelProjector,
  createLabels,
  createPicker,
  createSceneUi
} from "./interactions.js";
import { loadIslandModels } from "./models.js";
import { createOcean } from "./ocean.js";
import { CAMERA_DESIGN, SCENE_COLORS, SCENE_THEMES, WORLD_DESIGN } from "./scene-design.js";
import { createSceneTheme, followPageTheme } from "./scene-theme.js";
import { buildIsland, makeIslandTexture, makeSurfacePoint } from "./terrain.js";

// "three" resolves through the page's import map. Both modules download in parallel.
async function loadThreeRuntime() {
  const [THREE, { OBJLoader }] = await Promise.all([
    import("three"),
    import("three/addons/loaders/OBJLoader.js")
  ]);
  return { THREE, OBJLoader };
}

function createIsland(THREE) {
  const material = new THREE.MeshStandardMaterial({
    map: makeIslandTexture(THREE, SCENE_COLORS.island),
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide,
    flatShading: true
  });
  const island = buildIsland(THREE, {
    ...WORLD_DESIGN.island,
    material,
    palette: SCENE_COLORS.island
  });
  island.rotation.y = WORLD_DESIGN.island.rotationY;
  return island;
}

/*
  Keeps the whole island in frame on narrow screens: widen the lens up to a limit,
  then make up the rest by pulling the camera back.
*/
function fitCamera(camera, aspect) {
  const baseTan = Math.tan((CAMERA_DESIGN.fov * Math.PI) / 360);
  const wantedTan = baseTan * Math.max(1, 1.25 / aspect);
  const lensTan = Math.min(wantedTan, Math.tan((58 * Math.PI) / 360));
  camera.fov = (Math.atan(lensTan) * 360) / Math.PI;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  return wantedTan / lensTan;
}

/*
  mode "full":    the full-screen page. Landmarks open an info card; zoom is enabled.
  mode "preview": the framed window on the home page. Landmarks are plain links and the
                  scene never takes over page scroll.
*/
export async function startIslandScene({ shell, mode = "full" }) {
  const canvas = shell?.querySelector(".scene-canvas");
  const labelLayer = shell?.querySelector(".scene-labels");
  if (!shell || !canvas || !labelLayer) return;

  const full = mode === "full";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let THREE;
  let renderer;
  let models;
  let materials;
  try {
    const runtime = await loadThreeRuntime();
    THREE = runtime.THREE;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    ({ models, materials } = await loadIslandModels(THREE, runtime.OBJLoader));
  } catch (error) {
    console.warn("Island scene unavailable:", error);
    renderer?.dispose();
    shell.classList.add("is-static");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, full ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_DESIGN.fov, 1, 0.1, 3000);
  const cameraTarget = new THREE.Vector3(...CAMERA_DESIGN.target);

  const world = new THREE.Group();
  world.position.set(...WORLD_DESIGN.position);
  scene.add(world);
  const stars = createStarField(THREE, SCENE_COLORS.stars);
  scene.add(stars);
  const lights = addSceneLighting(THREE, scene);

  const surfacePoint = makeSurfacePoint(THREE);
  const island = createIsland(THREE);
  world.add(island);
  materials.island = island.material;

  const ocean = createOcean(THREE, {
    design: WORLD_DESIGN.ocean,
    colors: SCENE_THEMES.dark.ocean,
    island: WORLD_DESIGN.island
  });
  world.add(ocean.mesh);
  const hazes = {
    dark: createHorizonHaze(THREE, SCENE_THEMES.dark.haze),
    light: createHorizonHaze(THREE, SCENE_THEMES.light.haze)
  };
  world.add(hazes.dark, hazes.light);
  followPageTheme(createSceneTheme({ lights, ocean, stars, hazes, materials }));

  const { landmarks, hitTargets } = createLandmarks({ THREE, world, models, surfacePoint });
  island.updateMatrixWorld(true);

  const labelEls = createLabels({ layer: labelLayer, landmarks });
  const projector = createLabelProjector(THREE, { labelEls, landmarks, camera, occluder: island });
  const pick = createPicker(THREE, { shell, camera, hitTargets });

  let hoverEvent = null;
  let hoverDirty = false;
  let hotKey = null;
  let labelsDirty = true;
  const activeKeys = new Set();
  let closedByMotion = false;

  function setHot(key) {
    if (key === hotKey) return;
    if (hotKey) labelEls[hotKey].classList.remove("is-hot");
    hotKey = key;
    if (hotKey) labelEls[hotKey].classList.add("is-hot");
    shell.classList.toggle("has-hot-landmark", Boolean(hotKey));
    syncActiveKeys();
  }

  function syncActiveKeys() {
    activeKeys.clear();
    if (hotKey) activeKeys.add(hotKey);
    if (ui?.selected) activeKeys.add(ui.selected);
  }

  const controls = createControls({
    THREE,
    shell,
    camera,
    cameraTarget,
    design: CAMERA_DESIGN,
    full,
    reducedMotion,
    onInput: () => shell.classList.add("has-interacted"),
    onMove: () => {
      if (!ui?.selected) return;
      closedByMotion = true;
      ui.select(null);
      closedByMotion = false;
    },
    onHover: (event) => {
      hoverEvent = event ? { x: event.clientX, y: event.clientY } : null;
      hoverDirty = true;
    },
    onTap: (event) => {
      const key = pick(event.clientX, event.clientY);
      if (full) ui.activate(key);
      else if (key) window.location.assign(landmarks[key].href);
    }
  });

  const ui = full
    ? createSceneUi({
        shell,
        labelEls,
        landmarks,
        onSelect: (key) => {
          if (!key && closedByMotion) controls.release();
          else controls.focus(key ? landmarks[key].focusPoint : null);
          syncActiveKeys();
        }
      })
    : null;

  // Labels are links: hovering one should light up its landmark too.
  for (const key in labelEls) {
    labelEls[key].addEventListener("pointerenter", () => setHot(key));
    labelEls[key].addEventListener("pointerleave", () => setHot(null));
  }

  if (full) {
    document.addEventListener("keydown", (event) => {
      if (event.key === "+" || event.key === "=") controls.nudgeZoom(-0.8);
      if (event.key === "-" || event.key === "_") controls.nudgeZoom(0.8);
    });
  }

  function resize() {
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    controls.setDistanceScale(fitCamera(camera, width / height));
    projector.setSize(width, height);
    labelsDirty = true;
  }

  new ResizeObserver(resize).observe(shell);
  resize();

  let lastTime = null;
  let isReady = false;

  function frame(milliseconds) {
    const now = milliseconds / 1000;
    const dt = lastTime === null ? 0.016 : Math.min(now - lastTime, 0.05);
    lastTime = now;

    ocean.uniforms.uTime.value = now;
    const cameraMoved = controls.update(now, dt);

    // Pointer picking runs at most once per frame, and again while the camera moves under a still cursor.
    if (hoverDirty || (cameraMoved && hoverEvent)) {
      hoverDirty = false;
      setHot(hoverEvent ? pick(hoverEvent.x, hoverEvent.y) : null);
    }

    updateLandmarkHover(landmarks, activeKeys, dt);

    if (cameraMoved || labelsDirty) {
      labelsDirty = false;
      projector.update();
    }

    renderer.render(scene, camera);

    if (!isReady) {
      isReady = true;
      shell.classList.add("is-ready");
    }
  }

  // Only spend GPU time while the scene is on screen.
  let running = false;
  function setRunning(next) {
    if (next === running) return;
    running = next;
    lastTime = null;
    renderer.setAnimationLoop(next ? frame : null);
  }

  new IntersectionObserver((entries) => {
    setRunning(entries.some((entry) => entry.isIntersecting));
  }).observe(shell);
}
