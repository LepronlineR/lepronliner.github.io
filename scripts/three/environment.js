function randomBetween([min, max]) {
  return min + Math.random() * (max - min);
}

export function createStarField(THREE, starColors) {
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  const radius = 620;

  for (let i = 0; i < 1600; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const y = -0.14 + Math.random() * 0.98;
    const ring = Math.sqrt(1 - y * y);
    positions.push(
      Math.cos(theta) * ring * radius,
      y * radius,
      Math.sin(theta) * ring * radius
    );
    color.setHSL(randomBetween(starColors.hue), starColors.saturation, randomBetween(starColors.lightness));
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 2.35,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      depthWrite: false
    })
  );
  stars.renderOrder = -20;
  return stars;
}

export function addSceneLighting(THREE, scene, lighting) {
  scene.add(new THREE.AmbientLight(lighting.ambient, 2.15));
  const keyLight = new THREE.DirectionalLight(lighting.key, 0.88);
  keyLight.position.set(-3.8, 5.8, 4.2);
  scene.add(keyLight);
}

export function createHorizonHaze(THREE, hazeColors) {
  const hazeCanvas = document.createElement("canvas");
  hazeCanvas.width = 16;
  hazeCanvas.height = 256;
  const context = hazeCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, hazeCanvas.height);
  gradient.addColorStop(0, hazeColors.top);
  gradient.addColorStop(0.42, hazeColors.center);
  gradient.addColorStop(0.72, hazeColors.lower);
  gradient.addColorStop(1, hazeColors.bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, hazeCanvas.width, hazeCanvas.height);

  const texture = new THREE.CanvasTexture(hazeCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(34, 34, 7.2, 128, 1, true),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  haze.position.y = 1.75;
  haze.renderOrder = 2;
  return haze;
}
