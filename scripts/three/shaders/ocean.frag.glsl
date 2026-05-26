precision highp float;

uniform float uTime;
uniform vec3 uBaseNear;
uniform vec3 uBaseFar;
uniform vec3 uLine;
uniform vec3 uLineCore;
uniform vec3 uShadowLine;
uniform vec3 uHorizonMix;
varying vec2 vPlane;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amplitude;
    p = mat2(1.62, 1.08, -1.08, 1.62) * p + 17.13;
    amplitude *= 0.5;
  }
  return value;
}

float contourRibbon(vec2 p) {
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
  float band = abs(fract(field * density) - 0.5);
  return 1.0 - smoothstep(0.045, 0.09, band);
}

float horseshoe(vec2 p, vec2 center, float radius, float phase) {
  vec2 d = p - center;
  float dist = length(d);
  float angle = atan(d.y, d.x);
  float gap = smoothstep(0.1, 0.5, abs(sin(angle * 0.5 + phase)));
  float ring = 1.0 - smoothstep(0.08, 0.18, abs(dist - radius));
  return ring * gap;
}

void main() {
  float dist = length(vPlane);
  float horizon = smoothstep(16.0, 50.0, dist);
  vec3 color = mix(uBaseNear, uBaseFar, horizon * 0.48);
  vec2 p = vPlane * 0.92;
  float ribbon = contourRibbon(p);
  float ribbonCore = contourRibbon(p + vec2(0.18, -0.11));
  float eddies =
    horseshoe(p, vec2(-8.0, -4.2), 4.8, 0.2 + uTime * 0.025) +
    horseshoe(p, vec2(7.2, 4.0), 3.8, 1.4 - uTime * 0.018) +
    horseshoe(p, vec2(1.5, -10.5), 5.6, 2.1 + uTime * 0.015);
  float shadow = contourRibbon(p + vec2(0.36, 0.44));
  float combined = clamp(ribbon + eddies * 0.68, 0.0, 1.0);
  color = mix(color, uShadowLine, shadow * 0.26);
  color = mix(color, uLine, combined * 0.7);
  color = mix(color, uLineCore, ribbonCore * combined * 0.32);
  color = mix(color, uHorizonMix, horizon * 0.22);
  gl_FragColor = vec4(color, 1.0);
}
