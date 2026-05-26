import { clamp } from "./utils.js";

function isSceneUi(target) {
  return target.closest(".scene-label, .scene-card, .site-header, a, button");
}

export function createAnchorPicker(THREE, { canvas, camera, interactiveObjects }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  return function pickAnchorKey(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactiveObjects, true)[0];
    return hit?.object.userData.anchorKey || null;
  };
}

export function createSceneCardController({ heroShell, sceneLabels, sceneCard, anchors }) {
  function selectLabel(key) {
    sceneLabels.forEach((label) => {
      label.classList.toggle("is-selected", label.dataset.anchor === key);
    });
  }

  function positionCard(event, fallbackLabel) {
    if (!sceneCard) return;
    const shellRect = heroShell.getBoundingClientRect();
    const cardRect = sceneCard.getBoundingClientRect();
    const sourceRect = fallbackLabel?.getBoundingClientRect();
    const sourceX = event?.clientX ?? (sourceRect ? sourceRect.left + sourceRect.width / 2 : shellRect.width / 2);
    const sourceY = event?.clientY ?? (sourceRect ? sourceRect.top + sourceRect.height / 2 : shellRect.height / 2);
    const x = clamp(sourceX - shellRect.left + 18, 18, shellRect.width - cardRect.width - 18);
    const y = clamp(sourceY - shellRect.top + 18, 84, shellRect.height - cardRect.height - 18);
    sceneCard.style.left = `${x}px`;
    sceneCard.style.top = `${y}px`;
  }

  function show(key, event, label) {
    const anchor = anchors[key];
    if (!sceneCard || !anchor?.title) return;
    const link = anchor.href ? `<a class="scene-card-link" href="${anchor.href}">Open page</a>` : "";
    sceneCard.innerHTML = `
      <p class="panel-kicker">${anchor.kicker || "Preview"}</p>
      <h2>${anchor.title}</h2>
      <p>${anchor.text}</p>
      ${link}
    `;
    positionCard(event, label);
    selectLabel(key);
    sceneCard.classList.add("is-visible");
  }

  function hide() {
    if (!sceneCard) return;
    sceneCard.classList.remove("is-visible");
    selectLabel(null);
  }

  function bindLabels() {
    sceneLabels.forEach((label) => {
      const key = label.dataset.anchor;
      const anchor = anchors[key];
      if (!anchor) return;

      label.addEventListener("mouseenter", (event) => show(key, event, label));
      label.addEventListener("mousemove", (event) => positionCard(event, label));
      label.addEventListener("focus", () => show(key, null, label));
      label.addEventListener("mouseleave", hide);
      label.addEventListener("blur", hide);
      label.addEventListener("click", (event) => {
        if (anchor.href) {
          window.location.href = anchor.href;
          return;
        }
        show(key, event, label);
      });
    });
  }

  return { bindLabels, hide, show };
}

export function createLabelProjector(THREE, { heroShell, sceneLabels, anchors, world, camera, occluder }) {
  const raycaster = new THREE.Raycaster();

  return function updateLabels() {
    const rect = heroShell.getBoundingClientRect();
    world.updateMatrixWorld();
    camera.updateMatrixWorld();
    sceneLabels.forEach((label) => {
      const anchor = anchors[label.dataset.anchor];
      if (!anchor) return;
      const worldPoint = anchor.point.clone().applyMatrix4(world.matrixWorld);
      const distanceToAnchor = camera.position.distanceTo(worldPoint);
      raycaster.set(camera.position, worldPoint.clone().sub(camera.position).normalize());
      const islandHit = raycaster.intersectObject(occluder, false)[0];
      if (islandHit && islandHit.distance < distanceToAnchor - 0.18) {
        label.classList.add("is-hidden");
        return;
      }
      const point = worldPoint.project(camera);
      if (point.z < -1 || point.z > 1) {
        label.classList.add("is-hidden");
        return;
      }
      label.style.left = `${((point.x + 1) * 0.5 * rect.width).toFixed(1)}px`;
      label.style.top = `${((-point.y + 1) * 0.5 * rect.height).toFixed(1)}px`;
      label.style.transform = "translate(-50%, -110%)";
      label.classList.remove("is-hidden");
    });
  };
}

export function createIslandControls({
  heroShell,
  camera,
  cameraTarget,
  cameraDesign,
  anchors,
  pickAnchorKey,
  cardController
}) {
  let isDragging = false;
  let activePointer = null;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let targetDistance = cameraDesign.distance.initial;
  let yaw = 0;
  let pitch = 0;
  let distance = targetDistance;

  heroShell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || isSceneUi(event.target)) return;
    isDragging = true;
    activePointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDistance = 0;
    heroShell.classList.add("is-orbiting");
    heroShell.setPointerCapture(event.pointerId);
  });

  heroShell.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      if (isSceneUi(event.target)) return;
      const key = pickAnchorKey(event);
      if (key) cardController.show(key, event, null);
      else cardController.hide();
      return;
    }
    if (event.pointerId !== activePointer) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    targetYaw += dx * 0.0065;
    targetPitch = clamp(targetPitch + dy * 0.0038, cameraDesign.pitch.min, cameraDesign.pitch.max);
  });

  function endDrag(event) {
    if (!isDragging || event.pointerId !== activePointer) return;
    isDragging = false;
    activePointer = null;
    heroShell.classList.remove("is-orbiting");
  }

  heroShell.addEventListener("pointerup", endDrag);
  heroShell.addEventListener("pointercancel", endDrag);
  heroShell.addEventListener("click", (event) => {
    if (dragDistance > 6 || isSceneUi(event.target)) return;
    const key = pickAnchorKey(event);
    if (!key) return;
    const anchor = anchors[key];
    if (anchor?.href) {
      window.location.href = anchor.href;
      return;
    }
    cardController.show(key, event, null);
  });
  heroShell.addEventListener("wheel", (event) => {
    event.preventDefault();
    targetDistance = clamp(
      targetDistance + event.deltaY * 0.0035,
      cameraDesign.distance.min,
      cameraDesign.distance.max
    );
  }, { passive: false });

  return function updateCamera() {
    yaw += (targetYaw - yaw) * 0.12;
    pitch += (targetPitch - pitch) * 0.12;
    distance += (targetDistance - distance) * 0.14;
    camera.position.set(
      cameraTarget.x + Math.sin(yaw) * distance,
      1.33 + distance * 0.13 + pitch * 4.2,
      cameraTarget.z + Math.cos(yaw) * distance
    );
    camera.lookAt(cameraTarget);
  };
}
