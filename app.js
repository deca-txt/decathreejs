import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const app = document.getElementById("app");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const startOverlay = document.getElementById("startOverlay");
const endOverlay = document.getElementById("endOverlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const scoreValue = document.getElementById("scoreValue");
const comboValue = document.getElementById("comboValue");
const timeValue = document.getElementById("timeValue");
const energyValue = document.getElementById("energyValue");
const energyFill = document.getElementById("energyFill");
const objectiveText = document.getElementById("objectiveText");
const statusText = document.getElementById("statusText");
const phaseValue = document.getElementById("phaseValue");
const streakValue = document.getElementById("streakValue");

const endEyebrow = document.getElementById("endEyebrow");
const endTitle = document.getElementById("endTitle");
const endMessage = document.getElementById("endMessage");
const endScore = document.getElementById("endScore");
const endCombo = document.getElementById("endCombo");
const endEnergy = document.getElementById("endEnergy");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050714, 0.042);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.4, 8.5);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2(0, 0);
const tempVec3 = new THREE.Vector3();

const world = new THREE.Group();
const pivot = new THREE.Group();
world.add(pivot);
scene.add(world);

const ambient = new THREE.AmbientLight(0x6d7cff, 0.9);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0x83faff, 3.2);
keyLight.position.set(5, 4, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff4bc8, 2.5);
rimLight.position.set(-4, -2, 3);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x7185ff, 4, 18, 2);
fillLight.position.set(0, 0, 2.5);
scene.add(fillLight);

const bgUniforms = {
  uTime: { value: 0 },
  uEnergy: { value: 0 }
};

