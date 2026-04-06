import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const dom = {
  app: document.getElementById('app'),
  hudIsland: document.getElementById('hudIsland'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  missionBarWrap: document.getElementById('missionBarWrap'),
  controlsWrap: document.getElementById('controlsWrap'),
  joystick: document.getElementById('joystick'),
  stick: document.getElementById('stick'),
  boostBtn: document.getElementById('boostBtn'),
  startOverlay: document.getElementById('startOverlay'),
  startBtn: document.getElementById('startBtn'),
  endOverlay: document.getElementById('endOverlay'),
  restartBtn: document.getElementById('restartBtn'),
  endTitle: document.getElementById('endTitle'),
  endText: document.getElementById('endText'),
  energyText: document.getElementById('energyText'),
  routeText: document.getElementById('routeText'),
  speedText: document.getElementById('speedText'),
  crystalText: document.getElementById('crystalText'),
  missionFill: document.getElementById('missionFill'),
  finalScore: document.getElementById('finalScore'),
  finalGates: document.getElementById('finalGates'),
  finalCrystals: document.getElementById('finalCrystals'),
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06111d, 0.048);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 0.8, 8.3);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
dom.app.appendChild(renderer.domElement);

const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0xe7f6ff, 0x05070b, 2.0));
const keyLight = new THREE.DirectionalLight(0xf1fbff, 2.6);
keyLight.position.set(5, 7, 7);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8ccfff, 1.35);
rimLight.position.set(-6, 2, -4);
scene.add(rimLight);

const bgUniforms = { uTime: { value: 0 }, uBoost: { value: 0 } };
const bg = new THREE.Mesh(
  new THREE.SphereGeometry(90, 48, 48),
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

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(.1,.2,.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
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
        float t = uTime * 0.03;
        float horizon = pow(1.0 - abs(d.y), 2.0);
        float neb = noise(d * 5.0 + vec3(t, -t * 1.25, t * 0.6));
        float pulse = 0.5 + 0.5 * sin(atan(d.z, d.x) * 4.0 + uTime * 0.28 + d.y * 2.8);
        vec3 deep = vec3(0.02, 0.04, 0.08);
        vec3 mid = vec3(0.05, 0.10, 0.16);
        vec3 blue = vec3(0.28, 0.56, 0.84);
        vec3 whiteBlue = vec3(0.91, 0.98, 1.0);
        vec3 color = mix(deep, mid, horizon);
        color += blue * smoothstep(0.32, 1.0, neb) * 0.16;
        color += whiteBlue * horizon * pulse * (0.04 + uBoost * 0.05);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
);
scene.add(bg);

const world = new THREE.Group();
scene.add(world);

const laneWidth = 3.4;
const laneHeight = 2.15;
const routeTarget = 180;

const state = {
  running: false,
  done: false,
  score: 0,
  speedBase: 18,
  speed: 18,
  energy: 100,
  route: 0,
  crystals: 0,
  gates: 0,
  boost: 0,
  blink: 0,
};

const input = {
  x: 0,
  y: 0,
  boost: false,
  keyboard: { left: false, right: false, up: false, down: false },
};

const ship = new THREE.Group();
world.add(ship);

function createShip() {
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2fbff,
    emissive: 0x8fdbff,
    emissiveIntensity: 0.10,
    roughness: 0.18,
    metalness: 0.40,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbf6ff,
    emissive: 0xbceeff,
    emissiveIntensity: 0.08,
    roughness: 0.05,
    metalness: 0.08,
    transmission: 0.48,
    transparent: true,
    opacity: 0.94,
    thickness: 0.7,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });

  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xe6f8ff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 1.18, 8, 16), hullMat);
  body.rotation.z = Math.PI * 0.5;
  ship.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.90, 18), hullMat);
  nose.rotation.z = -Math.PI * 0.5;
  nose.position.set(0.98, 0, 0);
  ship.add(nose);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.38, 22, 22), glassMat);
  cockpit.scale.set(1.18, 0.72, 0.72);
  cockpit.position.set(0.20, 0.12, 0);
  ship.add(cockpit);

  const wingGeo = new THREE.BoxGeometry(1.10, 0.05, 0.38);
  const wingL = new THREE.Mesh(wingGeo, hullMat);
  wingL.position.set(-0.08, 0.11, -0.46);
  wingL.rotation.x = -0.16;
  ship.add(wingL);

  const wingR = wingL.clone();
  wingR.position.z = 0.46;
  wingR.rotation.x = 0.16;
  ship.add(wingR);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 16, 64), glowMat);
  halo.rotation.y = Math.PI * 0.5;
  ship.add(halo);

  const thrusterMat = new THREE.MeshBasicMaterial({
    color: 0xeafcff,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const jetA = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.86, 16, 1, true), thrusterMat);
  jetA.rotation.z = Math.PI * 0.5;
  jetA.position.set(-0.96, 0.03, -0.12);
  ship.add(jetA);

  const jetB = jetA.clone();
  jetB.position.z = 0.12;
  ship.add(jetB);

  const trail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.02, 1.8, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xdff7ff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  trail.rotation.z = Math.PI * 0.5;
  trail.position.set(-1.35, 0, 0);
  ship.add(trail);

  return { halo, jetA, jetB, trail };
}

