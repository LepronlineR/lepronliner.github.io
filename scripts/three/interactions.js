import { clamp } from "./utils.js";

const TAU = Math.PI * 2;

function isSceneUi(target) {
  return Boolean(target.closest?.("a, button, .scene-card, .scene-dock, .site-header"));
}

// The equivalent of `to` that is closest to `from`, so the camera takes the short way round.
function nearestAngle(from, to) {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return from + delta;
}

export function createPicker(THREE, { shell, camera, hitTargets }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  return function pick(clientX, clientY) {
    const rect = shell.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(hitTargets, false)[0]?.object.userData.key || null;
  };
}

/*
  Orbit camera with eased motion, release inertia, an idle spin, and "focus" moves that
  fly round to face a landmark. In preview mode it never captures scroll or zoom.
*/
export function createControls({ THREE, shell, camera, cameraTarget, design, full, reducedMotion, onInput, onMove, onTap, onHover }) {
  const state = {
    yaw: reducedMotion ? 0 : -0.75,
    pitch: design.pitch.initial,
    distance: reducedMotion ? design.distance.initial : design.distance.intro,
    targetYaw: 0,
    targetPitch: design.pitch.initial,
    targetDistance: design.distance.initial,
    look: cameraTarget.clone(),
    targetLook: cameraTarget.clone(),
    spin: 0,
    distanceScale: 1,
    lastInput: -Infinity,
    startedAt: null,
    focused: false
  };
  const pointers = new Map();
  let dragDistance = 0;
  let pinchSpan = 0;
  let lastMoveTime = 0;
  let touched = false;

  function markInput() {
    state.lastInput = performance.now() / 1000;
    if (touched) return;
    touched = true;
    onInput?.();
  }

  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  shell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || isSceneUi(event.target)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) dragDistance = 0;
    if (pointers.size === 2) pinchSpan = pinchDistance();
    state.spin = 0;
    lastMoveTime = performance.now();
    shell.classList.add("is-orbiting");
    shell.setPointerCapture?.(event.pointerId);
  });

  shell.addEventListener("pointermove", (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) {
      if (event.pointerType === "mouse") onHover?.(isSceneUi(event.target) ? null : event);
      return;
    }

    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (pointers.size === 2 && full) {
      const span = pinchDistance();
      if (pinchSpan > 0 && span > 0) {
        state.targetDistance = clamp(state.targetDistance * (pinchSpan / span), design.distance.min, design.distance.max);
      }
      pinchSpan = span;
      dragDistance += 10;
      markInput();
      onMove?.();
      return;
    }

    dragDistance += Math.abs(dx) + Math.abs(dy);
    if (dragDistance < 4) return;

    const now = performance.now();
    const elapsed = Math.max(now - lastMoveTime, 1) / 1000;
    lastMoveTime = now;
    const yawDelta = dx * 0.0065;
    state.targetYaw += yawDelta;
    state.spin = clamp(yawDelta / elapsed, -3, 3);
    state.targetPitch = clamp(state.targetPitch + dy * 0.0038, design.pitch.min, design.pitch.max);
    markInput();
    onMove?.();
  });

  function endPointer(event) {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size > 0) return;
    shell.classList.remove("is-orbiting");
    // A drag that paused before release should not fling the camera.
    if (performance.now() - lastMoveTime > 90) state.spin = 0;
    if (event.type === "pointerup" && dragDistance < 6) {
      state.spin = 0;
      markInput();
      onTap?.(event);
    }
  }

  shell.addEventListener("pointerup", endPointer);
  shell.addEventListener("pointercancel", endPointer);
  shell.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && !pointers.size) onHover?.(null);
  });

  if (full) {
    shell.addEventListener("wheel", (event) => {
      if (event.target.closest?.(".scene-card")) return;
      event.preventDefault();
      state.targetDistance = clamp(
        state.targetDistance + event.deltaY * 0.0035,
        design.distance.min,
        design.distance.max
      );
      markInput();
      onMove?.();
    }, { passive: false });
  }

  // Fly round to face a world-space point, or pass null to pull back to the overview.
  function focus(point) {
    state.spin = 0;
    state.focused = Boolean(point);
    state.lastInput = performance.now() / 1000;
    if (!point) {
      state.targetLook.copy(cameraTarget);
      state.targetDistance = design.distance.initial;
      return;
    }
    const facing = Math.atan2(point.x - cameraTarget.x, point.z - cameraTarget.z);
    // Blend toward the landmark's side rather than snapping fully behind it.
    const blended = nearestAngle(0, facing) * 0.55;
    state.targetYaw = nearestAngle(state.targetYaw, blended);
    state.targetPitch = design.pitch.initial;
    state.targetDistance = design.distance.focus;
    state.targetLook.copy(cameraTarget).lerp(point, 0.8);
    state.targetLook.y = cameraTarget.y;
  }

  // Drops the landmark focus but leaves the camera where the visitor has put it.
  function release() {
    state.focused = false;
    state.lastInput = performance.now() / 1000;
  }

  function nudgeZoom(amount) {
    state.targetDistance = clamp(state.targetDistance + amount, design.distance.min, design.distance.max);
    markInput();
    onMove?.();
  }

  function setDistanceScale(scale) {
    state.distanceScale = scale;
  }

  // Advances the camera. Returns true when it actually moved this frame.
  function update(now, dt) {
    if (state.startedAt === null) state.startedAt = now;
    const dragging = pointers.size > 0;
    const inIntro = !touched && !state.focused && now - state.startedAt < 2.6;

    if (!dragging) {
      if (Math.abs(state.spin) > 0.002) {
        state.targetYaw += state.spin * dt;
        state.spin *= Math.exp(-dt * 3.2);
      } else if (!reducedMotion && !state.focused && now - state.lastInput > design.idle.delay) {
        state.targetYaw += design.idle.speed * dt;
      }
    }

    const ease = 1 - Math.exp(-dt * (inIntro ? 2.2 : 7.5));
    const before = state.yaw + state.pitch * 3 + state.distance + state.look.x + state.look.z;
    state.yaw += (state.targetYaw - state.yaw) * ease;
    state.pitch += (state.targetPitch - state.pitch) * ease;
    state.distance += (state.targetDistance - state.distance) * ease;
    state.look.lerp(state.targetLook, ease);
    const after = state.yaw + state.pitch * 3 + state.distance + state.look.x + state.look.z;

    const distance = state.distance * state.distanceScale;
    camera.position.set(
      state.look.x + Math.sin(state.yaw) * distance,
      1.33 + distance * 0.13 + state.pitch * 4.2,
      state.look.z + Math.cos(state.yaw) * distance
    );
    camera.lookAt(state.look);
    return Math.abs(after - before) > 0.00002;
  }

  return { update, focus, release, nudgeZoom, setDistanceScale };
}

