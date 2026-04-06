import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const canvas = document.getElementById("stage");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const overlayStart = document.getElementById("overlayStart");
const overlayEnd = document.getElementById("overlayEnd");
const endTitle = document.getElementById("endTitle");
const endSummary = document.getElementById("endSummary");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const timeEl = document.getElementById("time");
const streakEl = document.getElementById("streak");
const energyBarEl = document.getElementById("energyBar");
const energyValueEl = document.getElementById("energyValue");
const toastEl = document.getElementById("toast");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06101b, 0.028);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 0.25, 8);

const clock = new THREE.Clock();

const world = new THREE.Group();
scene.add(world);

const coreRig = new THREE.Group();
world.add(coreRig);

const interactiveGroup = new THREE.Group();
coreRig.add(interactiveGroup);

const ambient = new THREE.AmbientLight(0xd9eeff, 0.78);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xe8f5ff, 2.2);
keyLight.position.set(5, 4, 6);
scene.add(keyLight);

const rimBlue = new THREE.PointLight(0x85dbff, 16, 26, 2);
rimBlue.position.set(0, 0.4, 0);
coreRig.add(rimBlue);

const rimLavender = new THREE.PointLight(0xb9c3ff, 7, 20, 2);
rimLavender.position.set(-2.2, 1.6, 3.2);
scene.add(rimLavender);

function createRadialTexture(innerColor, outerColor = "rgba(255,255,255,0)") {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, innerColor);
  g.addColorStop(0.35, innerColor);
  g.addColorStop(1, outerColor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const softGlowTexture = createRadialTexture("rgba(255,255,255,0.95)", "rgba(255,255,255,0)");
const blueGlowTexture = createRadialTexture("rgba(185,228,255,0.95)", "rgba(185,228,255,0)");
const goldGlowTexture = createRadialTexture("rgba(255,214,120,0.98)", "rgba(255,214,120,0)");

function createSprite(texture, scaleX, scaleY, opacity = 0.35, color = 0xffffff) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleX, scaleY, 1);
  return sprite;
}

const bgStarsCount = 1600;
const bgPositions = new Float32Array(bgStarsCount * 3);
const bgColors = new Float32Array(bgStarsCount * 3);
for (let i = 0; i < bgStarsCount; i += 1) {
  const i3 = i * 3;
  const radius = 14 + Math.random() * 20;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  bgPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
  bgPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  bgPositions[i3 + 2] = radius * Math.cos(phi);

  const t = Math.random();
  bgColors[i3] = 0.72 + t * 0.28;
  bgColors[i3 + 1] = 0.82 + t * 0.18;
  bgColors[i3 + 2] = 0.94 + t * 0.06;
}

const bgStarGeo = new THREE.BufferGeometry();
bgStarGeo.setAttribute("position", new THREE.BufferAttribute(bgPositions, 3));
bgStarGeo.setAttribute("color", new THREE.BufferAttribute(bgColors, 3));

const bgStars = new THREE.Points(
  bgStarGeo,
  new THREE.PointsMaterial({
    size: 0.045,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(bgStars);

const atmosphere = createSprite(blueGlowTexture, 13, 13, 0.15, 0xcfeeff);
atmosphere.position.set(0, 0.2, -2);
scene.add(atmosphere);

const backHalo = createSprite(softGlowTexture, 6.5, 6.5, 0.18, 0xe6f5ff);
backHalo.position.set(0, 0.1, -0.6);
coreRig.add(backHalo);

function createBeam(height, radiusTop, radiusBottom, color, opacity) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 18, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
}

const beamA = createBeam(12, 0.05, 0.36, 0xdff4ff, 0.06);
beamA.position.set(-1.15, 0, -0.8);
beamA.rotation.z = 0.42;
scene.add(beamA);

const beamB = createBeam(12, 0.05, 0.3, 0xbfe7ff, 0.05);
beamB.position.set(1.25, -0.2, -0.7);
beamB.rotation.z = -0.36;
scene.add(beamB);

const shellGeometry = new THREE.IcosahedronGeometry(1.08, 6);
const shellMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xe6f5ff,
  metalness: 0,
  roughness: 0.08,
  transmission: 1,
  transparent: true,
  opacity: 0.92,
  thickness: 1.0,
  ior: 1.16,
  reflectivity: 0.36,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  attenuationDistance: 3,
  attenuationColor: new THREE.Color(0xcfe7ff),
});
const shell = new THREE.Mesh(shellGeometry, shellMaterial);
coreRig.add(shell);

const shellWire = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.24, 4)),
  new THREE.LineBasicMaterial({
    color: 0xe9f7ff,
    transparent: true,
    opacity: 0.13,
  })
);
coreRig.add(shellWire);

