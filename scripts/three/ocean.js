import { buildOceanDisk } from "./terrain.js";

// The swell is displaced on the GPU. Doing it in JS meant rewriting every vertex and
// recomputing normals each frame, for normals the shader never used.
const vertexShader = /* glsl */ `
uniform float uTime;
varying vec2 vPlane;

void main() {
  vPlane = position.xy;
  float radius = length(position.xy);
  float horizon = clamp((radius - 16.0) / 34.0, 0.0, 1.0);
  float curve = -pow(horizon, 2.4) * 2.8;
  float wave =
    sin(radius * 0.56 - uTime * 0.12) * 0.14 +
    cos(position.x * 0.2 + position.y * 0.31 + uTime * 0.1) * 0.06 +
    sin((position.x - position.y) * 0.13 + uTime * 0.08) * 0.04;
  vec3 displaced = position;
  displaced.z += curve + wave * (1.0 - horizon * 0.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

// One evaluation of the contour field feeds the ribbon, its bright core, and its shadow.
// The previous version evaluated the whole field three times per pixel.
const fragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uBaseNear;
uniform vec3 uBaseFar;
uniform vec3 uLine;
uniform vec3 uLineCore;
uniform vec3 uShadowLine;
uniform vec3 uFoam;
uniform vec3 uHorizonMix;
uniform vec3 uIsland; // radiusX, radiusZ, rotationY
varying vec2 vPlane;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += noise(p) * amplitude;
    p = mat2(1.62, 1.08, -1.08, 1.62) * p + 17.13;
    amplitude *= 0.5;
  }
  return value;
}

float contourField(vec2 p) {
  vec2 driftA = vec2(uTime * 0.012, sin(uTime * 0.09) * 0.18);
  vec2 driftB = vec2(cos(uTime * 0.07) * 0.16, -uTime * 0.009);
  vec2 warp = vec2(
    fbm(p * 0.12 + driftA),
    fbm(p * 0.11 + vec2(8.4, 3.1) + driftB)
  ) - 0.5;
  vec2 q = p + warp * 7.5;
  float field = fbm(q * 0.105 + vec2(sin(uTime * 0.05), cos(uTime * 0.04)) * 0.22) * 2.8;
  field += sin(q.x * 0.18 + fbm(q * 0.075 + 4.7) * 6.2) * 0.42;
  field += cos(q.y * 0.16 + fbm(q * 0.085 + 11.3) * 5.0) * 0.34;
  float density = 2.0 + fbm(q * 0.055 + 2.2) * 1.45;
  return field * density;
}

float bandAt(float field, float offset) {
  return abs(fract(field + offset) - 0.5);
}

float horseshoe(vec2 p, vec2 center, float radius, float phase) {
  vec2 d = p - center;
  float dist = length(d);
  float angle = atan(d.y, d.x);
  float gap = smoothstep(0.1, 0.5, abs(sin(angle * 0.5 + phase)));
  float ring = 1.0 - smoothstep(0.08, 0.18, abs(dist - radius));
  return ring * gap;
}

float shoreFoam(vec2 plane) {
  // Ocean plane (x, y) maps to world (x, -y); undo the island's yaw to get its local ellipse.
  vec2 world = vec2(plane.x, -plane.y);
  float c = cos(uIsland.z);
  float s = sin(uIsland.z);
  vec2 local = vec2(world.x * c - world.y * s, world.x * s + world.y * c);
  float e = length(local / uIsland.xy);
  float reach = 1.0 - smoothstep(1.0, 1.3, e);
  float rings = 0.5 + 0.5 * sin(e * 30.0 - uTime * 0.9);
  float wobble = noise(local * 2.4 + uTime * 0.15);
  return reach * smoothstep(0.55, 0.95, rings * 0.7 + wobble * 0.5) * step(0.9, e);
}

void main() {
  float dist = length(vPlane);
  float horizon = smoothstep(16.0, 50.0, dist);
  vec3 color = mix(uBaseNear, uBaseFar, horizon * 0.48);
  vec2 p = vPlane * 0.92;

  float field = contourField(p);
  float band = bandAt(field, 0.0);
  float ribbon = 1.0 - smoothstep(0.045, 0.09, band);
  float ribbonCore = 1.0 - smoothstep(0.0, 0.04, band);
  float shadow = 1.0 - smoothstep(0.045, 0.09, bandAt(field, 0.16));

  float eddies =
    horseshoe(p, vec2(-8.0, -4.2), 4.8, 0.2 + uTime * 0.025) +
    horseshoe(p, vec2(7.2, 4.0), 3.8, 1.4 - uTime * 0.018) +
    horseshoe(p, vec2(1.5, -10.5), 5.6, 2.1 + uTime * 0.015);
  float combined = clamp(ribbon + eddies * 0.68, 0.0, 1.0);

  color = mix(color, uShadowLine, shadow * 0.26);
  color = mix(color, uLine, combined * 0.7);
  color = mix(color, uLineCore, ribbonCore * combined * 0.32);
  color = mix(color, uFoam, shoreFoam(vPlane) * 0.38);
  color = mix(color, uHorizonMix, horizon * 0.22);
  gl_FragColor = vec4(color, 1.0);
}
`;

export function createOcean(THREE, { design, colors, island }) {
  const geometry = buildOceanDisk(THREE, design.radius, design.rings, design.segments);
  const uniforms = {
    uTime: { value: 0 },
    uBaseNear: { value: new THREE.Color(colors.baseNear) },
    uBaseFar: { value: new THREE.Color(colors.baseFar) },
    uLine: { value: new THREE.Color(colors.ribbon) },
    uLineCore: { value: new THREE.Color(colors.ribbonCore) },
    uShadowLine: { value: new THREE.Color(colors.shadowRibbon) },
    uFoam: { value: new THREE.Color(colors.foam) },
    uHorizonMix: { value: new THREE.Vector3(...colors.horizonMix) },
    uIsland: { value: new THREE.Vector3(island.radiusX, island.radiusZ, island.rotationY) }
  };

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = design.y;
  mesh.renderOrder = -1;
  // The vertex shader moves vertices, so the default bounding sphere is not exact.
  mesh.frustumCulled = false;

  return { mesh, uniforms };
}