/*
  Positions the HTML labels over their landmarks. It only runs on frames where the camera
  moved, writes transforms (no layout), and reuses its vectors.
*/
export function createLabelProjector(THREE, { labelEls, landmarks, camera, occluder }) {
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const size = { width: 1, height: 1 };

  function setSize(width, height) {
    size.width = width;
    size.height = height;
  }

  function update() {
    camera.updateMatrixWorld();
    for (const key in labelEls) {
      const label = labelEls[key];
      const point = landmarks[key].labelPoint;
      const distance = camera.position.distanceTo(point);
      direction.copy(point).sub(camera.position).normalize();
      raycaster.set(camera.position, direction);
      const blocker = raycaster.intersectObject(occluder, false)[0];
      projected.copy(point).project(camera);
      const hidden = (blocker && blocker.distance < distance - 0.18) || projected.z < -1 || projected.z > 1;
      label.classList.toggle("is-hidden", Boolean(hidden));
      if (hidden) continue;
      const x = (projected.x + 1) * 0.5 * size.width;
      const y = (1 - projected.y) * 0.5 * size.height;
      label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  }

  return { update, setSize };
}

export function createLabels({ layer, landmarks }) {
  const labelEls = {};
  for (const key in landmarks) {
    const landmark = landmarks[key];
    const label = document.createElement("a");
    label.className = "scene-label is-hidden";
    label.href = landmark.href;
    label.dataset.anchor = key;
    label.textContent = landmark.label;
    layer.append(label);
    labelEls[key] = label;
  }
  return labelEls;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/*
  Selection UI for the full page: the info card, the dock chips, labels, and keyboard.
  Picking a landmark shows what is inside it; picking it again (or its button) goes there.
*/
export function createSceneUi({ shell, labelEls, landmarks, onSelect }) {
  const card = shell.querySelector(".scene-card");
  const chips = [...shell.querySelectorAll(".scene-chip")];
  const keys = Object.keys(landmarks);
  let selected = null;

  function renderCard() {
    if (!card) return;
    const landmark = landmarks[selected];
    card.hidden = !landmark;
    card.replaceChildren();
    if (!landmark) return;

    const close = element("button", "scene-card-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => select(null));

    const list = element("ul", "scene-card-list");
    (landmark.items || []).slice(0, 3).forEach((item) => {
      const link = element("a", "", item.title);
      link.href = item.url;
      const row = element("li");
      row.append(link);
      list.append(row);
    });

    const cta = element("a", "button", landmark.cta || "Open");
    cta.href = landmark.href;
    const arrow = element("span", "arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    cta.append(" ", arrow);

    card.append(
      close,
      element("p", "panel-kicker", landmark.kicker),
      element("h2", "", landmark.title),
      element("p", "", landmark.text)
    );
    if (list.children.length) card.append(list);
    card.append(cta);
    // Restart the entrance animation when switching between landmarks.
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
  }

  function select(key) {
    selected = landmarks[key] ? key : null;
    shell.classList.toggle("has-selection", Boolean(selected));
    chips.forEach((chip) => {
      const active = chip.dataset.anchor === selected;
      chip.classList.toggle("is-selected", active);
      if (active) chip.setAttribute("aria-current", "true");
      else chip.removeAttribute("aria-current");
    });
    for (const labelKey in labelEls) {
      labelEls[labelKey].classList.toggle("is-selected", labelKey === selected);
    }
    renderCard();
    onSelect?.(selected);
  }

  // First activation selects; activating the selected landmark again follows its link.
  function activate(key) {
    if (!key) {
      select(null);
      return;
    }
    if (key === selected) {
      window.location.assign(landmarks[key].href);
      return;
    }
    select(key);
  }

  function step(offset) {
    const current = selected ? keys.indexOf(selected) : offset > 0 ? -1 : 0;
    select(keys[(current + offset + keys.length) % keys.length]);
  }

  [...chips, ...Object.values(labelEls)].forEach((control) => {
    control.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      activate(control.dataset.anchor);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Escape") select(null);
    else if (event.key === "ArrowRight") step(1);
    else if (event.key === "ArrowLeft") step(-1);
    else if (event.key >= "1" && event.key <= String(keys.length)) select(keys[Number(event.key) - 1]);
    else return;
    event.preventDefault();
  });

  // Fill the project and blog cards with the real, current entries.
  async function loadItems() {
    await Promise.all(keys.map(async (key) => {
      const landmark = landmarks[key];
      if (!landmark.itemsFrom) return;
      try {
        const response = await fetch(landmark.itemsFrom);
        if (!response.ok) return;
        const entries = await response.json();
        landmark.items = entries.slice(0, 3).map((entry) => ({ title: entry.title, url: entry.url }));
        if (selected === key) renderCard();
      } catch {
        // The card still works without the list.
      }
    }));
  }

  loadItems();
  return { activate, select, get selected() { return selected; } };
}
