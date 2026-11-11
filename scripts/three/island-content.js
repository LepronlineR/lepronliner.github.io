import { DECORATIVE_MARKERS, ISLAND_LINKS } from "./scene-design.js";
import { placeModel } from "./models.js";

function addMarker({ world, models, surfacePoint, marker, position }) {
  const [x, z] = position;
  const model = placeModel(world, models, marker.model, surfacePoint(x, z), marker.scale, marker.rotation);
  if (marker.yScale) model.scale.y *= marker.yScale;
  return model;
}

// Builds every landmark: its model, an invisible sphere used for picking (much cheaper
// and more forgiving than ray-testing the model's triangles), and its label anchor.
export function createLandmarks({ THREE, world, models, surfacePoint }) {
  const hitGeometry = new THREE.SphereGeometry(1, 12, 8);
  const hitMaterial = new THREE.MeshBasicMaterial();
  const landmarks = {};
  const hitTargets = [];

  world.updateMatrixWorld(true);

  ISLAND_LINKS.forEach((link, index) => {
    const [x, z] = link.position;
    const model = addMarker({ world, models, surfacePoint, marker: link.marker, position: link.position });

    const hit = new THREE.Mesh(hitGeometry, hitMaterial);
    hit.position.copy(surfacePoint(x, z, link.hitRadius * 0.75));
    hit.scale.setScalar(link.hitRadius);
    hit.visible = false;
    hit.userData.key = link.key;
    world.add(hit);
    hit.updateMatrixWorld(true);
    hitTargets.push(hit);

    landmarks[link.key] = {
      ...link.card,
      key: link.key,
      index,
      label: link.label,
      model,
      baseScale: model.scale.clone(),
      hover: 0,
      // World-space points: where the label floats, and what the camera looks at.
      labelPoint: world.localToWorld(surfacePoint(x, z, link.labelLift)),
      focusPoint: world.localToWorld(surfacePoint(x, z, 0.3))
    };
  });

  DECORATIVE_MARKERS.forEach((marker) => {
    addMarker({ world, models, surfacePoint, marker, position: marker.position });
  });

  return { landmarks, hitTargets };
}

// Eases each landmark toward a slightly larger size while it is hovered or selected.
export function updateLandmarkHover(landmarks, activeKeys, dt) {
  const ease = 1 - Math.exp(-dt * 12);
  for (const key in landmarks) {
    const landmark = landmarks[key];
    const target = activeKeys.has(key) ? 1 : 0;
    if (Math.abs(target - landmark.hover) < 0.001) continue;
    landmark.hover += (target - landmark.hover) * ease;
    landmark.model.scale.copy(landmark.baseScale).multiplyScalar(1 + landmark.hover * 0.09);
  }
}
