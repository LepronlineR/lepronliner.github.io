import { addSceneLighting, createHorizonHaze, createStarField } from "./environment.js";
import { createIslandAnchors, addIslandMarkers } from "./island-content.js";
import {
  createAnchorPicker,
  createIslandControls,
  createLabelProjector,
  createSceneCardController
} from "./interactions.js";
import { loadPistachioModels } from "./models.js";
import { createOcean, updateOceanSurface } from "./ocean.js";
import { CAMERA_DESIGN, SCENE_COLORS, WORLD_DESIGN } from "./scene-design.js";
import { buildIsland, makeIslandTexture, makeSurfacePoint } from "./terrain.js";

async function loadThreeRuntime() {
  const THREE = await import("https://esm.sh/three@0.184.0");
  const { OBJLoader } = await import("https://esm.sh/three@0.184.0/examples/jsm/loaders/OBJLoader.js");
  return { THREE, OBJLoader };
}

function createRenderer(THREE, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function createCamera(THREE) {
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30000);
  const cameraTarget = new THREE.Vector3(...CAMERA_DESIGN.target);
  camera.position.set(...CAMERA_DESIGN.start);
  camera.lookAt(cameraTarget);
  return { camera, cameraTarget };
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

function resizeViewport({ canvas, renderer, camera }) {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
}

export async function startIslandScene({ canvas, heroShell, sceneLabels, sceneCard }) {
  if (!canvas || !heroShell) return;

  let runtime;
  try {
    runtime = await loadThreeRuntime();
  } catch {
    canvas.classList.add("is-static");
    return;
  }

  const { THREE, OBJLoader } = runtime;
  const scene = new THREE.Scene();
  const renderer = createRenderer(THREE, canvas);
  const { camera, cameraTarget } = createCamera(THREE);

  const world = new THREE.Group();
  world.position.set(...WORLD_DESIGN.position);
  scene.add(world);

  scene.add(createStarField(THREE, SCENE_COLORS.stars));
  addSceneLighting(THREE, scene, SCENE_COLORS.lighting);

  const surfacePoint = makeSurfacePoint(THREE);
  const island = createIsland(THREE);
  world.add(island);

  const ocean = await createOcean(THREE, {
    design: WORLD_DESIGN.ocean,
    colors: SCENE_COLORS.ocean
  });
  world.add(ocean.mesh);
  world.add(createHorizonHaze(THREE, SCENE_COLORS.haze));

  const models = await loadPistachioModels(THREE, OBJLoader);
  const anchors = createIslandAnchors(surfacePoint);
  const interactiveObjects = addIslandMarkers({ THREE, world, models, surfacePoint });

  const cardController = createSceneCardController({ heroShell, sceneLabels, sceneCard, anchors });
  const pickAnchorKey = createAnchorPicker(THREE, { canvas, camera, interactiveObjects });
  const updateCamera = createIslandControls({
    heroShell,
    camera,
    cameraTarget,
    cameraDesign: CAMERA_DESIGN,
    anchors,
    pickAnchorKey,
    cardController
  });
  const updateLabels = createLabelProjector(THREE, {
    heroShell,
    sceneLabels,
    anchors,
    world,
    camera,
    occluder: island
  });

  cardController.bindLabels();
  cardController.hide();

  window.addEventListener("resize", () => resizeViewport({ canvas, renderer, camera }));
  resizeViewport({ canvas, renderer, camera });

  renderer.setAnimationLoop((time) => {
    updateOceanSurface(ocean, time * 0.001);
    updateCamera();
    updateLabels();
    renderer.render(scene, camera);
  });
}
