import { startIslandScene } from "./three/island-scene.js?v=projects-1";

const canvas = document.querySelector("#mountain-canvas");
const heroShell = document.querySelector(".hero-shell");
const sceneLabels = document.querySelectorAll(".scene-label");
const sceneCard = document.querySelector("#scene-card");

startIslandScene({
  canvas,
  heroShell,
  sceneLabels,
  sceneCard
});