const bgMaterial = new THREE.ShaderMaterial({
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
    uniform float uEnergy;

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
      vec3 d = normalize(vDir);
      float t = uTime * 0.045;
      float n1 = noise(d * 4.5 + vec3(t, -t * 1.4, t * 0.8));
      float n2 = noise(d * 10.0 + vec3(-t * 0.7, t * 0.6, -t));
      float nebula = smoothstep(0.3, 0.92, n1 * 0.72 + n2 * 0.45);
      float horizon = pow(1.0 - abs(d.y), 2.1);
      float arc = 0.5 + 0.5 * sin(atan(d.z, d.x) * 6.0 + uTime * 0.35 + d.y * 3.0);
      float energized = smoothstep(0.0, 1.0, uEnergy);

      vec3 deep = vec3(0.02, 0.03, 0.08);
      vec3 blue = vec3(0.06, 0.14, 0.34);
      vec3 cyan = vec3(0.04, 0.53, 0.85);
      vec3 pink = vec3(0.78, 0.08, 0.64);
      vec3 aurora = mix(cyan, pink, arc);

      vec3 color = mix(deep, blue, horizon);
      color += aurora * horizon * (0.18 + energized * 0.35);
      color += vec3(0.20, 0.62, 1.0) * nebula * (0.16 + energized * 0.18);
      color += vec3(1.00, 0.22, 0.82) * nebula * horizon * (0.06 + energized * 0.12);

      gl_FragColor = vec4(color, 1.0);
    }
  `
});

const bgSphere = new THREE.Mesh(new THREE.SphereGeometry(45, 64, 64), bgMaterial);
scene.add(bgSphere);

const portalUniforms = {
  uTime: { value: 0 },
  uEnergy: { value: 0 },
  uPulse: { value: 0 }
};

const portalMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: portalUniforms,
  vertexShader: `
    varying vec3 vNormalW;
    varying vec3 vWorldPos;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec3 vNormalW;
    varying vec3 vWorldPos;
    uniform vec3 cameraPosition;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uPulse;

    void main() {
      vec3 N = normalize(vNormalW);
      vec3 V = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - abs(dot(N, V)), 3.2);
      float ang = atan(vWorldPos.y, vWorldPos.x);
      float bands = 0.5 + 0.5 * sin(ang * 11.0 + uTime * (2.8 + uEnergy * 2.3));
      float electric = 0.5 + 0.5 * sin(vWorldPos.z * 10.0 - uTime * 4.0 + ang * 7.0);
      vec3 a = vec3(0.05, 0.52, 1.0);
      vec3 b = vec3(1.0, 0.15, 0.80);
      vec3 c = vec3(0.48, 1.0, 0.98);
      vec3 color = mix(a, b, bands);
      color = mix(color, c, electric * 0.45);
      color *= 0.55 + fresnel * 1.9 + uPulse * 1.25 + uEnergy * 0.8;
      float alpha = 0.16 + fresnel * 0.76 + bands * 0.08 + uPulse * 0.12 + uEnergy * 0.08;
      gl_FragColor = vec4(color, alpha);
    }
  `
});

const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.13, 40, 240), portalMaterial);
ringA.rotation.x = 1.12;
ringA.rotation.y = 0.18;
pivot.add(ringA);

const ringB = new THREE.Mesh(
  new THREE.TorusGeometry(3.25, 0.035, 20, 220),
  new THREE.MeshBasicMaterial({
    color: 0x8ef8ff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
ringB.rotation.x = -1.05;
ringB.rotation.z = 0.42;
pivot.add(ringB);

const ringC = new THREE.Mesh(
  new THREE.TorusGeometry(2.25, 0.02, 20, 180),
  new THREE.MeshBasicMaterial({
    color: 0xff62d4,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
ringC.rotation.y = 1.08;
ringC.rotation.x = 0.45;
pivot.add(ringC);

const coreUniforms = {
  uTime: { value: 0 },
  uEnergy: { value: 0 },
  uPulse: { value: 0 }
};

const coreMaterial = new THREE.ShaderMaterial({
  uniforms: coreUniforms,
  transparent: true,
  vertexShader: `
    varying vec3 vNormalW;
    varying vec3 vWorldPos;
    varying float vWave;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uPulse;

    void main() {
      float wobble =
        sin(position.y * 7.0 + uTime * 1.7) * 0.03 +
        sin(position.x * 9.0 - uTime * 1.2) * 0.025 +
        sin(position.z * 8.0 + uTime * 1.5) * 0.02;
      wobble *= 1.0 + uEnergy * 0.6 + uPulse * 0.4;
      vec3 displaced = position + normal * wobble;
      vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
      vWorldPos = worldPos.xyz;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vWave = wobble;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec3 vNormalW;
    varying vec3 vWorldPos;
    varying float vWave;
    uniform vec3 cameraPosition;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uPulse;

    void main() {
      vec3 N = normalize(vNormalW);
      vec3 V = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
      float iri = 0.5 + 0.5 * sin(N.y * 7.0 + N.x * 4.0 + uTime * 1.4 + vWave * 18.0);
      float stripe = 0.5 + 0.5 * sin((N.z + N.x) * 12.0 - uTime * (1.8 + uEnergy * 1.6));
      vec3 deepBlue = vec3(0.07, 0.28, 0.96);
      vec3 magenta = vec3(0.98, 0.20, 0.78);
      vec3 cyan = vec3(0.20, 0.98, 1.00);
      vec3 color = mix(deepBlue, magenta, iri);
      color = mix(color, cyan, stripe * 0.45);
      color *= 0.62 + fresnel * 1.35 + uPulse * 0.18 + uEnergy * 0.45;
      color += vec3(1.0) * fresnel * (0.32 + uEnergy * 0.16);
      gl_FragColor = vec4(color, 0.96);
    }
  `
});

const coreGeo = new THREE.IcosahedronGeometry(1.34, 4);
const core = new THREE.Mesh(coreGeo, coreMaterial);
pivot.add(core);

const wire = new THREE.LineSegments(
  new THREE.WireframeGeometry(coreGeo),
  new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.16
  })
);
wire.scale.setScalar(1.05);
pivot.add(wire);

const innerCoreMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: coreUniforms,
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
    uniform float uEnergy;
    uniform float uPulse;

    void main() {
      float r = length(vPos);
      float glow = smoothstep(0.78, 0.0, r);
      float pulse = 0.5 + 0.5 * sin(uTime * (4.0 + uEnergy * 4.0) + r * 12.0);
      vec3 color = mix(vec3(0.2, 0.7, 1.0), vec3(1.0, 0.15, 0.7), pulse);
      color *= glow * (1.0 + uPulse * 1.1 + uEnergy * 0.55);
      gl_FragColor = vec4(color, glow * 0.92);
    }
  `
});