const coreGeometry = new THREE.SphereGeometry(0.48, 42, 42);
const coreMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  emissive: 0xcfe8ff,
  emissiveIntensity: 1.8,
  roughness: 0.05,
  metalness: 0,
  transparent: true,
  opacity: 0.96,
});
const core = new THREE.Mesh(coreGeometry, coreMaterial);
coreRig.add(core);

const innerHalo = createSprite(softGlowTexture, 2.5, 2.5, 0.34, 0xf7fbff);
innerHalo.position.set(0, 0, 0.1);
coreRig.add(innerHalo);

const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xe8f6ff,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.025, 16, 160), ringMaterial.clone());
ringA.rotation.x = 1.22;
ringA.rotation.z = 0.2;
coreRig.add(ringA);

const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.88, 0.017, 16, 160), ringMaterial.clone());
ringB.material.opacity = 0.12;
ringB.rotation.x = -1.03;
ringB.rotation.y = 0.35;
coreRig.add(ringB);

const orbitLine = new THREE.Mesh(
  new THREE.TorusGeometry(3.35, 0.012, 10, 240),
  new THREE.MeshBasicMaterial({
    color: 0xbfdfff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
orbitLine.rotation.x = Math.PI / 2;
coreRig.add(orbitLine);

const dustCount = 420;
const dustPositions = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i += 1) {
  const i3 = i * 3;
  const radius = 1.8 + Math.random() * 3.8;
  const angle = Math.random() * Math.PI * 2;
  dustPositions[i3] = Math.cos(angle) * radius;
  dustPositions[i3 + 1] = (Math.random() - 0.5) * 1.2;
  dustPositions[i3 + 2] = Math.sin(angle) * radius;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    color: 0xdff3ff,
    size: 0.035,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
coreRig.add(dust);

const pulseRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.65, 0.02, 12, 120),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
pulseRing.rotation.x = Math.PI / 2;
coreRig.add(pulseRing);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };
const dragState = {
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
};

const state = {
  running: false,
  score: 0,
  combo: 1,
  streak: 0,
  energy: 0,
  timeLeft: 45,
  lastHitAt: 0,
  pulse: 0,
  pulseScale: 0,
  endLocked: false,
};

const fragments = [];
const hitTargets = [];
let fragmentId = 0;

function spawnFragment(isRare = false) {
  const container = new THREE.Group();
  container.userData.fragmentId = fragmentId++;
  container.userData.isRare = isRare;
  container.userData.value = isRare ? 16 : 8;
  container.userData.orbitRadius = (isRare ? 2.55 : 2.2) + Math.random() * 1.1;
  container.userData.orbitSpeed = (isRare ? 0.6 : 0.85) + Math.random() * 0.65;
  container.userData.orbitTilt = (Math.random() - 0.5) * 0.6;
  container.userData.orbitAngle = Math.random() * Math.PI * 2;
  container.userData.bob = Math.random() * Math.PI * 2;
  container.userData.respawnAt = 0;
  container.userData.active = true;

  const geometry = isRare
    ? new THREE.OctahedronGeometry(0.18, 0)
    : new THREE.IcosahedronGeometry(0.15 + Math.random() * 0.04, 0);

  const color = isRare ? 0xffdf8a : 0xf4fbff;
  const emissive = isRare ? 0xffc860 : 0xcfe9ff;

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: isRare ? 1.15 : 0.72,
      roughness: 0.08,
      metalness: 0.06,
      transmission: 0.75,
      transparent: true,
      opacity: 0.98,
      thickness: 0.4,
      clearcoat: 1,
    })
  );

  const halo = createSprite(
    isRare ? goldGlowTexture : softGlowTexture,
    isRare ? 0.95 : 0.84,
    isRare ? 0.95 : 0.84,
    isRare ? 0.34 : 0.22,
    isRare ? 0xffd27a : 0xeef8ff
  );

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(isRare ? 0.42 : 0.36, 12, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  hitMesh.userData.fragmentContainer = container;

  container.add(mesh);
  container.add(halo);
  container.add(hitMesh);

  interactiveGroup.add(container);

  fragments.push({ container, mesh, halo, hitMesh });
  hitTargets.push(hitMesh);
}

for (let i = 0; i < 7; i += 1) spawnFragment(false);
spawnFragment(true);

function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.clientX;
  const clientY = event.clientY;
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function hitTest(event) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hitTargets, false);
  if (hits.length === 0) return null;
  return hits[0].object.userData.fragmentContainer || null;
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove("hidden");
  clearTimeout(showToast._id);
  showToast._id = setTimeout(() => toastEl.classList.add("hidden"), 650);
}

function formatScore(n) {
  return String(Math.floor(n)).padStart(6, "0");
}

