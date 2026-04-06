import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const dom = {
  app: document.getElementById('app'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  score: document.getElementById('score'),
  phase: document.getElementById('phase'),
  speed: document.getElementById('speed'),
  energy: document.getElementById('energy'),
  energyFill: document.getElementById('energyFill'),
  routeFill: document.getElementById('routeFill'),
  distance: document.getElementById('distance'),
  combo: document.getElementById('combo'),
  gates: document.getElementById('gates'),
  crystals: document.getElementById('crystals'),
  joystick: document.getElementById('joystick'),
  stick: document.getElementById('stick'),
  boostBtn: document.getElementById('boostBtn'),
  startOverlay: document.getElementById('startOverlay'),
  endOverlay: document.getElementById('endOverlay'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
  endTitle: document.getElementById('endTitle'),
  endText: document.getElementById('endText'),
  finalScore: document.getElementById('finalScore'),
  finalGates: document.getElementById('finalGates'),
  finalCrystals: document.getElementById('finalCrystals'),
  finalCombo: document.getElementById('finalCombo'),
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06101d, 0.048);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(0, 0.85, 9.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
dom.app.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);

scene.add(new THREE.HemisphereLight(0xdff3ff, 0x04070e, 2.1));
const keyLight = new THREE.DirectionalLight(0xf0fbff, 2.4);
keyLight.position.set(5, 7, 8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x96cfff, 1.4);
rimLight.position.set(-6, 1, -3);
scene.add(rimLight);

const bgUniforms = {
  uTime: { value: 0 },
  uBoost: { value: 0 }
};

const bg = new THREE.Mesh(
  new THREE.SphereGeometry(100, 48, 48),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: bgUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vDir;
      uniform float uTime;
      uniform float uBoost;

      float hash(vec3 p){
        p = fract(p * 0.3183099 + vec3(.1,.2,.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x){
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i + vec3(0.0));
        float n100 = hash(i + vec3(1.0,0.0,0.0));
        float n010 = hash(i + vec3(0.0,1.0,0.0));
        float n110 = hash(i + vec3(1.0,1.0,0.0));
        float n001 = hash(i + vec3(0.0,0.0,1.0));
        float n101 = hash(i + vec3(1.0,0.0,1.0));
        float n011 = hash(i + vec3(0.0,1.0,1.0));
        float n111 = hash(i + vec3(1.0));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }
      void main() {
        vec3 d = normalize(vDir);
        float t = uTime * 0.04;
        float horizon = pow(1.0 - abs(d.y), 2.0);
        float neb = noise(d * 5.0 + vec3(t, -t * 1.3, t * 0.5));
        float band = 0.5 + 0.5 * sin(atan(d.z, d.x) * 5.0 + uTime * 0.35 + d.y * 3.0);
        vec3 deep = vec3(0.02, 0.04, 0.08);
        vec3 mid = vec3(0.05, 0.10, 0.17);
        vec3 cold = vec3(0.30, 0.60, 0.84);
        vec3 whiteBlue = vec3(0.90, 0.98, 1.0);
        vec3 color = mix(deep, mid, horizon);
        color += cold * smoothstep(0.35, 1.0, neb) * 0.20;
        color += whiteBlue * band * horizon * (0.05 + uBoost * 0.08);
        color += vec3(0.65,0.8,1.0) * horizon * 0.05;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  })
);
scene.add(bg);

const laneWidth = 3.45;
const laneHeight = 2.10;
const courseLength = 600;

const state = {
  running: false,
  done: false,
  score: 0,
  combo: 1,
  maxCombo: 1,
  energy: 100,
  progress: 0,
  phase: 1,
  speedBase: 18,
  speed: 18,
  boost: 0,
  gateCount: 0,
  crystalCount: 0,
  pulse: 0,
};

const input = {
  x: 0,
  y: 0,
  boost: false,
  keyboard: { left: false, right: false, up: false, down: false }
};

const ship = new THREE.Group();
world.add(ship);

function createShip() {
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1fbff,
    emissive: 0x89d8ff,
    emissiveIntensity: 0.12,
    roughness: 0.18,
    metalness: 0.46,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9f6ff,
    emissive: 0xb7ebff,
    emissiveIntensity: 0.08,
    roughness: 0.06,
    metalness: 0.08,
    transmission: 0.52,
    transparent: true,
    opacity: 0.92,
    thickness: 0.8,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xe3f8ff,
    transparent: true,
    opacity: 0.20,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.25, 8, 16), hullMat);
  body.rotation.z = Math.PI * 0.5;
  ship.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 20), hullMat);
  nose.rotation.z = -Math.PI * 0.5;
  nose.position.set(1.02, 0, 0);
  ship.add(nose);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), glassMat);
  cockpit.scale.set(1.22, 0.74, 0.74);
  cockpit.position.set(0.26, 0.12, 0);
  ship.add(cockpit);

  const wingGeo = new THREE.BoxGeometry(1.16, 0.05, 0.45);
  const wingL = new THREE.Mesh(wingGeo, hullMat);
  wingL.position.set(-0.04, 0.12, -0.52);
  wingL.rotation.x = -0.16;
  wingL.rotation.z = 0.05;
  ship.add(wingL);
  const wingR = wingL.clone();
  wingR.position.z = 0.52;
  wingR.rotation.x = 0.16;
  wingR.rotation.z = -0.05;
  ship.add(wingR);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.38, 0.05), hullMat);
  fin.position.set(-0.78, 0.30, 0);
  fin.rotation.z = 0.2;
  ship.add(fin);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.04, 16, 64), glowMat);
  halo.rotation.y = Math.PI * 0.5;
  ship.add(halo);

  const trailGroup = new THREE.Group();
  ship.add(trailGroup);
  const thrusterMat = new THREE.MeshBasicMaterial({
    color: 0xeafcff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const thrusterA = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.85, 16, 1, true), thrusterMat);
  thrusterA.rotation.z = Math.PI * 0.5;
  thrusterA.position.set(-1.02, 0.04, -0.16);
  trailGroup.add(thrusterA);
  const thrusterB = thrusterA.clone();
  thrusterB.position.z = 0.16;
  trailGroup.add(thrusterB);
  const trailGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.02, 2.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xdff7ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  trailGlow.rotation.z = Math.PI * 0.5;
  trailGlow.position.set(-1.55, 0, 0);
  trailGroup.add(trailGlow);

  return { halo, thrusterA, thrusterB, trailGlow };
}

