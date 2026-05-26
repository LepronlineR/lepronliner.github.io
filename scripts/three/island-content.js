import { DECORATIVE_MARKERS, ISLAND_LINKS } from "./scene-design.js";
import { placeModel } from "./models.js";

export function createIslandAnchors(surfacePoint) {
  return Object.fromEntries(ISLAND_LINKS.map((link) => [
    link.key,
    {
      ...link.card,
      point: surfacePoint(...link.surface)
    }
  ]));
}

function registerInteractiveObject(model, key, interactiveObjects) {
  model.userData.anchorKey = key;
  model.traverse((child) => {
    child.userData.anchorKey = key;
  });
  interactiveObjects.push(model);
  return model;
}

function addMarker({ THREE, world, models, surfacePoint, marker }) {
  const model = placeModel(
    THREE,
    world,
    models,
    marker.model,
    surfacePoint(...marker.surface),
    marker.scale,
    marker.rotation
  );
  if (marker.yScale) model.scale.y *= marker.yScale;
  return model;
}

export function addIslandMarkers({ THREE, world, models, surfacePoint }) {
  const interactiveObjects = [];

  ISLAND_LINKS.forEach((link) => {
    registerInteractiveObject(
      addMarker({ THREE, world, models, surfacePoint, marker: link.marker }),
      link.key,
      interactiveObjects
    );
  });

  DECORATIVE_MARKERS.forEach((marker) => {
    addMarker({ THREE, world, models, surfacePoint, marker });
  });

  return interactiveObjects;
}