function updateUI() {
  scoreEl.textContent = formatScore(state.score);
  comboEl.textContent = `x${state.combo}`;
  streakEl.textContent = String(state.streak);
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
  const energyClamped = Math.max(0, Math.min(100, state.energy));
  energyValueEl.textContent = `${Math.round(energyClamped)}%`;
  energyBarEl.style.width = `${energyClamped}%`;
}

function triggerPulse(power = 1) {
  state.pulse = Math.max(state.pulse, power);
  state.pulseScale = Math.max(state.pulseScale, power);
}

function hideFragment(fragment, delay) {
  fragment.container.userData.active = false;
  fragment.container.userData.respawnAt = clock.elapsedTime + delay;
  fragment.mesh.visible = false;
  fragment.halo.visible = false;
  fragment.hitMesh.visible = false;
}

function reviveFragment(fragment) {
  fragment.container.userData.active = true;
  fragment.container.userData.orbitRadius = (fragment.container.userData.isRare ? 2.55 : 2.15) + Math.random() * 1.15;
  fragment.container.userData.orbitSpeed = (fragment.container.userData.isRare ? 0.58 : 0.82) + Math.random() * 0.72;
  fragment.container.userData.orbitTilt = (Math.random() - 0.5) * 0.7;
  fragment.container.userData.orbitAngle = Math.random() * Math.PI * 2;
  fragment.container.userData.bob = Math.random() * Math.PI * 2;
  fragment.mesh.visible = true;
  fragment.halo.visible = true;
  fragment.hitMesh.visible = true;
}

function handleFragmentTap(fragmentContainer) {
  if (!state.running || state.endLocked) return;
  const fragment = fragments.find((item) => item.container === fragmentContainer);
  if (!fragment || !fragment.container.userData.active) return;

  const now = clock.elapsedTime;
  const hitWindow = now - state.lastHitAt;
  state.lastHitAt = now;

  if (hitWindow < 1.15) {
    state.streak += 1;
    state.combo = Math.min(9, state.combo + 1);
  } else {
    state.streak = 1;
    state.combo = 1;
  }

  const value = fragment.container.userData.value;
  const gained = value * state.combo;
  state.score += gained;
  state.energy = Math.min(100, state.energy + value * (fragment.container.userData.isRare ? 1.25 : 0.85));
  triggerPulse(fragment.container.userData.isRare ? 1.35 : 1);

  if (fragment.container.userData.isRare) {
    showToast(`Fragmento raro +${gained}`);
    hideFragment(fragment, 2.4);
  } else {
    hideFragment(fragment, 1.1 + Math.random() * 0.5);
  }

  updateUI();

  if (state.energy >= 100) {
    finishGame(true);
  }
}

function finishGame(success) {
  if (state.endLocked) return;
  state.endLocked = true;
  state.running = false;
  overlayEnd.classList.remove("hidden");
  endTitle.textContent = success ? "Núcleo estabilizado" : "Carga insuficiente";
  endSummary.textContent = success
    ? `Pontuação final ${formatScore(state.score)} • Sequência máxima ${state.streak}`
    : `Você chegou a ${Math.round(state.energy)}% de carga. Pontuação ${formatScore(state.score)}.`;
}

function resetGame() {
  state.running = false;
  state.score = 0;
  state.combo = 1;
  state.streak = 0;
  state.energy = 0;
  state.timeLeft = 45;
  state.lastHitAt = 0;
  state.pulse = 0;
  state.pulseScale = 0;
  state.endLocked = false;

  for (const fragment of fragments) {
    fragment.container.userData.active = true;
    fragment.container.userData.respawnAt = 0;
    reviveFragment(fragment);
  }

  updateUI();
  overlayEnd.classList.add("hidden");
}

function startGame() {
  resetGame();
  state.running = true;
  overlayStart.classList.add("hidden");
}

function restartGame() {
  overlayStart.classList.add("hidden");
  startGame();
}

function requestFullscreen() {
  const root = document.documentElement;
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
    return;
  }
  root.requestFullscreen?.().catch(() => {
    showToast("No iPhone, Adicionar à Tela de Início fica melhor.");
  });
}

function onPointerDown(event) {
  dragState.active = true;
  dragState.moved = false;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
}

function onPointerMove(event) {
  if (!dragState.active) return;
  const dx = event.clientX - dragState.lastX;
  const dy = event.clientY - dragState.lastY;
  const total = Math.abs(event.clientX - dragState.startX) + Math.abs(event.clientY - dragState.startY);
  if (total > 10) dragState.moved = true;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;

  targetRotation.y += dx * 0.0032;
  targetRotation.x += dy * 0.0024;
  targetRotation.x = THREE.MathUtils.clamp(targetRotation.x, -0.42, 0.42);
  targetRotation.y = THREE.MathUtils.clamp(targetRotation.y, -0.72, 0.72);
}

