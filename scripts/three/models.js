import { SCENE_COLORS } from "./scene-design.js";

const PISTACHIO_BASE = "/assets/models/pistachio/";

export const MODEL_CATALOG = [
  ["palm", "palm_2.obj", "palm_2_tex.png", SCENE_COLORS.models.palmTint],
  ["zx", "low_spec_zx_spectrum.obj", "zx_spectrum_tex.png", SCENE_COLORS.models.zxTint],
  ["c64", "low_spec_commodore_64.obj", "c_64_tex.png", SCENE_COLORS.models.c64Tint],
  ["pet", "low_spec_commodore_pet.obj", "c_pet_tex.png", SCENE_COLORS.models.petTint]
];

async function loadPistachioModel(THREE, objLoader, textureLoader, objName, textureName, tint = "white") {
  const texture = await textureLoader.loadAsync(`${PISTACHIO_BASE}${textureName}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;

  const model = await objLoader.loadAsync(`${PISTACHIO_BASE}${objName}`);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: tint,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    alphaTest: 0.2,
    side: THREE.DoubleSide
  });

  model.traverse((child) => {
    if (!child.isMesh) return;
    child.material = material;
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  const unitScale = largest ? 1 / largest : 1;
  model.scale.setScalar(unitScale);
  const normalizedBox = new THREE.Box3().setFromObject(model);
  model.position.y -= normalizedBox.min.y;
  return model;
}

export async function loadPistachioModels(THREE, OBJLoader) {
  const objLoader = new OBJLoader();
  const textureLoader = new THREE.TextureLoader();
  const models = {};

  await Promise.all(MODEL_CATALOG.map(async ([key, obj, texture, tint]) => {
    models[key] = await loadPistachioModel(THREE, objLoader, textureLoader, obj, texture, tint);
  }));

  return models;
}

export function placeModel(THREE, world, models, key, position, scale = 1, rotation = 0) {
  const model = models[key].clone(true);
  model.position.copy(position);
  model.rotation.y = rotation;
  model.scale.multiplyScalar(scale);
  world.add(model);
  return model;
}
