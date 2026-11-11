import { SCENE_THEMES } from "./scene-design.js";

/*
  Switches the scene between its night ("dark") and day ("light") looks. Everything that
  differs between the two is data in SCENE_THEMES; the sky itself is a CSS background
  behind the transparent canvas, so it follows the page theme on its own.
*/
export function createSceneTheme({ lights, ocean, stars, hazes, materials }) {
  return function applyTheme(name) {
    const theme = SCENE_THEMES[name] || SCENE_THEMES.dark;

    lights.ambient.color.set(theme.lighting.ambient);
    lights.ambient.intensity = theme.lighting.ambientIntensity;
    lights.key.color.set(theme.lighting.key);
    lights.key.intensity = theme.lighting.keyIntensity;
    lights.glow.color.set(theme.lighting.glow);
    lights.glow.intensity = theme.lighting.glowIntensity;

    const { uniforms } = ocean;
    uniforms.uBaseNear.value.set(theme.ocean.baseNear);
    uniforms.uBaseFar.value.set(theme.ocean.baseFar);
    uniforms.uLine.value.set(theme.ocean.ribbon);
    uniforms.uLineCore.value.set(theme.ocean.ribbonCore);
    uniforms.uShadowLine.value.set(theme.ocean.shadowRibbon);
    uniforms.uFoam.value.set(theme.ocean.foam);
    uniforms.uHorizonMix.value.set(...theme.ocean.horizonMix);

    stars.visible = theme.stars;
    for (const key in hazes) hazes[key].visible = key === (SCENE_THEMES[name] ? name : "dark");
    for (const key in theme.tints) materials[key]?.color.set(theme.tints[key]);
  };
}

// Follows the site's theme toggle, which sets data-theme on <html>.
export function followPageTheme(applyTheme) {
  const root = document.documentElement;
  const read = () => (root.dataset.theme === "light" ? "light" : "dark");
  applyTheme(read());
  new MutationObserver(() => applyTheme(read())).observe(root, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });
}