const innerCore = new THREE.Mesh(new THREE.SphereGeometry(0.76, 42, 42), innerCoreMaterial);
pivot.add(innerCore);

const beamMaterial = new THREE.MeshBasicMaterial({
  color: 0x87f7ff,
  transparent: true,
  opacity: 0.09,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 1.25, 5.8, 32, 1, true), beamMaterial);
beam.rotation.z = Math.PI * 0.5;
pivot.add(beam);

const stars = createStarField(2600, 7.5, 24.0, 0.055);
scene.add(stars);
const mist = createStarField(1200, 3.0, 6.5, 0.04, true);
pivot.add(mist);

const orbiterGroup = new THREE.Group();
pivot.add(orbiterGroup);
const orbs = [];
for (let i = 0; i < 3; i++) {
  const orb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18 + i * 0.03),
    new THREE.MeshStandardMaterial({
      color: [0x8df6ff, 0xff85dc, 0xa9b3ff][i],
      emissive: [0x4edfff, 0xff4bd0, 0x6277ff][i],
      emissiveIntensity: 0.8,
      roughness: 0.35,
      metalness: 0.75
    })
  );
  orbiterGroup.add(orb);
  orbs.push(orb);
}

const targetGroup = new THREE.Group();
pivot.add(targetGroup);
const targets = [];
const targetCount = 7;
const targetPalette = [0x7ef7ff, 0xff68d4, 0xaab6ff, 0x86ffb8];
const targetGeometries = [
  new THREE.OctahedronGeometry(0.24, 0),
  new THREE.TetrahedronGeometry(0.28, 0),
  new THREE.IcosahedronGeometry(0.22, 0)
];

