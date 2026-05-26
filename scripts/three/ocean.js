import { loadShaderPair } from "./shader-loader.js";
import { buildOceanDisk } from "./terrain.js";
import { clamp } from "./utils.js";

function sceneColor(THREE, color) {
  return new THREE.Color(color);
}

export async function createOcean(THREE, { design, colors }) {
  const geometry = buildOceanDisk(THREE, design.radius, design.rings, design.segments);
  const positions = geometry.attributes.position;
  const basePositions = new Float32Array(positions.array);
  const { vertexShader, fragmentShader } = await loadShaderPair(design.shaders);
  const uniforms = {
    uTime: { value: 0 },
    uBaseNear: { value: sceneColor(THREE, colors.baseNear) },
    uBaseFar: { value: sceneColor(THREE, colors.baseFar) },
    uLine: { value: sceneColor(THREE, colors.ribbon) },
    uLineCore: { value: sceneColor(THREE, colors.ribbonCore) },
    uShadowLine: { value: sceneColor(THREE, colors.shadowRibbon) },
    uHorizonMix: { value: new THREE.Vector3(...colors.horizonMix) }
  };

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      fog: false,
      depthWrite: true
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = design.y;
  mesh.renderOrder = -1;

  return { mesh, geometry, positions, basePositions, uniforms };
}

export function updateOceanSurface(ocean, seconds) {
  for (let i = 0; i < ocean.positions.count; i += 1) {
    const x = ocean.basePositions[i * 3];
    const y = ocean.basePositions[i * 3 + 1];
    const radius = Math.sqrt(x * x + y * y);
    const horizon = clamp((radius - 16) / 34, 0, 1);
    const curve = -Math.pow(horizon, 2.4) * 2.8;
    const wave =
      Math.sin(radius * 0.56 - seconds * 0.12) * 0.14 +
      Math.cos(x * 0.2 + y * 0.31 + seconds * 0.1) * 0.06 +
      Math.sin((x - y) * 0.13 + seconds * 0.08) * 0.04;
    ocean.positions.setZ(i, ocean.basePositions[i * 3 + 2] + curve + wave * (1 - horizon * 0.5));
  }

  ocean.positions.needsUpdate = true;
  ocean.geometry.computeVertexNormals();
  ocean.uniforms.uTime.value = seconds;
}