const shipFx = createShip();
ship.position.set(0, 0, 0);

const corridor = new THREE.Group();
world.add(corridor);

for (let i = 0; i < 20; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.6, 0.02, 12, 90),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xeafcff : 0xb2dbff,
      transparent: true,
      opacity: i % 2 === 0 ? 0.14 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.position.z = -8 - i * 10;
  ring.rotation.x = Math.PI * 0.5;
  corridor.add(ring);
}

const rails = new THREE.Group();
world.add(rails);
for (let i = 0; i < 4; i++) {
  const x = i < 2 ? -4.2 : 4.2;
  const y = i % 2 === 0 ? -2.8 : 2.8;
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 220, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xc0e8ff,
      transparent: true,
      opacity: 0.10,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  rail.rotation.z = Math.PI * 0.5;
  rail.position.set(x, y, -104);
  rails.add(rail);
}

const starGeo = new THREE.BufferGeometry();
const starCount = 1600;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const i3 = i * 3;
  starPos[i3] = (Math.random() - 0.5) * 28;
  starPos[i3 + 1] = (Math.random() - 0.5) * 22;
  starPos[i3 + 2] = -Math.random() * 200;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({
    color: 0xf2fbff,
    size: 0.05,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
world.add(stars);

const gates = [];
const crystals = [];

function makeGate(index) {
  const mat = new THREE.MeshBasicMaterial({
    color: index % 3 === 0 ? 0xffffff : 0xd1ecff,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const gate = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 18, 60), mat);
  gate.userData = { hit: false, pulse: Math.random() * Math.PI * 2 };
  world.add(gate);
  gates.push(gate);
  return gate;
}

function makeCrystal() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0xf0fbff,
      emissive: 0xb3e7ff,
      emissiveIntensity: 0.44,
      roughness: 0.12,
      metalness: 0.10,
      transmission: 0.45,
      transparent: true,
      opacity: 0.98,
    })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.33, 18, 18),
    new THREE.MeshBasicMaterial({
      color: 0xc5ebff,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(core);
  group.add(halo);
  group.userData = { hit: false, spin: Math.random() * 2 + 1.4 };
  world.add(group);
  crystals.push(group);
  return group;
}

for (let i = 0; i < 8; i++) makeGate(i);
for (let i = 0; i < 12; i++) makeCrystal();

function randomLaneX() {
  return THREE.MathUtils.randFloatSpread(laneWidth * 1.45);
}

function randomLaneY() {
  return THREE.MathUtils.randFloatSpread(laneHeight * 1.35);
}

function resetObjectPositions() {
  let zCursor = -20;
  gates.forEach((gate) => {
    zCursor -= THREE.MathUtils.randFloat(18, 28);
    gate.position.set(randomLaneX() * 0.7, randomLaneY() * 0.6, zCursor);
    gate.rotation.x = Math.PI * 0.5;
    gate.userData.hit = false;
  });

  let cCursor = -10;
  crystals.forEach((crystal) => {
    cCursor -= THREE.MathUtils.randFloat(10, 20);
    crystal.position.set(randomLaneX(), randomLaneY(), cCursor);
    crystal.userData.hit = false;
  });
}
resetObjectPositions();

function respawnGate(gate) {
  const farthest = Math.min(...gates.map((g) => g.position.z));
  gate.position.set(randomLaneX() * 0.7, randomLaneY() * 0.6, farthest - THREE.MathUtils.randFloat(18, 28));
  gate.userData.hit = false;
}

function respawnCrystal(crystal) {
  const farthest = Math.min(...crystals.map((c) => c.position.z));
  crystal.position.set(randomLaneX(), randomLaneY(), farthest - THREE.MathUtils.randFloat(10, 18));
  crystal.userData.hit = false;
}

function clampShip() {
  ship.position.x = THREE.MathUtils.clamp(ship.position.x, -laneWidth, laneWidth);
  ship.position.y = THREE.MathUtils.clamp(ship.position.y, -laneHeight, laneHeight);
}

function updateHUD() {
  dom.energyText.textContent = `${Math.max(0, Math.round(state.energy))}%`;
  dom.routeText.textContent = `${Math.min(100, Math.round((state.route / routeTarget) * 100))}%`;
  dom.speedText.textContent = `${Math.round(state.speed * 6.2)}`;
  dom.crystalText.textContent = `${state.crystals}`;
  dom.missionFill.style.width = `${Math.min(100, (state.route / routeTarget) * 100)}%`;
}

function finish(success) {
  if (state.done) return;
  state.running = false;
  state.done = true;
  dom.endOverlay.classList.add('visible');

  dom.finalScore.textContent = String(Math.round(state.score)).padStart(6, '0');
  dom.finalGates.textContent = String(state.gates);
  dom.finalCrystals.textContent = String(state.crystals);

  if (success) {
    dom.endTitle.textContent = 'Rota concluída';
    dom.endText.textContent = 'A nave estabilizou o corredor e concluiu o percurso.';
  } else {
    dom.endTitle.textContent = 'Energia esgotada';
    dom.endText.textContent = 'O voo perdeu sustentação antes do fim da rota.';
  }
}

function resetState() {
  state.running = false;
  state.done = false;
  state.score = 0;
  state.speed = state.speedBase;
  state.energy = 100;
  state.route = 0;
  state.crystals = 0;
  state.gates = 0;
  state.boost = 0;
  state.blink = 0;

  ship.position.set(0, 0, 0);
  ship.rotation.set(0, 0, 0);
  resetObjectPositions();
  updateHUD();
}

function showGameplayUI(show) {
  dom.hudIsland.classList.toggle('hidden', !show);
  dom.controlsWrap.classList.toggle('hidden', !show);
  dom.missionBarWrap.classList.toggle('hidden', !show);
}

function startExperience() {
  resetState();
  dom.startOverlay.classList.remove('visible');
  dom.endOverlay.classList.remove('visible');
  showGameplayUI(true);
  state.running = true;
}

window.startExperience = startExperience;
dom.startBtn.addEventListener('click', startExperience);
dom.startBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  startExperience();
}, { passive: false });
dom.restartBtn.addEventListener('click', startExperience);
dom.restartBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  startExperience();
}, { passive: false });

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) await document.exitFullscreen();
    return;
  }
  if (dom.app.requestFullscreen) {
    try {
      await dom.app.requestFullscreen();
    } catch {
      // iPhone Safari often ignores this; fallback is using Home Screen launch.
    }
  }
}