for (let i = 0; i < targetCount; i++) {
  const root = new THREE.Group();
  root.userData.isTarget = true;
  root.userData.baseScale = 1;
  root.userData.collectAnim = 0;
  root.userData.t = Math.random() * Math.PI * 2;
  root.userData.radius = 2.5 + Math.random() * 1.25;
  root.userData.yAmp = 0.7 + Math.random() * 0.55;
  root.userData.speed = 0.35 + Math.random() * 0.45;
  root.userData.seed = Math.random() * 10;
  root.userData.value = 8 + Math.floor(Math.random() * 5);

  const body = new THREE.Mesh(
    targetGeometries[i % targetGeometries.length],
    new THREE.MeshStandardMaterial({
      color: targetPalette[i % targetPalette.length],
      emissive: targetPalette[i % targetPalette.length],
      emissiveIntensity: 0.95,
      roughness: 0.28,
      metalness: 0.65
    })
  );
  root.add(body);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 20),
    new THREE.MeshBasicMaterial({
      color: targetPalette[(i + 1) % targetPalette.length],
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  root.add(shell);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.02, 10, 60),
    new THREE.MeshBasicMaterial({
      color: targetPalette[i % targetPalette.length],
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  halo.rotation.x = Math.PI / 2;
  root.add(halo);

  root.userData.body = body;
  root.userData.shell = shell;
  root.userData.halo = halo;

  targetGroup.add(root);
  targets.push(root);
}

const burstParticles = [];
const burstGeometry = new THREE.SphereGeometry(0.035, 8, 8);

function createBurst(color = 0xffffff) {
  const mesh = new THREE.Mesh(
    burstGeometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  mesh.visible = false;
  scene.add(mesh);
  burstParticles.push({
    mesh,
    velocity: new THREE.Vector3(),
    life: 0,
    maxLife: 0
  });
}

for (let i = 0; i < 42; i++) createBurst();

const game = {
  state: "idle",
  duration: 45,
  timer: 45,
  score: 0,
  combo: 1,
  streak: 0,
  bestCombo: 1,
  energy: 0,
  pulse: 0,
  phase: 1,
  missFlash: 0,
  overdrive: 0
};

const interaction = {
  isDown: false,
  dragging: false,
  downX: 0,
  downY: 0,
  targetRotX: 0,
  targetRotY: 0,
  rotX: 0,
  rotY: 0,
  autoRotY: 0
};

function createStarField(count, minR, maxR, size, local = false) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const p = randomSpherePoint(minR, maxR);
    const i3 = i * 3;
    positions[i3] = p.x;
    positions[i3 + 1] = p.y;
    positions[i3 + 2] = p.z;

    const palette = [
      [0.52, 0.88, 1.0],
      [1.0, 0.44, 0.86],
      [0.70, 0.74, 1.0],
      [1.0, 1.0, 1.0]
    ][Math.floor(Math.random() * 4)];

    colors[i3] = palette[0];
    colors[i3 + 1] = palette[1];
    colors[i3 + 2] = palette[2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: local ? 0.62 : 0.95,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending
    })
  );
}

function randomSpherePoint(minR, maxR) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = minR + Math.random() * (maxR - minR);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
}

function formatScore(value) {
  return Math.max(0, Math.floor(value)).toString().padStart(6, "0");
}

function setOverlay(overlay, visible) {
  overlay.classList.toggle("visible", visible);
}

function resetGame() {
  game.state = "idle";
  game.timer = game.duration;
  game.score = 0;
  game.combo = 1;
  game.streak = 0;
  game.bestCombo = 1;
  game.energy = 0;
  game.pulse = 0;
  game.phase = 1;
  game.missFlash = 0;
  game.overdrive = 0;
  updateHud();
  statusText.textContent = "Arraste para inclinar a câmera. Toque rápido nos alvos para subir o combo.";
  objectiveText.textContent = "Alcance 100% de energia";
}

function startGame() {
  resetGame();
  setOverlay(startOverlay, false);
  setOverlay(endOverlay, false);
  game.state = "running";
  statusText.textContent = "Missão iniciada. Colete fragmentos luminosos.";
}

function endGame(victory) {
  if (game.state === "ended") return;
  game.state = "ended";
  setOverlay(endOverlay, true);
  endEyebrow.textContent = victory ? "NÚCLEO ATIVADO" : "TEMPO ESGOTADO";
  endTitle.textContent = victory ? "Missão concluída" : "Carga insuficiente";
  endMessage.textContent = victory
    ? "Você atingiu a carga máxima e abriu o portal. Ótimo material para demo no iPhone."
    : "Você não chegou a 100% a tempo, mas o cenário continua ótimo para testar toque, HUD e gameplay.";
  endScore.textContent = formatScore(game.score);
  endCombo.textContent = `x${game.bestCombo}`;
  endEnergy.textContent = `${Math.round(game.energy)}%`;
}

function updateHud() {
  scoreValue.textContent = formatScore(game.score);
  comboValue.textContent = `x${game.combo}`;
  timeValue.textContent = `${Math.max(0, game.timer).toFixed(1)}s`;
  energyValue.textContent = `${Math.round(game.energy)}%`;
  energyFill.style.width = `${THREE.MathUtils.clamp(game.energy, 0, 100)}%`;
  phaseValue.textContent = String(game.phase).padStart(2, "0");
  streakValue.textContent = `${game.streak}`;
}