const shipFx = createShip();
ship.position.set(0, 0, 0);

const corridor = new THREE.Group();
world.add(corridor);
for (let i = 0; i < 20; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.8, 0.03, 12, 90),
    new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? 0xe9fbff : 0xaed7ff,
      transparent: true,
      opacity: i % 3 === 0 ? 0.14 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.position.z = -8 - i * 10;
  ring.rotation.x = Math.PI * 0.5;
  corridor.add(ring);
}
for (let i = 0; i < 6; i++) {
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 220, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xe6fbff : 0xb6cbff,
      transparent: true,
      opacity: i % 2 === 0 ? 0.14 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  line.rotation.z = Math.PI * 0.5;
  line.position.set((i - 2.5) * 1.55, 0, -105);
  line.rotation.y = 0.16 * (i - 2.5);
  corridor.add(line);
}

const stars = new THREE.Group();
scene.add(stars);
for (let i = 0; i < 260; i++) {
  const star = new THREE.Mesh(
    new THREE.PlaneGeometry(0.06 + Math.random() * 0.05, 0.06 + Math.random() * 0.05),
    new THREE.MeshBasicMaterial({
      color: Math.random() < 0.25 ? 0xbfdcff : 0xffffff,
      transparent: true,
      opacity: 0.55 + Math.random() * 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  star.position.set(
    (Math.random() - 0.5) * 48,
    (Math.random() - 0.5) * 28,
    -Math.random() * 220
  );
  stars.add(star);
}

const gateData = [];
const crystalData = [];
const pulseData = [];

function createGate(z) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.10, 18, 84),
    new THREE.MeshBasicMaterial({
      color: 0xe4fbff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.03, 12, 84),
    new THREE.MeshBasicMaterial({
      color: 0xb8e2ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(ring, halo);
  group.position.set(THREE.MathUtils.randFloatSpread(laneWidth * 1.1), THREE.MathUtils.randFloatSpread(laneHeight * 1.05), z);
  world.add(group);
  return { group, ring, halo, radius: 1.35, passed: false };
}

function createCrystal(z, rare = false) {
  const group = new THREE.Group();
  const color = rare ? 0xffefb6 : 0xd9f7ff;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(rare ? 0.34 : 0.24, 0),
    new THREE.MeshPhysicalMaterial({
      color,
      emissive: rare ? 0xffdf72 : 0xc8f4ff,
      emissiveIntensity: rare ? 0.9 : 0.55,
      roughness: 0.12,
      metalness: 0.28,
      transmission: 0.35,
      transparent: true,
      opacity: 0.94,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(rare ? 0.6 : 0.46, 16, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: rare ? 0.17 : 0.10,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(gem, halo);
  group.position.set(THREE.MathUtils.randFloatSpread(laneWidth * 1.15), THREE.MathUtils.randFloatSpread(laneHeight * 1.15), z);
  world.add(group);
  return { group, gem, halo, rare, collected: false, spin: 0.8 + Math.random() * 1.2, bobSeed: Math.random() * Math.PI * 2 };
}

function createPulse(z) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.03, 12, 60),
    new THREE.MeshBasicMaterial({
      color: 0xe8fcff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  mesh.position.set(0, 0, z);
  world.add(mesh);
  return { mesh, active: false, life: 0 };
}

for (let i = 0; i < 14; i++) gateData.push(createGate(-24 - i * 32));
for (let i = 0; i < 18; i++) crystalData.push(createCrystal(-18 - i * 24, i % 8 === 0));
for (let i = 0; i < 5; i++) pulseData.push(createPulse(-30 - i * 36));

function resetGate(gate, z) {
  gate.radius = THREE.MathUtils.randFloat(1.0, state.phase >= 3 ? 1.25 : 1.5);
  gate.group.position.set(
    THREE.MathUtils.randFloatSpread(laneWidth * (state.phase >= 3 ? 1.0 : 1.12)),
    THREE.MathUtils.randFloatSpread(laneHeight * (state.phase >= 3 ? 1.0 : 1.12)),
    z
  );
  gate.group.rotation.x = THREE.MathUtils.randFloatSpread(0.28);
  gate.group.rotation.y = THREE.MathUtils.randFloatSpread(0.28);
  gate.ring.geometry.dispose();
  gate.halo.geometry.dispose();
  gate.ring.geometry = new THREE.TorusGeometry(gate.radius, 0.10, 18, 84);
  gate.halo.geometry = new THREE.TorusGeometry(gate.radius * 1.27, 0.03, 12, 84);
  gate.passed = false;
}

function resetCrystal(crystal, z) {
  crystal.rare = Math.random() < 0.15;
  crystal.group.position.set(
    THREE.MathUtils.randFloatSpread(laneWidth * 1.18),
    THREE.MathUtils.randFloatSpread(laneHeight * 1.18),
    z
  );
  crystal.group.visible = true;
  crystal.collected = false;
  crystal.gem.scale.setScalar(crystal.rare ? 1.25 : 1.0);
  crystal.halo.scale.setScalar(crystal.rare ? 1.25 : 1.0);
  crystal.gem.material.color.setHex(crystal.rare ? 0xffefb6 : 0xd9f7ff);
  crystal.gem.material.emissive.setHex(crystal.rare ? 0xffdf72 : 0xc8f4ff);
  crystal.gem.material.emissiveIntensity = crystal.rare ? 0.9 : 0.55;
  crystal.halo.material.color.setHex(crystal.rare ? 0xffefb6 : 0xd9f7ff);
  crystal.halo.material.opacity = crystal.rare ? 0.17 : 0.10;
}

function emitPulse(z) {
  const pulse = pulseData[Math.floor(Math.random() * pulseData.length)];
  pulse.mesh.position.set(THREE.MathUtils.randFloatSpread(0.5), THREE.MathUtils.randFloatSpread(0.35), z);
  pulse.mesh.scale.setScalar(1);
  pulse.mesh.material.opacity = 0.35;
  pulse.active = true;
  pulse.life = 0;
}

function syncHUD() {
  dom.score.textContent = String(Math.round(Math.max(0, state.score))).padStart(6, '0');
  dom.phase.textContent = String(state.phase).padStart(2, '0');
  dom.speed.textContent = String(Math.round(state.speed * 8));
  dom.energy.textContent = `${Math.round(Math.max(0, state.energy))}%`;
  dom.energyFill.style.width = `${THREE.MathUtils.clamp(state.energy, 0, 100)}%`;
  dom.distance.textContent = `${Math.round(state.progress)}%`;
  dom.routeFill.style.width = `${THREE.MathUtils.clamp(state.progress, 0, 100)}%`;
  dom.combo.textContent = `x${state.combo}`;
  dom.gates.textContent = `${state.gateCount}`;
  dom.crystals.textContent = `${state.crystalCount}`;
}

function resetGame() {
  state.running = true;
  state.done = false;
  state.score = 0;
  state.combo = 1;
  state.maxCombo = 1;
  state.energy = 100;
  state.progress = 0;
  state.phase = 1;
  state.speedBase = 18;
  state.speed = 18;
  state.boost = 0;
  state.gateCount = 0;
  state.crystalCount = 0;
  state.pulse = 0;

  ship.position.set(0, 0, 0);
  ship.rotation.set(0, 0, 0);
  camera.position.set(0, 0.85, 9.2);
  world.rotation.z = 0;

  gateData.forEach((gate, i) => resetGate(gate, -24 - i * 32));
  crystalData.forEach((crystal, i) => resetCrystal(crystal, -18 - i * 24));
  pulseData.forEach((pulse, i) => {
    pulse.active = false;
    pulse.life = 0;
    pulse.mesh.material.opacity = 0;
    pulse.mesh.position.z = -30 - i * 36;
  });

  input.x = 0;
  input.y = 0;
  input.boost = false;
  Object.keys(input.keyboard).forEach((key) => { input.keyboard[key] = false; });
  updateStickVisual(0, 0);
  dom.boostBtn.classList.remove('active');
  syncHUD();
}

function endGame(win) {
  state.running = false;
  state.done = true;
  dom.finalScore.textContent = String(Math.round(Math.max(0, state.score))).padStart(6, '0');
  dom.finalGates.textContent = String(state.gateCount);
  dom.finalCrystals.textContent = String(state.crystalCount);
  dom.finalCombo.textContent = `x${state.maxCombo}`;
  dom.endTitle.textContent = win ? 'Rota concluída' : 'Núcleo desestabilizado';
  dom.endText.textContent = win
    ? 'Você atravessou o corredor temporal com a nave estabilizada.'
    : 'A energia acabou antes do fim da rota. Ajuste a trajetória e tente novamente.';
  dom.endOverlay.classList.add('visible');
}

function beginExperience() {
  dom.startOverlay.classList.remove('visible');
  dom.endOverlay.classList.remove('visible');
  resetGame();
}

window.startExperience = beginExperience;

const joystickState = { active: false, pointerId: null, centerX: 0, centerY: 0, radius: 40 };

function updateStickVisual(x, y) {
  const px = x * joystickState.radius;
  const py = -y * joystickState.radius;
  dom.stick.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
}

function currentInput() {
  let x = input.x;
  let y = input.y;
  if (input.keyboard.left) x -= 1;
  if (input.keyboard.right) x += 1;
  if (input.keyboard.up) y += 1;
  if (input.keyboard.down) y -= 1;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

function setupJoystick() {
  const setCenter = () => {
    const rect = dom.joystick.getBoundingClientRect();
    joystickState.centerX = rect.left + rect.width / 2;
    joystickState.centerY = rect.top + rect.height / 2;
    joystickState.radius = rect.width * 0.30;
  };
  setCenter();
  window.addEventListener('resize', setCenter);

  const onMove = (clientX, clientY) => {
    let dx = clientX - joystickState.centerX;
    let dy = clientY - joystickState.centerY;
    const max = joystickState.radius;
    const len = Math.hypot(dx, dy);
    if (len > max && len > 0) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    input.x = dx / max;
    input.y = -dy / max;
    updateStickVisual(input.x, input.y);
  };

  const end = () => {
    joystickState.active = false;
    joystickState.pointerId = null;
    input.x = 0;
    input.y = 0;
    updateStickVisual(0, 0);
  };

  dom.joystick.addEventListener('pointerdown', (e) => {
    joystickState.active = true;
    joystickState.pointerId = e.pointerId;
    try { dom.joystick.setPointerCapture(e.pointerId); } catch (_) {}
    setCenter();
    onMove(e.clientX, e.clientY);
  });
  dom.joystick.addEventListener('pointermove', (e) => {
    if (!joystickState.active) return;
    if (joystickState.pointerId !== null && e.pointerId !== joystickState.pointerId) return;
    onMove(e.clientX, e.clientY);
  });
  dom.joystick.addEventListener('pointerup', end);
  dom.joystick.addEventListener('pointercancel', end);
}

function setupBoost() {
  const press = () => {
    input.boost = true;
    dom.boostBtn.classList.add('active');
  };
  const release = () => {
    input.boost = false;
    dom.boostBtn.classList.remove('active');
  };
  ['pointerdown', 'touchstart'].forEach((evt) => dom.boostBtn.addEventListener(evt, press, { passive: true }));
  ['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach((evt) => dom.boostBtn.addEventListener(evt, release, { passive: true }));
}

function setupKeyboard() {
  const map = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
  };

  window.addEventListener('keydown', (e) => {
    if (map[e.code]) input.keyboard[map[e.code]] = true;
    if (e.code === 'Space') input.boost = true;
  });
  window.addEventListener('keyup', (e) => {
    if (map[e.code]) input.keyboard[map[e.code]] = false;
    if (e.code === 'Space') input.boost = false;
  });
}

function setupFullscreen() {
  async function toggle() {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      return;
    }
    if (document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch (_) {}
    }
  }
  dom.fullscreenBtn.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', () => {
    dom.fullscreenBtn.textContent = document.fullscreenElement ? 'Sair' : 'Tela cheia';
  });
}

function setupOverlays() {
  const triggerStart = (e) => {
    if (e) e.preventDefault();
    beginExperience();
  };
  dom.startBtn.addEventListener('click', triggerStart);
  dom.startBtn.addEventListener('touchend', triggerStart, { passive: false });
  dom.restartBtn.addEventListener('click', triggerStart);
  dom.restartBtn.addEventListener('touchend', triggerStart, { passive: false });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', onResize);

setupJoystick();
setupBoost();
setupKeyboard();
setupFullscreen();
setupOverlays();
syncHUD();

function animateStars(dt, speed) {
  for (const star of stars.children) {
    star.position.z += speed * dt * 2.0;
    if (star.position.z > 8) {
      star.position.z = -220;
      star.position.x = (Math.random() - 0.5) * 48;
      star.position.y = (Math.random() - 0.5) * 28;
    }
    const flicker = 0.6 + Math.sin(clock.elapsedTime * 1.6 + star.position.x) * 0.14;
    star.material.opacity = 0.48 + flicker * 0.35;
    star.lookAt(camera.position);
  }
}

function updatePhases() {
  if (state.progress > 72) state.phase = 3;
  else if (state.progress > 36) state.phase = 2;
  else state.phase = 1;
}

function succeedGate() {
  state.gateCount += 1;
  state.score += 160 * state.combo;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.energy = Math.min(100, state.energy + 4.5);
  state.pulse = 1;
}

function failGate() {
  state.combo = 1;
  state.energy = Math.max(0, state.energy - 10.5);
}

function collectCrystal(rare) {
  state.crystalCount += 1;
  state.score += (rare ? 320 : 90) * state.combo;
  state.energy = Math.min(100, state.energy + (rare ? 5.5 : 2.0));
  state.pulse = 1;
}

function animateWorld(dt) {
  const boostTarget = input.boost ? 1 : 0;
  state.boost = THREE.MathUtils.lerp(state.boost, boostTarget, 0.08);
  state.speed = THREE.MathUtils.lerp(state.speed, state.speedBase + state.boost * 12, 0.08);
  state.progress = Math.min(100, state.progress + (state.speed * dt / courseLength) * 100);
  updatePhases();

  const control = currentInput();
  const steer = state.phase >= 3 ? 5.0 : 4.3;
  ship.position.x = THREE.MathUtils.clamp(ship.position.x + control.x * steer * dt, -laneWidth, laneWidth);
  ship.position.y = THREE.MathUtils.clamp(ship.position.y + control.y * steer * dt, -laneHeight, laneHeight);

  ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, -control.x * 0.34, 0.08);
  ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, control.y * 0.16 + state.boost * 0.08, 0.08);
  ship.rotation.y = THREE.MathUtils.lerp(ship.rotation.y, -control.x * 0.12, 0.08);

  shipFx.halo.rotation.x += 0.026;
  shipFx.halo.rotation.z += 0.018;
  const thrusterLen = 1 + state.boost * 0.9 + state.pulse * 0.14;
  shipFx.thrusterA.scale.set(1, thrusterLen, 1);
  shipFx.thrusterB.scale.set(1, thrusterLen, 1);
  shipFx.trailGlow.scale.set(1, 1 + state.boost * 1.1, 1 + state.boost * 0.2);
  shipFx.trailGlow.material.opacity = 0.16 + state.boost * 0.24;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, ship.position.x * 0.36, 0.05);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, ship.position.y * 0.24 + 0.85, 0.05);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 9.2 - state.boost * 1.1, 0.05);
  camera.lookAt(ship.position.x * 0.3, ship.position.y * 0.1, -7.5);

  bgUniforms.uBoost.value = state.boost;

  corridor.children.forEach((child, index) => {
    child.position.z += state.speed * dt;
    if (child.position.z > 8) child.position.z -= 200;
    if (child.material && 'opacity' in child.material) {
      child.material.opacity = index % 2 === 0
        ? 0.08 + state.phase * 0.02 + state.boost * 0.05
        : 0.05 + state.phase * 0.015 + state.boost * 0.03;
    }
  });

  gateData.forEach((gate) => {
    gate.group.position.z += state.speed * dt;
    gate.group.rotation.z += dt * 0.9;
    gate.ring.material.opacity = 0.34 + state.phase * 0.05 + state.boost * 0.08;
    gate.halo.material.opacity = 0.14 + state.phase * 0.03;

    if (!gate.passed && gate.group.position.z > -0.3) {
      const dist = Math.hypot(ship.position.x - gate.group.position.x, ship.position.y - gate.group.position.y);
      if (dist <= gate.radius * 0.86) succeedGate();
      else failGate();
      gate.passed = true;
      emitPulse(gate.group.position.z - 1.2);
    }

    if (gate.group.position.z > 8) resetGate(gate, -190 - Math.random() * 40);
  });

  crystalData.forEach((crystal) => {
    crystal.group.position.z += state.speed * dt;
    crystal.group.rotation.x += dt * crystal.spin * 0.7;
    crystal.group.rotation.y += dt * crystal.spin;
    crystal.group.position.y += Math.sin(clock.elapsedTime * 2 + crystal.bobSeed) * 0.002;

    if (!crystal.collected) {
      const dx = ship.position.x - crystal.group.position.x;
      const dy = ship.position.y - crystal.group.position.y;
      const dz = crystal.group.position.z - ship.position.z;
      if (Math.hypot(dx, dy, dz) < (crystal.rare ? 0.74 : 0.56)) {
        crystal.collected = true;
        crystal.group.visible = false;
        collectCrystal(crystal.rare);
      }
    }

    if (crystal.group.position.z > 8) resetCrystal(crystal, -190 - Math.random() * 40);
  });

  pulseData.forEach((pulse) => {
    if (!pulse.active) return;
    pulse.life += dt;
    pulse.mesh.position.z += state.speed * dt * 1.06;
    pulse.mesh.scale.setScalar(1 + pulse.life * 3.5);
    pulse.mesh.material.opacity = Math.max(0, 0.35 - pulse.life * 0.55);
    if (pulse.mesh.position.z > 8 || pulse.mesh.material.opacity <= 0.01) {
      pulse.active = false;
      pulse.mesh.material.opacity = 0;
    }
  });

  state.energy = Math.max(0, Math.min(100, state.energy - dt * (2.25 - state.boost * 0.45)));
  state.pulse = THREE.MathUtils.lerp(state.pulse, 0, 0.08);
  world.rotation.z = THREE.MathUtils.lerp(world.rotation.z, ship.rotation.z * 0.10, 0.04);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.032);
  bgUniforms.uTime.value = clock.elapsedTime;

  if (state.running) {
    animateWorld(dt);
    animateStars(dt, state.speed);
    syncHUD();
    if (state.energy <= 0) endGame(false);
    else if (state.progress >= 100) endGame(true);
  } else {
    animateStars(dt, 10);
    ship.rotation.y += dt * 0.35;
    shipFx.halo.rotation.x += 0.02;
    shipFx.halo.rotation.z += 0.015;
    camera.lookAt(0, 0, -7);
  }

  renderer.render(scene, camera);
}

loop();