dom.fullscreenBtn.addEventListener('click', toggleFullscreen);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', resize);

function updateStickVisual() {
  dom.stick.style.transform = `translate(calc(-50% + ${input.x * 24}px), calc(-50% + ${input.y * 24}px))`;
}

let joyActive = false;
let joyPointerId = null;
let joyRect = null;

function readJoystick(clientX, clientY) {
  if (!joyRect) joyRect = dom.joystick.getBoundingClientRect();
  const cx = joyRect.left + joyRect.width * 0.5;
  const cy = joyRect.top + joyRect.height * 0.5;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const radius = joyRect.width * 0.32;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(radius, len);
  input.x = (dx / len) * (clamped / radius);
  input.y = (dy / len) * (clamped / radius);
  updateStickVisual();
}

dom.joystick.addEventListener('pointerdown', (e) => {
  joyActive = true;
  joyPointerId = e.pointerId;
  joyRect = dom.joystick.getBoundingClientRect();
  dom.joystick.setPointerCapture(e.pointerId);
  readJoystick(e.clientX, e.clientY);
});

dom.joystick.addEventListener('pointermove', (e) => {
  if (!joyActive || e.pointerId !== joyPointerId) return;
  readJoystick(e.clientX, e.clientY);
});

function releaseJoystick(e) {
  if (!joyActive || (e && e.pointerId !== joyPointerId)) return;
  joyActive = false;
  joyPointerId = null;
  input.x = 0;
  input.y = 0;
  updateStickVisual();
}