function refreshPhase() {
  const nextPhase = game.energy >= 66 ? 3 : game.energy >= 33 ? 2 : 1;
  if (nextPhase !== game.phase) {
    game.phase = nextPhase;
    game.pulse = 1;
    statusText.textContent = `Fase ${String(game.phase).padStart(2, "0")} liberada. O portal respondeu ao seu progresso.`;
  }
}

function setPointerFromEvent(clientX, clientY) {
  pointerNdc.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNdc.y = -(clientY / window.innerHeight) * 2 + 1;
}

function attemptHit(clientX, clientY) {
  if (game.state !== "running") return;
  setPointerFromEvent(clientX, clientY);
  raycaster.setFromCamera(pointerNdc, camera);

  const intersections = raycaster.intersectObjects(targets, true);
  const firstTargetHit = intersections.find((hit) => {
    let obj = hit.object;
    while (obj && obj !== scene) {
      if (obj.userData?.isTarget) return true;
      obj = obj.parent;
    }
    return false;
  });

  if (!firstTargetHit) {
    registerMiss();
    return;
  }

  let target = firstTargetHit.object;
  while (target && !target.userData?.isTarget) {
    target = target.parent;
  }
  if (target) collectTarget(target, firstTargetHit.point);
}

function registerMiss() {
  game.combo = 1;
  game.streak = 0;
  game.missFlash = 1;
  statusText.textContent = "Toque limpo: mire nos fragmentos brilhantes para manter o combo.";
  updateHud();
}

function collectTarget(target, hitPoint) {
  const gain = target.userData.value;
  const scoreGain = gain * 100 * game.combo;
  game.score += scoreGain;
  game.streak += 1;
  game.combo = Math.min(game.combo + 1, 12);
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.energy = Math.min(100, game.energy + gain * 0.9 + game.combo * 0.35);
  game.pulse = 1;
  game.overdrive = Math.min(1, game.overdrive + 0.08);
  statusText.textContent = `+${scoreGain} pontos. Sequência em alta.`;
  refreshPhase();
  updateHud();

  target.userData.collectAnim = 1;
  target.userData.t = Math.random() * Math.PI * 2;
  target.userData.radius = 2.35 + Math.random() * 1.55;
  target.userData.yAmp = 0.6 + Math.random() * 0.7;
  target.userData.speed = 0.35 + Math.random() * 0.5;
  target.userData.value = 8 + Math.floor(Math.random() * 5);

  spawnBurst(hitPoint || target.getWorldPosition(tempVec3), target.userData.body.material.color.getHex());

  if (game.energy >= 100) {
    updateHud();
    endGame(true);
  }
}

function spawnBurst(position, color) {
  for (let i = 0; i < burstParticles.length; i++) {
    const item = burstParticles[i];
    if (item.life <= 0) {
      item.mesh.visible = true;
      item.mesh.material.color.setHex(color);
      item.mesh.material.opacity = 0.85;
      item.mesh.position.copy(position);
      item.mesh.scale.setScalar(1);
      item.velocity.copy(randomSpherePoint(0.03, 0.18));
      item.life = 1;
      item.maxLife = 0.35 + Math.random() * 0.35;
    }
  }
}

function updateBursts(dt) {
  for (const item of burstParticles) {
    if (item.life <= 0) continue;
    item.life -= dt;
    const alpha = Math.max(0, item.life / item.maxLife);
    item.mesh.material.opacity = alpha * 0.85;
    item.mesh.position.addScaledVector(item.velocity, dt * 6.5);
    item.mesh.scale.setScalar(1 + (1 - alpha) * 1.7);
    if (item.life <= 0) {
      item.mesh.visible = false;
    }
  }
}

