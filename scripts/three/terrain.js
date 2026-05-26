import { clamp } from "./utils.js";

function randomBetween([min, max]) {
  return min + Math.random() * (max - min);
}

function hsl({ hue, saturation, lightness, alpha = 1 }) {
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

export function islandHeight(x, z) {
  const radius = Math.sqrt((x / 3.8) ** 2 + (z / 2.55) ** 2);
  const coast = clamp(1 - radius, 0, 1);
  const plateau = Math.pow(coast, 0.5) * 0.42;
  const hills =
    Math.exp(-((x + 0.4) ** 2 * 0.65 + (z - 0.08) ** 2 * 0.58)) * 0.2 +
    Math.exp(-((x - 0.9) ** 2 * 0.92 + (z + 0.32) ** 2 * 0.72)) * 0.24;
  const roughness = (Math.sin(x * 2.2 + z * 1.2) + Math.cos(z * 2.4 - x * 0.8)) * 0.016;
  return coast <= 0 ? -0.2 : plateau + hills * coast + roughness * coast - 0.08;
}

export function makeSurfacePoint(THREE) {
  return function surfacePoint(x, z, lift = 0) {
    return new THREE.Vector3(x, islandHeight(x, z) + lift, z);
  };
}

export function makeIslandTexture(THREE, palette) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 96;
  textureCanvas.height = 96;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = palette.textureBase;
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

  for (let i = 0; i < 34; i += 1) {
    context.fillStyle = hsl({
      hue: randomBetween(palette.texturePatch.hue),
      saturation: palette.texturePatch.saturation,
      lightness: randomBetween(palette.texturePatch.lightness),
      alpha: palette.texturePatch.alpha
    });
    context.beginPath();
    const x = Math.random() * textureCanvas.width;
    const y = Math.random() * textureCanvas.height;
    const r = 8 + Math.random() * 26;
    context.moveTo(x + r, y);
    for (let side = 1; side < 6; side += 1) {
      const angle = (side / 6) * Math.PI * 2;
      context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    context.closePath();
    context.fill();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.8, 1.3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function islandColorAt(THREE, palette, edgeT, heightT) {
  const sand = new THREE.Color(palette.sand);
  const grass = new THREE.Color(palette.grass);
  const rock = new THREE.Color(palette.rock);
  const waterline = new THREE.Color(palette.waterline);

  if (edgeT > 0.86) return waterline.lerp(sand, (1 - edgeT) / 0.14);
  if (heightT < 0.48) return sand.lerp(grass, heightT / 0.48);
  return grass.lerp(rock, (heightT - 0.48) / 0.52);
}

export function buildIsland(THREE, {
  radiusX,
  radiusZ,
  rings,
  segments,
  bottomY = -0.48,
  material,
  palette
}) {
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const cliff = new THREE.Color(palette.cliff);

  function pushVertex(x, y, z, u, v, color) {
    positions.push(x, y, z);
    uvs.push(u, v);
    colors.push(color.r, color.g, color.b);
  }

  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radiusX * t;
      const z = Math.sin(angle) * radiusZ * t;
      const y = islandHeight(x, z);
      const heightT = clamp((y + 0.05) / 1.1, 0, 1);
      pushVertex(
        x,
        y,
        z,
        (Math.cos(angle) * t + 1) * 0.5,
        (Math.sin(angle) * t + 1) * 0.5,
        islandColorAt(THREE, palette, t, heightT)
      );
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + segment;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, d, a, d, b);
    }
  }

  const bottomStart = positions.length / 3;
  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;
    pushVertex(x, bottomY, z, (Math.cos(angle) + 1) * 0.5, (Math.sin(angle) + 1) * 0.5, cliff);
  }

  const bottomCenter = positions.length / 3;
  pushVertex(0, bottomY, 0, 0.5, 0.5, cliff);

  const outerStart = rings * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const topA = outerStart + segment;
    const topB = outerStart + next;
    const bottomA = bottomStart + segment;
    const bottomB = bottomStart + next;
    indices.push(topA, bottomA, bottomB, topA, bottomB, topB);
    indices.push(bottomCenter, bottomB, bottomA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function buildOceanDisk(THREE, radius, rings, segments) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius * t;
      const y = Math.sin(angle) * radius * t;
      positions.push(x, y, 0);
      uvs.push((Math.cos(angle) * t + 1) * 0.5, (Math.sin(angle) * t + 1) * 0.5);
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + segment;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, d, a, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