dom.joystick.addEventListener('pointerup', releaseJoystick);
dom.joystick.addEventListener('pointercancel', releaseJoystick);

dom.boostBtn.addEventListener('pointerdown', () => { input.boost = true; });
dom.boostBtn.addEventListener('pointerup', () => { input.boost = false; });
dom.boostBtn.addEventListener('pointercancel', () => { input.boost = false; });
dom.boostBtn.addEventListener('pointerleave', () => { input.boost = false; });

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.keyboard.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.keyboard.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.keyboard.up = true;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.keyboard.down = true;
  if (e.code === 'Space') input.boost = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.keyboard.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.keyboard.right = false;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.keyboard.up = false;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.keyboard.down = false;
  if (e.code === 'Space') input.boost = false;
});

function updateShip(dt, t) {
  const kx = (input.keyboard.right ? 1 : 0) - (input.keyboard.left ? 1 : 0);
  const ky = (input.keyboard.up ? 1 : 0) - (input.keyboard.down ? 1 : 0);
  const tx = THREE.MathUtils.clamp(input.x + kx, -1, 1);
  const ty = THREE.MathUtils.clamp(input.y - ky, -1, 1);

  ship.position.x = THREE.MathUtils.lerp(ship.position.x, tx * laneWidth, 0.10);
  ship.position.y = THREE.MathUtils.lerp(ship.position.y, -ty * laneHeight, 0.10);
  clampShip();

  ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, -tx * 0.42, 0.10);
  ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, ship.position.y * 0.12, 0.10);
  ship.rotation.y = THREE.MathUtils.lerp(ship.rotation.y, -tx * 0.12, 0.10);

  const wantsBoost = input.boost;
  state.boost = THREE.MathUtils.lerp(state.boost, wantsBoost ? 1 : 0, wantsBoost ? 0.08 : 0.04);
  state.speed = THREE.MathUtils.lerp(state.speed, state.speedBase + state.boost * 14, 0.08);

  const jetLen = 0.78 + state.boost * 0.75 + Math.sin(t * 16.0) * 0.05;
  shipFx.jetA.scale.set(1, jetLen, 1);
  shipFx.jetB.scale.set(1, jetLen, 1);
  shipFx.trail.scale.set(1, 1 + state.boost * 0.7, 1 + state.boost * 0.8);
  shipFx.halo.rotation.z += 0.02 + state.boost * 0.04;
}