function updateTargets(t, dt) {
  const energyFactor = game.energy / 100;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const data = target.userData;
    const time = t * data.speed + data.seed;
    const phaseScale = 1 + (game.phase - 1) * 0.12;
    const radius = data.radius * phaseScale;

    target.position.set(
      Math.cos(time + i * 0.6) * radius,
      Math.sin(time * 1.35 + i) * data.yAmp,
      Math.sin(time * 0.85 + i * 1.2) * (1.4 + energyFactor * 0.5)
    );

    data.body.rotation.x += dt * (1.4 + i * 0.05);
    data.body.rotation.y += dt * (1.8 + i * 0.07);
    data.halo.rotation.z += dt * (1.5 + i * 0.06);

    const breathing = 1 + Math.sin(t * 3.2 + data.seed) * 0.1;
    const collectScale = 1 + data.collectAnim * 0.75;
    const baseScale = data.baseScale * breathing * collectScale;
    target.scale.setScalar(baseScale);
    data.shell.material.opacity = 0.08 + breathing * 0.06 + energyFactor * 0.08;
    data.halo.material.opacity = 0.18 + breathing * 0.12;
    data.body.material.emissiveIntensity = 0.85 + breathing * 0.3 + energyFactor * 0.45;

    data.collectAnim = Math.max(0, data.collectAnim - dt * 4.5);
  }
}

function updateOrbiters(t) {
  orbs[0].position.set(Math.cos(t * 1.2) * 2.55, Math.sin(t * 1.0) * 0.78, Math.sin(t * 1.25) * 1.2);
  orbs[1].position.set(Math.cos(t * 0.92 + 2.2) * 3.0, Math.sin(t * 1.12 + 1.5) * 1.0, Math.sin(t * 1.45 + 0.6) * 1.38);
  orbs[2].position.set(Math.cos(t * 1.34 + 4.0) * 2.12, Math.sin(t * 0.86 + 2.8) * 1.16, Math.sin(t * 1.62 + 1.8) * 1.52);

  orbs[0].rotation.x += 0.04;
  orbs[0].rotation.y += 0.03;
  orbs[1].rotation.x += 0.03;
  orbs[1].rotation.z += 0.04;
  orbs[2].rotation.y += 0.05;
  orbs[2].rotation.z += 0.03;
}

function updateCamera(dt) {
  interaction.rotX = THREE.MathUtils.lerp(interaction.rotX, interaction.targetRotX, 0.06);
  interaction.rotY = THREE.MathUtils.lerp(interaction.rotY, interaction.targetRotY, 0.06);
  interaction.autoRotY += dt * 0.1;

  const autoY = Math.sin(interaction.autoRotY) * 0.08;
  pivot.rotation.x = interaction.rotX + Math.sin(clock.elapsedTime * 0.42) * 0.06;
  pivot.rotation.y = interaction.rotY + autoY + clock.elapsedTime * 0.24;
  pivot.rotation.z = Math.sin(clock.elapsedTime * 0.2) * 0.04;

  const camTargetX = interaction.targetRotY * 0.68;
  const camTargetY = -interaction.targetRotX * 0.5 + 0.4;
  const camTargetZ = 8.45 - game.pulse * 0.16 - game.overdrive * 0.22;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.035);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTargetY, 0.035);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, camTargetZ, 0.05);
  camera.lookAt(0, 0, 0);
}

function onPointerDown(x, y) {
  interaction.isDown = true;
  interaction.dragging = false;
  interaction.downX = x;
  interaction.downY = y;
}

function onPointerMove(x, y) {
  if (!interaction.isDown) return;
  const dx = x - interaction.downX;
  const dy = y - interaction.downY;
  if (Math.abs(dx) > 7 || Math.abs(dy) > 7) interaction.dragging = true;
  interaction.targetRotY = THREE.MathUtils.clamp(interaction.targetRotY + dx * 0.0028, -0.95, 0.95);
  interaction.targetRotX = THREE.MathUtils.clamp(interaction.targetRotX + dy * 0.0018, -0.55, 0.55);
  interaction.downX = x;
  interaction.downY = y;
}

