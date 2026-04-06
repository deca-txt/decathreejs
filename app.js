import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/postprocessing/UnrealBloomPass.js';

const app = document.getElementById('app');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const startScreen = document.getElementById('startScreen');
const endScreen = document.getElementById('endScreen');
const endTitle = document.getElementById('endTitle');
const endEyebrow = document.getElementById('endEyebrow');
const endSummary = document.getElementById('endSummary');
const endScore = document.getElementById('endScore');
const endCombo = document.getElementById('endCombo');
const endEnergy = document.getElementById('endEnergy');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const timeEl = document.getElementById('time');
const energyTextEl = document.getElementById('energyText');
const energyFillEl = document.getElementById('energyFill');
const phaseTextEl = document.getElementById('phaseText');
const streakTextEl = document.getElementById('streakText');
const centerMessage = document.getElementById('centerMessage');
const centerEyebrow = document.getElementById('centerEyebrow');
const centerTitle = document.getElementById('centerTitle');
const centerBody = document.getElementById('centerBody');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07101f, 0.03);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0, 10.8);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
app.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.9,
  0.75,
  0.2
);
composer.addPass(bloomPass);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const root = new THREE.Group();
const stage = new THREE.Group();
root.add(stage);
scene.add(root);

const ambient = new THREE.AmbientLight(0xbfdcff, 1.2);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(5, 4, 8);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x78c7ff, 1.6);
fillLight.position.set(-6, 1, 4);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x9fe2ff, 28, 40, 1.6);
rimLight.position.set(0, 0, 6);
scene.add(rimLight);

const goldLight = new THREE.PointLight(0xffe7a6, 12, 24, 1.8);
goldLight.position.set(0, 1.5, 2);
scene.add(goldLight);

const bgUniforms = { uTime: { value: 0 }, uPhase: { value: 0 } };
const bgMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: bgUniforms,
  vertexShader: `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec3 vPos;
    uniform float uTime;
    uniform float uPhase;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash(i + vec3(0.0, 0.0, 0.0));
      float n100 = hash(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash(i + vec3(1.0, 1.0, 1.0));

      float nx00 = mix(n000, n100, f.x);
      float nx10 = mix(n010, n110, f.x);
      float nx01 = mix(n001, n101, f.x);
      float nx11 = mix(n011, n111, f.x);

      float nxy0 = mix(nx00, nx10, f.y);
      float nxy1 = mix(nx01, nx11, f.y);
      return mix(nxy0, nxy1, f.z);
    }

    void main() {
      vec3 dir = normalize(vPos);
      float t = uTime * 0.04;
      float ang = atan(dir.y, dir.x);
      float band = 0.5 + 0.5 * sin(ang * 6.0 + uTime * 0.25 + dir.z * 3.0);
      float mist = noise(dir * 5.0 + vec3(t, -t * 1.2, t * 0.5));
      float mist2 = noise(dir * 9.0 - vec3(t * 1.5, t * 0.8, t));
      float stars = step(0.996, noise(dir * 38.0 + uTime * 0.02));
      float horizon = pow(1.0 - abs(dir.y), 2.8);
      float phaseGlow = smoothstep(0.3, 1.0, uPhase);

      vec3 base = mix(vec3(0.02, 0.04, 0.08), vec3(0.04, 0.08, 0.18), horizon);
      vec3 cleanBlue = vec3(0.55, 0.78, 1.0) * band * 0.12;
      vec3 whiteHalo = vec3(1.0) * (mist * 0.08 + mist2 * 0.04) * (0.5 + horizon);
      vec3 goldHalo = vec3(1.0, 0.90, 0.68) * phaseGlow * horizon * 0.07;
      vec3 color = base + cleanBlue + whiteHalo + goldHalo + vec3(stars) * 0.9;

      gl_FragColor = vec4(color, 1.0);
    }
  `
});
const bg = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 64), bgMat);
scene.add(bg);