function updateWorld(dt, t) {
  const forward = state.speed * dt;
  state.route += forward * 0.18;
  state.energy -= dt * (1.8 + state.boost * 4.4);
  state.score += forward * (1 + state.boost * 0.25);

  corridor.children.forEach((ring, i) => {
    ring.position.z += forward;
    ring.rotation.z += 0.002 + i * 0.00005;
    if (ring.position.z > 14) ring.position.z -= 200;
  });

  rails.children.forEach((rail) => {
    rail.position.z += forward;
    if (rail.position.z > 10) rail.position.z -= 200;
  });

  const starPositions = stars.geometry.attributes.position.array;
  for (let i = 0; i < starPositions.length; i += 3) {
    starPositions[i + 2] += forward * 0.9;
    if (starPositions[i + 2] > 8) {
      starPositions[i] = (Math.random() - 0.5) * 28;
      starPositions[i + 1] = (Math.random() - 0.5) * 22;
      starPositions[i + 2] = -200;
    }
  }
  stars.geometry.attributes.position.needsUpdate = true;

  gates.forEach((gate) => {
    gate.position.z += forward;
    gate.rotation.z += 0.01;
    gate.material.opacity = 0.22 + (0.5 + 0.5 * Math.sin(t * 2.4 + gate.userData.pulse)) * 0.16;

    const dz = Math.abs(gate.position.z);
    const dx = Math.abs(gate.position.x - ship.position.x);
    const dy = Math.abs(gate.position.y - ship.position.y);

    if (!gate.userData.hit && dz < 0.85 && dx < 1.05 && dy < 1.05) {
      gate.userData.hit = true;
      state.gates += 1;
      state.score += 220;
      state.energy = Math.min(100, state.energy + 14);
      state.blink = 1;
    }

    if (gate.position.z > 8) respawnGate(gate);
  });

  crystals.forEach((crystal) => {
    crystal.position.z += forward;
    crystal.rotation.x += 0.02 * crystal.userData.spin;
    crystal.rotation.y += 0.03 * crystal.userData.spin;
    crystal.position.y += Math.sin(t * crystal.userData.spin + crystal.position.x) * 0.004;

    const dz = Math.abs(crystal.position.z);
    const dx = Math.abs(crystal.position.x - ship.position.x);
    const dy = Math.abs(crystal.position.y - ship.position.y);

    if (!crystal.userData.hit && dz < 0.80 && dx < 0.48 && dy < 0.48) {
      crystal.userData.hit = true;
      state.crystals += 1;
      state.score += 80;
      state.energy = Math.min(100, state.energy + 6);
      state.blink = 1;
      respawnCrystal(crystal);
    }

    if (crystal.position.z > 8) respawnCrystal(crystal);
  });

  bgUniforms.uBoost.value = state.boost;
}

function updateCamera(dt) {
  const targetX = ship.position.x * 0.20;
  const targetY = ship.position.y * 0.16 + 0.72;
  const targetZ = 8.25 - state.boost * 0.55;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.06);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.06);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.06);
  camera.lookAt(ship.position.x * 0.25, ship.position.y * 0.16, -3.6);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  bgUniforms.uTime.value = t;
  state.blink = THREE.MathUtils.lerp(state.blink, 0, 0.08);

  if (state.running) {
    updateShip(dt, t);
    updateWorld(dt, t);
    updateCamera(dt);
    updateHUD();

    if (state.route >= routeTarget) finish(true);
    if (state.energy <= 0) finish(false);
  } else {
    ship.rotation.y += 0.005;
    ship.position.y = Math.sin(t * 1.6) * 0.08;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.76, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 8.4, 0.05);
    camera.lookAt(0, 0, -4.0);
  }

  const flash = 1 + state.blink * 0.06;
  ship.scale.setScalar(flash);
  renderer.render(scene, camera);
}

resetState();
showGameplayUI(false);
animate();