function onPointerUp(x, y) {
  if (!interaction.dragging) attemptHit(x, y);
  interaction.isDown = false;
}

window.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  onPointerDown(e.clientX, e.clientY);
}, { passive: true });

window.addEventListener("pointermove", (e) => {
  onPointerMove(e.clientX, e.clientY);
}, { passive: true });

window.addEventListener("pointerup", (e) => {
  onPointerUp(e.clientX, e.clientY);
}, { passive: true });

window.addEventListener("pointercancel", () => {
  interaction.isDown = false;
});

startBtn.addEventListener("click", async () => {
  await requestFullscreenMaybe();
  startGame();
});

restartBtn.addEventListener("click", async () => {
  await requestFullscreenMaybe();
  startGame();
});

fullscreenBtn.addEventListener("click", requestFullscreenMaybe);

document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.textContent = document.fullscreenElement ? "Sair" : "Tela cheia";
});

async function requestFullscreenMaybe() {
  if (document.fullscreenElement) return;
  if (!app.requestFullscreen) {
    statusText.textContent = "No iPhone, use Adicionar à Tela de Início para a experiência mais limpa.";
    return;
  }
  try {
    await app.requestFullscreen();
  } catch {
    statusText.textContent = "Tela cheia depende do navegador. No iPhone, a Tela de Início costuma funcionar melhor.";
  }
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  if (game.state === "running") {
    game.timer -= dt;
    if (game.timer <= 0) {
      game.timer = 0;
      updateHud();
      endGame(false);
    }
  }

  game.pulse = THREE.MathUtils.lerp(game.pulse, 0, dt * 8.5);
  game.missFlash = THREE.MathUtils.lerp(game.missFlash, 0, dt * 8.0);
  game.overdrive = THREE.MathUtils.lerp(game.overdrive, 0, dt * 1.2);

  updateCamera(dt);
  updateTargets(t, dt);
  updateOrbiters(t);
  updateBursts(dt);

  ringA.rotation.z += 0.004 + game.phase * 0.0008;
  ringB.rotation.y += 0.005 + game.phase * 0.0012;
  ringC.rotation.x -= 0.0045 + game.phase * 0.001;

  const pulseScale = 1 + game.pulse * 0.11;
  ringA.scale.setScalar(pulseScale);
  ringB.scale.setScalar(1 + game.pulse * 0.06 + game.overdrive * 0.04);
  ringC.scale.setScalar(1 + game.pulse * 0.08 + game.overdrive * 0.06);

  core.rotation.y -= 0.0038 + game.phase * 0.0007;
  core.rotation.x += 0.0019;
  wire.rotation.y += 0.0048 + game.phase * 0.001;
  innerCore.scale.setScalar(1 + game.pulse * 0.2 + game.overdrive * 0.08);

  beam.scale.set(1 + game.energy / 160, 1 + game.energy / 100, 1 + game.energy / 160);
  beamMaterial.opacity = 0.08 + game.energy / 1000 + game.pulse * 0.08;

  stars.rotation.y += 0.0005;
  stars.rotation.x = Math.sin(t * 0.13) * 0.04;
  mist.rotation.z -= 0.0045;
  mist.rotation.y += 0.0028;

  bgUniforms.uTime.value = t;
  bgUniforms.uEnergy.value = game.energy / 100;
  portalUniforms.uTime.value = t;
  portalUniforms.uEnergy.value = game.energy / 100;
  portalUniforms.uPulse.value = game.pulse;
  coreUniforms.uTime.value = t;
  coreUniforms.uEnergy.value = game.energy / 100;
  coreUniforms.uPulse.value = game.pulse;

  renderer.toneMappingExposure = 1.08 + game.energy / 220 + game.pulse * 0.12 - game.missFlash * 0.04;

  updateHud();
  renderer.render(scene, camera);
}

resetGame();
animate();