const dustGeo = new THREE.BufferGeometry();
const dustCount = 2200;
const dustPos = new Float32Array(dustCount * 3);
const dustColor = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  const r = 14 + Math.random() * 22;
  const a = Math.random() * Math.PI * 2;
  const b = Math.acos(2 * Math.random() - 1);
  const x = r * Math.sin(b) * Math.cos(a);
  const y = r * Math.sin(b) * Math.sin(a);
  const z = r * Math.cos(b);
  const idx = i * 3;
  dustPos[idx] = x;
  dustPos[idx + 1] = y;
  dustPos[idx + 2] = z;
  const tone = 0.7 + Math.random() * 0.3;
  dustColor[idx] = tone;
  dustColor[idx + 1] = 0.9 + Math.random() * 0.1;
  dustColor[idx + 2] = 1.0;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColor, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  size: 0.065,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true
}));
scene.add(dust);

const pulseRingMat = new THREE.MeshBasicMaterial({
  color: 0xbfeaff,
  transparent: true,
  opacity: 0.28,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.03, 20, 200), pulseRingMat.clone());
ringOuter.rotation.x = 1.2;
stage.add(ringOuter);
const ringInner = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.02, 20, 160), pulseRingMat.clone());
ringInner.material.color.set(0xffffff);
ringInner.material.opacity = 0.16;
ringInner.rotation.y = 1.05;
ringInner.rotation.x = 0.4;
stage.add(ringInner);

const shellGeo = new THREE.IcosahedronGeometry(1.7, 4);
const shellMat = new THREE.MeshPhysicalMaterial({
  color: 0xf4fbff,
  emissive: 0x8dd9ff,
  emissiveIntensity: 0.65,
  roughness: 0.08,
  metalness: 0.02,
  transmission: 0.78,
  thickness: 1.6,
  transparent: true,
  opacity: 0.92,
  ior: 1.3,
  clearcoat: 1,
  clearcoatRoughness: 0.08
});
const shell = new THREE.Mesh(shellGeo, shellMat);
stage.add(shell);

const shellWire = new THREE.LineSegments(
  new THREE.WireframeGeometry(shellGeo),
  new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.11
  })
);
shellWire.scale.setScalar(1.04);
stage.add(shellWire);

const coreUniforms = {
  uTime: { value: 0 },
  uCharge: { value: 0 },
  uCritical: { value: 0 },
  uPulse: { value: 0 }
};

const coreMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: coreUniforms,
  vertexShader: `
    varying vec3 vPos;
    varying vec3 vNormal;
    void main() {
      vPos = position;
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec3 vPos;
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uCharge;
    uniform float uCritical;
    uniform float uPulse;

    void main() {
      float r = length(vPos);
      float glow = smoothstep(0.88, 0.0, r);
      float wave = 0.5 + 0.5 * sin(uTime * 3.0 + r * 10.0 + vNormal.y * 3.0);
      float wave2 = 0.5 + 0.5 * sin(uTime * 4.8 - vPos.y * 7.0 + vPos.x * 4.0);
      vec3 base = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), uCharge * 0.9);
      vec3 critical = vec3(1.0, 0.92, 0.72);
      vec3 color = mix(base, critical, uCritical * 0.7);
      color *= glow * (0.72 + wave * 0.6 + wave2 * 0.35 + uPulse * 0.8);
      gl_FragColor = vec4(color, glow * (0.8 + uPulse * 0.2));
    }
  `
});

const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 48), coreMat);
stage.add(core);

