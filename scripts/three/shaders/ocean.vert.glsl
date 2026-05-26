varying vec2 vPlane;

void main() {
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
