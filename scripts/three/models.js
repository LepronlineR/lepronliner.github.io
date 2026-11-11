import { SCENE_COLORS } from "./scene-design.js";

const PISTACHIO_BASE = "/assets/models/pistachio/";

export const MODEL_CATALOG = [
  ["palm", "palm_2.obj", "palm_2_tex.png", SCENE_COLORS.models.palmTint],
  ["zx", "low_spec_zx_spectrum.obj", "zx_spectrum_tex.png", SCENE_COLORS.models.zxTint],
  ["c64", "low_spec_commodore_64.obj", "c_64_tex.png", SCENE_COLORS.models.c64Tint],
  ["pet", "low_spec_commodore_pet.obj", "c_pet_tex.png", SCENE_COLORS.models.petTint]
];

async function loadPistachioModel(THREE, objLoader, textureLoader, objName, textureName, tint = "white") {
  const [texture, model] = await Promise.all([
    textureLoader.loadAsync(`${PISTACHIO_BASE}${textureName}`),
    objLoader.loadAsync(`${PISTACHIO_BASE}${objName}`)
  ]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  // Cut-out alpha only: no blending, so these draw in the cheap opaque pass.
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: tint,
    roughness: 0.9,
    metalness: 0,
    alphaTest: 0.2,
    side: THREE.DoubleSide
  });

  model.traverse((child) => {
    if (child.isMesh) child.material = material;
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  model.scale.setScalar(largest ? 1 / largest : 1);
  const normalizedBox = new THREE.Box3().setFromObject(model);
  model.position.y -= normalizedBox.min.y;
  return { model, material };
}

// A small hand-built signpost, in the same low-poly style as the loaded models.
function createSignpost(THREE, materials) {
  const wood = new THREE.MeshStandardMaterial({
    color: SCENE_COLORS.models.wood,
    roughness: 0.95,
    flatShading: true
  });
  const plankWood = new THREE.MeshStandardMaterial({
    color: SCENE_COLORS.models.woodLight,
    roughness: 0.9,
    flatShading: true
  });

  materials.wood = wood;
  materials.woodLight = plankWood;

  const post = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.92, 6), wood);
  pole.position.y = 0.46;
  post.add(pole);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.19, 0.05), plankWood);
  upper.position.set(0.1, 0.74, 0.03);
  upper.rotation.z = 0.06;
  post.add(upper);

  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.05), plankWood);
  lower.position.set(-0.08, 0.5, 0.03);
  lower.rotation.z = -0.08;
  post.add(lower);

  return post;
}

export async function loadIslandModels(THREE, OBJLoader) {
  const objLoader = new OBJLoader();
  const textureLoader = new THREE.TextureLoader();
  const materials = {};
  const models = { signpost: createSignpost(THREE, materials) };

  await Promise.all(MODEL_CATALOG.map(async ([key, obj, texture, tint]) => {
    const loaded = await loadPistachioModel(THREE, objLoader, textureLoader, obj, texture, tint);
    models[key] = loaded.model;
    materials[key] = loaded.material;
  }));

  return { models, materials };
}

export function placeModel(world, models, key, position, scale = 1, rotation = 0) {
  const model = models[key].clone(true);
  model.position.add(position);
  model.rotation.y = rotation;
  model.scale.multiplyScalar(scale);
  world.add(model);
  return model;
}