const halo = new THREE.Mesh(
  new THREE.SphereGeometry(1.22, 40, 40),
  new THREE.MeshBasicMaterial({
    color: 0xbfeaff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
stage.add(halo);

const criticalNodes = new THREE.Group();
stage.add(criticalNodes);
const criticalNodeMeshes = [];
for (let i = 0; i < 3; i++) {
  const node = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  criticalNodes.add(node);
  criticalNodeMeshes.push(node);
}

const shardGroup = new THREE.Group();
stage.add(shardGroup);
const shards = [];

function createShard(isRare = false) {
  const geometry = new THREE.OctahedronGeometry(isRare ? 0.26 : 0.2, 0);
  const material = new THREE.MeshPhysicalMaterial({
    color: isRare ? 0xfff4c7 : 0xf6fcff,
    emissive: isRare ? 0xffd86a : 0x98ddff,
    emissiveIntensity: isRare ? 1.25 : 0.95,
    roughness: 0.12,
    metalness: 0.1,
    transmission: 0.55,
    thickness: 0.8,
    transparent: true,
    opacity: 0.98,
    clearcoat: 1
  });

  const mesh = new THREE.Mesh(geometry, material);
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(isRare ? 0.48 : 0.42, 18, 18),
    new THREE.MeshBasicMaterial({
      color: isRare ? 0xfff0bc : 0xc5ecff,
      transparent: true,
      opacity: isRare ? 0.14 : 0.10,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  mesh.add(aura);

  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(isRare ? 0.62 : 0.55, 18, 18),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mesh.add(hitArea);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(isRare ? 0.48 : 0.42, 0.03, 16, 60),
    new THREE.MeshBasicMaterial({
      color: isRare ? 0xffefb7 : 0xffffff,
      transparent: true,
      opacity: isRare ? 0.28 : 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  ring.rotation.x = Math.PI / 2;
  mesh.add(ring);

  mesh.userData = {
    isShard: true,
    isRare,
    aura,
    hitArea,
    ring,
    orbitRadius: 3 + Math.random() * 1.2,
    orbitSpeed: (0.2 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1),
    verticalSpeed: 0.8 + Math.random() * 1.4,
    angle: Math.random() * Math.PI * 2,
    yPhase: Math.random() * Math.PI * 2,
    active: true,
    cooldown: 0,
    bonus: isRare ? 16 : 7
  };

  shardGroup.add(mesh);
  shards.push(mesh);
}

for (let i = 0; i < 7; i++) createShard(false);
createShard(true);

const burstGroup = new THREE.Group();
stage.add(burstGroup);
const bursts = [];
function spawnBurst(position, rare = false) {
  const count = rare ? 20 : 12;
  for (let i = 0; i < count; i++) {
    const sprite = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + Math.random() * 0.04, 8, 8),
      new THREE.MeshBasicMaterial({
        color: rare ? 0xffedb1 : 0xd7f2ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    sprite.position.copy(position);
    burstGroup.add(sprite);
    bursts.push({
      mesh: sprite,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * (rare ? 0.14 : 0.10),
        (Math.random() - 0.5) * (rare ? 0.14 : 0.10),
        (Math.random() - 0.5) * (rare ? 0.14 : 0.10)
      ),
      life: rare ? 1.2 : 0.85
    });
  }
}

const state = {
  running: false,
  ended: false,
  score: 0,
  combo: 1,
  maxCombo: 1,
  streak: 0,
  energy: 0,
  phase: 1,
  totalTime: 75,
  timeLeft: 75,
  pulse: 0,
  phaseFlash: 0,
  criticalWindow: false,
  lastHitAt: 0,
  comboDecay: 2.2,
  centerMessageTimer: 0,
  targetCameraX: 0,
  targetCameraY: 0,
  pointerDown: false,
  startX: 0,
  startY: 0,
  moved: false
};

const tempV = new THREE.Vector3();

function formatScore(value) {
  return String(Math.floor(value)).padStart(6, '0');
}

function updateHUD() {
  scoreEl.textContent = formatScore(state.score);
  comboEl.textContent = `x${state.combo}`;
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
  const energyPercent = Math.min(100, Math.round(state.energy));
  energyTextEl.textContent = `${energyPercent}%`;
  energyFillEl.style.width = `${energyPercent}%`;
  streakTextEl.textContent = `Sequência ${state.streak}`;

  if (state.phase === 1) phaseTextEl.textContent = 'Fase 01 · Boot';
  if (state.phase === 2) phaseTextEl.textContent = 'Fase 02 · Sync';
  if (state.phase === 3) phaseTextEl.textContent = 'Fase 03 · Critical';
}

function showCenterMessage(eyebrow, title, body) {
  centerEyebrow.textContent = eyebrow;
  centerTitle.textContent = title;
  centerBody.textContent = body;
  centerMessage.classList.remove('hidden');
  centerMessage.classList.add('visible');
  state.centerMessageTimer = 2.1;
}

function hideCenterMessage() {
  centerMessage.classList.remove('visible');
  state.centerMessageTimer = 0;
  window.setTimeout(() => centerMessage.classList.add('hidden'), 260);
}

function setPhase(nextPhase) {
  state.phase = nextPhase;
  state.phaseFlash = 1.0;
  if (nextPhase === 2) {
    showCenterMessage('FASE 02', 'Sincronização ampliada', 'O núcleo liberou mais energia. Os fragmentos aceleraram.');
    state.totalTime += 12;
    state.timeLeft += 12;
    bloomPass.strength = 1.05;
    bloomPass.radius = 0.82;
  }
  if (nextPhase === 3) {
    showCenterMessage('FASE 03', 'Critical aperture', 'Agora toque nos pulsos críticos expostos ao redor do núcleo.');
    state.criticalWindow = true;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.9;
  }
}

function resetShard(shard, preserveRare = true) {
  const data = shard.userData;
  if (!preserveRare && data.isRare) return;
  data.angle = Math.random() * Math.PI * 2;
  data.orbitRadius = data.isRare ? 3.7 + Math.random() * 0.8 : 3 + Math.random() * 1.2;
  data.yPhase = Math.random() * Math.PI * 2;
  data.cooldown = 0;
  data.active = true;
  shard.visible = true;
}

function resetGame() {
  state.running = false;
  state.ended = false;
  state.score = 0;
  state.combo = 1;
  state.maxCombo = 1;
  state.streak = 0;
  state.energy = 0;
  state.phase = 1;
  state.totalTime = 75;
  state.timeLeft = 75;
  state.pulse = 0;
  state.phaseFlash = 0;
  state.criticalWindow = false;
  state.lastHitAt = 0;
  state.centerMessageTimer = 0;
  state.targetCameraX = 0;
  state.targetCameraY = 0;
  hideCenterMessage();
  endScreen.classList.remove('visible');
  startScreen.classList.add('visible');
  bloomPass.strength = 0.9;
  bloomPass.radius = 0.75;

  criticalNodeMeshes.forEach((node, i) => {
    node.material.opacity = 0;
    node.scale.setScalar(1);
    node.userData.angleOffset = i * ((Math.PI * 2) / 3);
  });

  bursts.splice(0, bursts.length).forEach((b) => burstGroup.remove(b.mesh));
  shards.forEach((shard) => resetShard(shard, true));
  updateHUD();
}

function startGame() {
  state.running = true;
  state.ended = false;
  startScreen.classList.remove('visible');
  endScreen.classList.remove('visible');
  clock.start();
}

function endGame(success) {
  if (state.ended) return;
  state.ended = true;
  state.running = false;

  endEyebrow.textContent = success ? 'SUCESSO' : 'TEMPO ESGOTADO';
  endTitle.textContent = success ? 'Núcleo estabilizado' : 'Sincronização incompleta';
  endSummary.textContent = success
    ? 'A experiência chegou ao estado final com sucesso.'
    : 'Você chegou perto. Reinicie para uma nova tentativa.';
  endScore.textContent = formatScore(state.score);
  endCombo.textContent = `x${state.maxCombo}`;
  endEnergy.textContent = `${Math.round(state.energy)}%`;
  endScreen.classList.add('visible');
}

function chargeGain(base, rare = false) {
  const phaseMultiplier = state.phase === 3 ? 0.9 : state.phase === 2 ? 1.05 : 1.0;
  const comboMultiplier = Math.min(2.5, 1 + (state.combo - 1) * 0.08);
  const gain = base * phaseMultiplier * comboMultiplier * (rare ? 1.35 : 1);
  return gain;
}

function scoreGain(base, rare = false) {
  return Math.round(base * 20 * Math.min(3, 1 + (state.combo - 1) * 0.12) * (rare ? 2.2 : 1));
}

function onSuccessfulHit(position, rare = false, isCritical = false) {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.streak += 1;
  state.lastHitAt = performance.now() / 1000;
  const baseCharge = isCritical ? 10 : rare ? 9 : 4.2;
  state.energy = Math.min(100, state.energy + chargeGain(baseCharge, rare));
  state.score += scoreGain(baseCharge, rare);
  state.pulse = rare ? 1.0 : 0.72;
  spawnBurst(position, rare || isCritical);

  if (state.phase === 1 && state.energy >= 34) setPhase(2);
  if (state.phase === 2 && state.energy >= 70) setPhase(3);
  if (state.energy >= 100) endGame(true);

  updateHUD();
}

function onMiss() {
  state.combo = 1;
  state.streak = 0;
  updateHUD();
}

function tryHit(clientX, clientY) {
  if (!state.running || state.ended) return;

  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hitTargets = [];
  shards.forEach((shard) => {
    if (shard.visible && shard.userData.active) hitTargets.push(shard.userData.hitArea);
  });
  if (state.criticalWindow) {
    criticalNodeMeshes.forEach((node) => hitTargets.push(node));
  }

  const intersections = raycaster.intersectObjects(hitTargets, false);
  if (!intersections.length) {
    onMiss();
    return;
  }

  const hit = intersections[0].object;
  const parent = hit.parent;

  if (parent && parent.userData.isShard && parent.userData.active) {
    const data = parent.userData;
    data.active = false;
    data.cooldown = data.isRare ? 1.5 : 0.75;
    parent.visible = false;
    onSuccessfulHit(parent.getWorldPosition(new THREE.Vector3()), data.isRare, false);
    return;
  }

  if (state.criticalWindow && criticalNodeMeshes.includes(hit)) {
    const pos = hit.getWorldPosition(new THREE.Vector3());
    hit.material.opacity = 0.25;
    hit.scale.setScalar(0.78);
    onSuccessfulHit(pos, true, true);
    return;
  }

  onMiss();
}

function updateCriticalNodes(t) {
  criticalNodeMeshes.forEach((node, index) => {
    const angle = t * 1.4 + index * ((Math.PI * 2) / 3);
    const radius = 1.95 + Math.sin(t * 2 + index) * 0.04;
    node.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * 1.15) * 0.5,
      Math.sin(angle) * radius * 0.35
    );
    const criticalOpacity = state.criticalWindow ? 0.25 + Math.sin(t * 4.4 + index) * 0.12 + state.phaseFlash * 0.15 : 0.0;
    node.material.opacity = THREE.MathUtils.lerp(node.material.opacity, Math.max(0, criticalOpacity), 0.12);
    const scale = 1 + Math.sin(t * 5 + index) * 0.08 + state.pulse * 0.08;
    node.scale.setScalar(state.criticalWindow ? scale : 0.8);
  });
}

function updateShards(t, dt) {
  shards.forEach((shard) => {
    const data = shard.userData;

    if (!data.active) {
      data.cooldown -= dt;
      if (data.cooldown <= 0) resetShard(shard, true);
      return;
    }

    data.angle += data.orbitSpeed * dt;
    const radiusBias = state.phase === 3 ? 0.15 : state.phase === 2 ? 0.08 : 0;
    const r = data.orbitRadius + Math.sin(t * 0.9 + data.yPhase) * radiusBias;
    const x = Math.cos(data.angle) * r;
    const y = Math.sin(data.angle * 1.3 + data.yPhase) * 1.2;
    const z = Math.sin(data.angle) * 1.2;
    shard.position.set(x, y, z);
    shard.rotation.x += dt * (0.8 + Math.abs(data.orbitSpeed));
    shard.rotation.y += dt * (1.2 + Math.abs(data.orbitSpeed));
    shard.rotation.z += dt * 0.6;

    const pulse = 1 + Math.sin(t * 4 + data.angle * 2.5) * 0.08 + state.pulse * 0.1;
    shard.scale.setScalar(data.isRare ? pulse * 1.05 : pulse);
    data.aura.material.opacity = data.isRare ? 0.18 + Math.sin(t * 5) * 0.04 : 0.10 + Math.sin(t * 4 + data.angle) * 0.03;
    data.ring.rotation.z += dt * (data.isRare ? 1.6 : 1.1);
  });
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const burst = bursts[i];
    burst.life -= dt;
    if (burst.life <= 0) {
      burstGroup.remove(burst.mesh);
      bursts.splice(i, 1);
      continue;
    }
    burst.mesh.position.addScaledVector(burst.velocity, dt * 12);
    burst.mesh.material.opacity = Math.max(0, burst.life);
    burst.mesh.scale.setScalar(0.8 + (1 - burst.life) * 1.8);
  }
}

function updateState(dt, t) {
  if (state.running && !state.ended) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endGame(false);
    }

    const now = performance.now() / 1000;
    if (now - state.lastHitAt > state.comboDecay && state.combo > 1) {
      state.combo = Math.max(1, state.combo - 1);
      state.lastHitAt = now - (state.comboDecay - 0.3);
      updateHUD();
    }
  }

  state.pulse = THREE.MathUtils.lerp(state.pulse, 0, dt * 2.8);
  state.phaseFlash = THREE.MathUtils.lerp(state.phaseFlash, 0, dt * 1.6);

  if (state.centerMessageTimer > 0) {
    state.centerMessageTimer -= dt;
    if (state.centerMessageTimer <= 0) hideCenterMessage();
  }

  const charge01 = THREE.MathUtils.clamp(state.energy / 100, 0, 1);
  coreUniforms.uCharge.value = charge01;
  coreUniforms.uCritical.value = state.phase === 3 ? 1 : 0;
  coreUniforms.uPulse.value = state.pulse;
  bgUniforms.uPhase.value = charge01;

  shell.material.emissiveIntensity = 0.55 + charge01 * 0.6 + state.phaseFlash * 0.2;
  shell.material.opacity = 0.84 + charge01 * 0.12;
  halo.material.opacity = 0.08 + charge01 * 0.16 + state.pulse * 0.08;
  ringOuter.material.opacity = 0.22 + charge01 * 0.12;
  ringInner.material.opacity = 0.12 + charge01 * 0.08;

  ringOuter.rotation.z += dt * (0.18 + charge01 * 0.14);
  ringInner.rotation.y -= dt * (0.24 + charge01 * 0.18);

  root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, state.targetCameraX, 0.05);
  root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, state.targetCameraY, 0.05);

  const idleWave = Math.sin(t * 0.55) * 0.08;
  stage.rotation.y += dt * (0.12 + charge01 * 0.09);
  shell.rotation.y -= dt * 0.18;
  shell.rotation.x += dt * 0.08;
  shellWire.rotation.y += dt * 0.22;
  core.scale.setScalar(1 + Math.sin(t * 3.2) * 0.04 + charge01 * 0.12 + state.pulse * 0.12);
  halo.scale.setScalar(1 + charge01 * 0.18 + state.pulse * 0.22);
  stage.position.y = idleWave;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, state.targetCameraX * 1.8, 0.045);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, -state.targetCameraY * 1.4, 0.045);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 10.5 - charge01 * 0.65, 0.05);
  camera.lookAt(0, 0, 0);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  bgUniforms.uTime.value = t;
  coreUniforms.uTime.value = t;

  dust.rotation.y += dt * 0.008;
  dust.rotation.x = Math.sin(t * 0.08) * 0.05;

  updateShards(t, dt);
  updateCriticalNodes(t);
  updateBursts(dt);
  updateState(dt, t);
  composer.render();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