function onPointerUp(event) {
  if (!dragState.active) return;
  const wasTap = !dragState.moved;
  dragState.active = false;
  if (!wasTap) return;

  const fragmentContainer = hitTest(event);
  if (fragmentContainer) {
    handleFragmentTap(fragmentContainer);
  } else if (state.running) {
    state.combo = 1;
    state.streak = 0;
    updateUI();
  }
}

canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
window.addEventListener("pointermove", onPointerMove, { passive: true });
window.addEventListener("pointerup", onPointerUp, { passive: true });
window.addEventListener("pointercancel", () => {
  dragState.active = false;
});

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);
fullscreenBtn.addEventListener("click", requestFullscreen);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

function updateFragments(elapsed) {
  for (const fragment of fragments) {
    const data = fragment.container.userData;
    if (!data.active) {
      if (elapsed >= data.respawnAt && state.running && !state.endLocked) {
        reviveFragment(fragment);
      }
      continue;
    }

    data.orbitAngle += data.orbitSpeed * 0.006;
    const x = Math.cos(data.orbitAngle) * data.orbitRadius;
    const z = Math.sin(data.orbitAngle) * data.orbitRadius;
    const y = Math.sin(elapsed * 1.8 + data.bob) * 0.28 + data.orbitTilt;

    fragment.container.position.set(x, y, z);
    fragment.mesh.rotation.x += 0.02;
    fragment.mesh.rotation.y += 0.024;
    fragment.halo.material.opacity = data.isRare
      ? 0.3 + Math.sin(elapsed * 4.0 + data.bob) * 0.08
      : 0.18 + Math.sin(elapsed * 3.0 + data.bob) * 0.06;
  }
}

function updateVisuals(elapsed, delta) {
  const energy01 = state.energy / 100;

  currentRotation.x = THREE.MathUtils.lerp(currentRotation.x, targetRotation.x, 0.06);
  currentRotation.y = THREE.MathUtils.lerp(currentRotation.y, targetRotation.y, 0.06);

  coreRig.rotation.x = currentRotation.x + Math.sin(elapsed * 0.42) * 0.03;
  coreRig.rotation.y += 0.0025 + energy01 * 0.0025;
  world.rotation.y = currentRotation.y * 0.82;

  shell.rotation.y -= 0.0035;
  shell.rotation.x += 0.0016;
  shellWire.rotation.y += 0.004;
  ringA.rotation.z += 0.004 + energy01 * 0.004;
  ringB.rotation.y -= 0.003 + energy01 * 0.003;
  dust.rotation.y -= 0.0014;
  dust.rotation.z = Math.sin(elapsed * 0.2) * 0.08;

  state.pulse = THREE.MathUtils.lerp(state.pulse, 0, delta * 4.4);
  state.pulseScale = THREE.MathUtils.lerp(state.pulseScale, 0, delta * 5.2);

  const scaleBoost = 1 + state.pulseScale * 0.18 + energy01 * 0.05;
  core.scale.setScalar(scaleBoost);
  core.material.emissiveIntensity = 1.8 + state.pulse * 2.3 + energy01 * 1.6;
  shell.material.attenuationColor.setHSL(0.57 + energy01 * 0.04, 0.45, 0.86);
  innerHalo.material.opacity = 0.26 + state.pulse * 0.2 + energy01 * 0.24;
  backHalo.material.opacity = 0.14 + energy01 * 0.18;
  atmosphere.material.opacity = 0.12 + energy01 * 0.1;
  rimBlue.intensity = 16 + state.pulse * 6 + energy01 * 8;

  pulseRing.scale.setScalar(1 + state.pulse * 1.05);
  pulseRing.material.opacity = 0.24 * state.pulse;

  bgStars.rotation.y += 0.00022;
  bgStars.rotation.x = Math.sin(elapsed * 0.14) * 0.04;

  beamA.material.opacity = 0.04 + energy01 * 0.05;
  beamB.material.opacity = 0.035 + energy01 * 0.045;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, currentRotation.y * 0.9, 0.035);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.25 - currentRotation.x * 0.85, 0.035);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 8 - energy01 * 0.85 - state.pulse * 0.18, 0.04);
  camera.lookAt(0, 0.1, 0);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  if (state.running && !state.endLocked) {
    state.timeLeft = Math.max(0, state.timeLeft - delta);
    if (state.timeLeft <= 0 && state.energy < 100) {
      finishGame(false);
    }
  }

  updateFragments(elapsed);
  updateVisuals(elapsed, delta);
  updateUI();
  renderer.render(scene, camera);
}

updateUI();
renderer.setAnimationLoop(animate);