function updateTargetFromPointer(clientX, clientY) {
  const nx = (clientX / window.innerWidth) * 2 - 1;
  const ny = (clientY / window.innerHeight) * 2 - 1;
  state.targetCameraX = nx * 0.18;
  state.targetCameraY = ny * 0.12;
}

window.addEventListener('pointerdown', (event) => {
  state.pointerDown = true;
  state.startX = event.clientX;
  state.startY = event.clientY;
  state.moved = false;
  updateTargetFromPointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointermove', (event) => {
  if (!state.pointerDown) return;
  const dx = event.clientX - state.startX;
  const dy = event.clientY - state.startY;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) state.moved = true;
  updateTargetFromPointer(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerup', (event) => {
  if (!state.pointerDown) return;
  const dx = event.clientX - state.startX;
  const dy = event.clientY - state.startY;
  const tapDistance = Math.hypot(dx, dy);
  if (!state.moved && tapDistance < 14) {
    tryHit(event.clientX, event.clientY);
  }
  state.pointerDown = false;
}, { passive: true });

window.addEventListener('pointercancel', () => {
  state.pointerDown = false;
}, { passive: true });

fullscreenBtn.addEventListener('click', async () => {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) await document.exitFullscreen();
    return;
  }
  if (document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      // iPhone fallback: silently ignore
    }
  }
});

document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.textContent = document.fullscreenElement ? 'Sair' : 'Tela cheia';
});

startBtn.addEventListener('click', () => {
  resetGame();
  startGame();
});

restartBtn.addEventListener('click', () => {
  resetGame();
  startGame();
});

window.addEventListener('resize', onResize);

resetGame();
clock.start();
animate();
