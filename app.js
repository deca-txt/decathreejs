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
const phaseLabel = document.getElementById("phaseLabel");
const objectiveText = document.getElementById("objectiveText");
const statusText = document.getElementById("statusText");
const streakValue = document.getElementById("streakValue");
const bonusValue = document.getElementById("bonusValue");
const statusToast = document.getElementById("statusToast");

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
renderer.toneMappingExposure = 1.18;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050815, 0.045);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0.2, 8.6);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

const world = new THREE.Group();
const pivot = new THREE.Group();
scene.add(world);
world.add(pivot);

const ambient = new THREE.AmbientLight(0x8ba1ff, 0.8);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0x89ffff, 3.3);
keyLight.position.set(5, 4, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff67d9, 2.6);
rimLight.position.set(-5, -3, 4);
scene.add(rimLight);

const glowLight = new THREE.PointLight(0x6d88ff, 5.4, 18, 2);
glowLight.position.set(0, 0, 2.4);
scene.add(glowLight);

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
      float n1 = noise(d * 4.2 + vec3(t, -t * 1.3, t * 0.7));
      float n2 = noise(d * 8.8 + vec3(-t * 0.9, t * 0.5, -t));
      float nebula = smoothstep(0.32, 0.95, n1 * 0.75 + n2 * 0.5);
      float horizon = pow(1.0 - abs(d.y), 2.0);
      float arc = 0.5 + 0.5 * sin(atan(d.z, d.x) * 6.0 + uTime * 0.4 + d.y * 3.2);
      float energy = smoothstep(0.0, 1.0, uEnergy);

      vec3 deep = vec3(0.015, 0.025, 0.06);
      vec3 blue = vec3(0.05, 0.12, 0.30);
      vec3 cyan = vec3(0.03, 0.55, 0.90);
      vec3 pink = vec3(0.78, 0.08, 0.64);
      vec3 color = mix(deep, blue, horizon);
      color += mix(cyan, pink, arc) * horizon * (0.16 + energy * 0.34);
      color += vec3(0.14, 0.56, 1.0) * nebula * (0.16 + energy * 0.16);
      color += vec3(1.0, 0.24, 0.82) * nebula * horizon * (0.05 + energy * 0.12);

      gl_FragColor = vec4(color, 1.0);
    }
  `
});

scene.add(new THREE.Mesh(new THREE.SphereGeometry(48, 64, 64), bgMaterial));

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
      float angle = atan(vWorldPos.y, vWorldPos.x);
      float bands = 0.5 + 0.5 * sin(angle * 12.0 + uTime * (2.8 + uEnergy * 2.8));
      float electric = 0.5 + 0.5 * sin(vWorldPos.z * 9.0 - uTime * 4.2 + angle * 6.6);
      vec3 a = vec3(0.05, 0.54, 1.0);
      vec3 b = vec3(1.0, 0.15, 0.80);
      vec3 c = vec3(0.48, 1.0, 0.98);
      vec3 color = mix(a, b, bands);
      color = mix(color, c, electric * 0.45);
      color *= 0.58 + fresnel * 1.95 + uPulse * 1.3 + uEnergy * 0.9;
      float alpha = 0.12 + fresnel * 0.76 + bands * 0.08 + uPulse * 0.14 + uEnergy * 0.1;
      gl_FragColor = vec4(color, alpha);
    }
  `
});

const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.11, 40, 240), portalMaterial);
ringA.rotation.x = 1.08;
ringA.rotation.y = 0.16;
pivot.add(ringA);

const ringB = new THREE.Mesh(
  new THREE.TorusGeometry(3.0, 0.03, 20, 220),
  new THREE.MeshBasicMaterial({
    color: 0x8ef8ff,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
ringB.rotation.x = -1.05;
ringB.rotation.z = 0.44;
pivot.add(ringB);

const ringC = new THREE.Mesh(
  new THREE.TorusGeometry(2.15, 0.022, 20, 180),
  new THREE.MeshBasicMaterial({
    color: 0xff60d8,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
ringC.rotation.y = 1.15;
ringC.rotation.x = 0.48;
pivot.add(ringC);

const haloMaterial = new THREE.MeshBasicMaterial({
  color: 0x82f7ff,
  transparent: true,
  opacity: 0.1,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const halo = new THREE.Mesh(new THREE.CircleGeometry(2.85, 64), haloMaterial);
halo.rotation.x = -Math.PI * 0.5;
halo.position.y = -1.1;
pivot.add(halo);

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
        sin(position.y * 7.0 + uTime * 1.9) * 0.03 +
        sin(position.x * 9.0 - uTime * 1.3) * 0.026 +
        sin(position.z * 8.0 + uTime * 1.5) * 0.022;
      wobble *= 1.0 + uEnergy * 0.7 + uPulse * 0.55;
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
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.9);
      float iri = 0.5 + 0.5 * sin(N.y * 7.0 + N.x * 4.2 + uTime * 1.5 + vWave * 18.0);
      float stripe = 0.5 + 0.5 * sin((N.z + N.x) * 12.0 - uTime * (1.7 + uEnergy * 1.6));
      vec3 deepBlue = vec3(0.07, 0.28, 0.96);
      vec3 magenta = vec3(0.98, 0.20, 0.78);
      vec3 cyan = vec3(0.20, 0.98, 1.00);
      vec3 color = mix(deepBlue, magenta, iri);
      color = mix(color, cyan, stripe * 0.42);
      color *= 0.62 + fresnel * 1.35 + uPulse * 0.24 + uEnergy * 0.5;
      color += vec3(1.0) * fresnel * (0.28 + uEnergy * 0.22);
      gl_FragColor = vec4(color, 0.98);
    }
  `
});

const coreGeo = new THREE.IcosahedronGeometry(1.18, 5);
const core = new THREE.Mesh(coreGeo, coreMaterial);
pivot.add(core);

const wire = new THREE.LineSegments(
  new THREE.WireframeGeometry(coreGeo),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 })
);
wire.scale.setScalar(1.055);
pivot.add(wire);

const innerCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.72, 36, 36),
  new THREE.ShaderMaterial({
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
        color *= glow * (1.0 + uPulse * 1.2 + uEnergy * 0.6);
        gl_FragColor = vec4(color, glow * 0.94);
      }
    `
  })
);
pivot.add(innerCore);

const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 1.15, 6.0, 32, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x8af7ff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
beam.rotation.z = Math.PI * 0.5;
pivot.add(beam);

const reticle = new THREE.Mesh(
  new THREE.TorusGeometry(1.58, 0.012, 12, 100),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
reticle.rotation.x = Math.PI * 0.5;
pivot.add(reticle);

scene.add(createStarField(2600, 8.0, 25.0, 0.055));
const mist = createStarField(1200, 3.0, 6.5, 0.04, true);
pivot.add(mist);

const trailGroup = new THREE.Group();
pivot.add(trailGroup);
for (let i = 0; i < 3; i++) {
  const trail = new THREE.Mesh(
    new THREE.TorusGeometry(2.0 + i * 0.42, 0.008, 8, 160),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x88f8ff : 0xff61d6,
      transparent: true,
      opacity: 0.14 - i * 0.025,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  trail.rotation.x = 1.12 + i * 0.2;
  trail.rotation.z = i * 0.6;
  trailGroup.add(trail);
}

const targetGroup = new THREE.Group();
pivot.add(targetGroup);
const targets = [];
const targetRaycastables = [];
createTargets();

let running = false;
let gameStartedOnce = false;
let timeLeft = 50;
let score = 0;
let combo = 1;
let bestCombo = 1;
let streak = 0;
let energy = 0;
let phase = 1;
let pulse = 0;
let toastTimer = 0;
let totalHits = 0;
let bonusActive = false;
let bonusTimer = 0;

let cameraRotX = 0;
let cameraRotY = 0;
let targetCameraRotX = 0;
let targetCameraRotY = 0;
let dragActive = false;
let downX = 0;
let downY = 0;
let moved = false;

function createStarField(count, minR, maxR, size, near = false) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const p = randomSpherePoint(minR, maxR);
    positions[idx] = p.x;
    positions[idx + 1] = p.y;
    positions[idx + 2] = p.z;

    const palettes = near
      ? [
          [0.56, 0.92, 1.0],
          [1.0, 0.52, 0.88],
          [1.0, 0.84, 0.44]
        ]
      : [
          [0.56, 0.92, 1.0],
          [1.0, 0.52, 0.88],
          [0.72, 0.76, 1.0],
          [1.0, 1.0, 1.0]
        ];
    const palette = palettes[Math.floor(Math.random() * palettes.length)];
    colors[idx] = palette[0];
    colors[idx + 1] = palette[1];
    colors[idx + 2] = palette[2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: near ? 0.78 : 0.92,
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

function createTargets() {
  const baseMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x9dfbff,
      emissive: 0x4ef0ff,
      emissiveIntensity: 0.9,
      roughness: 0.24,
      metalness: 0.72
    }),
    new THREE.MeshStandardMaterial({
      color: 0xff8bdd,
      emissive: 0xff56cf,
      emissiveIntensity: 0.8,
      roughness: 0.26,
      metalness: 0.75
    }),
    new THREE.MeshStandardMaterial({
      color: 0xc2c9ff,
      emissive: 0x6c82ff,
      emissiveIntensity: 0.76,
      roughness: 0.3,
      metalness: 0.72
    })
  ];

  const bonusMaterial = new THREE.MeshStandardMaterial({
    color: 0xffefb0,
    emissive: 0xffd768,
    emissiveIntensity: 1.2,
    roughness: 0.18,
    metalness: 0.82
  });

  for (let i = 0; i < 7; i++) {
    const geometry = i % 2 === 0
      ? new THREE.OctahedronGeometry(0.18 + Math.random() * 0.05)
      : new THREE.IcosahedronGeometry(0.16 + Math.random() * 0.045, 0);
    const material = baseMaterials[i % baseMaterials.length].clone();
    const mesh = new THREE.Mesh(geometry, material);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.012, 8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.rotation.x = Math.PI * 0.5;
    mesh.add(halo);

    mesh.userData = {
      angle: (Math.PI * 2 * i) / 7,
      radius: 2.2 + Math.random() * 1.1,
      height: (Math.random() - 0.5) * 1.8,
      speed: 0.45 + Math.random() * 0.42,
      wobble: 0.8 + Math.random() * 1.2,
      wobbleOffset: Math.random() * Math.PI * 2,
      baseScale: 1,
      cooldown: 0,
      isBonus: false,
      defaultMaterial: material,
      bonusMaterial,
      halo,
      value: 100 + Math.floor(Math.random() * 40)
    };

    targetGroup.add(mesh);
    targets.push(mesh);
    targetRaycastables.push(mesh);
  }
}

function activateRandomBonus() {
  if (bonusActive) return;
  const available = targets.filter((target) => target.userData.cooldown <= 0.05 && !target.userData.isBonus);
  if (!available.length) return;
  const target = available[Math.floor(Math.random() * available.length)];
  target.userData.isBonus = true;
  target.material = target.userData.bonusMaterial;
  target.userData.halo.material.color.setHex(0xffd768);
  target.userData.halo.material.opacity = 0.34;
  bonusActive = true;
  bonusTimer = 6.5;
  bonusValue.textContent = "ON";
  setToast("Alvo raro ativo. O fragmento dourado rende carga extra.");
}

function clearBonus(target = null) {
  const bonusTarget = target || targets.find((item) => item.userData.isBonus);
  if (bonusTarget) {
    bonusTarget.userData.isBonus = false;
    bonusTarget.material = bonusTarget.userData.defaultMaterial;
    bonusTarget.userData.halo.material.color.setHex(0xffffff);
    bonusTarget.userData.halo.material.opacity = 0.2;
  }
  bonusActive = false;
  bonusTimer = 0;
  bonusValue.textContent = "OFF";
}

function setToast(message, duration = 2.2) {
  statusToast.textContent = message;
  statusToast.classList.remove("hidden");
  toastTimer = duration;
}

function setStatus(message) {
  statusText.textContent = message;
}

function formatScore(value) {
  return String(Math.max(0, Math.floor(value))).padStart(6, "0");
}

function updateUI() {
  scoreValue.textContent = formatScore(score);
  comboValue.textContent = `x${combo}`;
  timeValue.textContent = `${Math.max(0, timeLeft).toFixed(1)}s`;
  energyValue.textContent = `${Math.round(energy)}%`;
  energyFill.style.width = `${THREE.MathUtils.clamp(energy, 0, 100)}%`;
  streakValue.textContent = String(streak);
  phaseLabel.textContent = `Fase 0${phase}`;
  objectiveText.textContent = energy >= 100
    ? "Núcleo estabilizado"
    : phase === 1
      ? "Carregue o núcleo até 34%"
      : phase === 2
        ? "Empurre a carga até 67%"
        : "Finalize a ativação até 100%";
}

function resetTargets() {
  clearBonus();
  targets.forEach((target, index) => {
    target.userData.angle = (Math.PI * 2 * index) / targets.length;
    target.userData.radius = 2.1 + Math.random() * 1.2;
    target.userData.height = (Math.random() - 0.5) * 1.7;
    target.userData.cooldown = 0;
    target.userData.baseScale = 1;
    target.scale.setScalar(1);
    target.material = target.userData.defaultMaterial;
    target.userData.halo.material.color.setHex(0xffffff);
    target.userData.halo.material.opacity = 0.2;
  });
}

function resetGame() {
  running = false;
  timeLeft = 50;
  score = 0;
  combo = 1;
  bestCombo = 1;
  streak = 0;
  energy = 0;
  phase = 1;
  pulse = 0;
  totalHits = 0;
  toastTimer = 0;
  resetTargets();
  setStatus("Arraste para inclinar a câmera. Toque rápido para subir o combo.");
  setToast("Toque nos fragmentos brilhantes. O fragmento dourado vale mais.", 9999);
  updateUI();
}

function startGame() {
  resetGame();
  running = true;
  gameStartedOnce = true;
  statusToast.classList.remove("hidden");
  startOverlay.classList.remove("visible");
  endOverlay.classList.remove("visible");
  setToast("Missão iniciada. Gere energia antes do tempo acabar.", 2.4);
}

function endGame(won) {
  running = false;
  endOverlay.classList.add("visible");
  endEyebrow.textContent = won ? "NÚCLEO ESTABILIZADO" : "MISSÃO ENCERRADA";
  endTitle.textContent = won ? "Vitória" : "Tempo esgotado";
  endMessage.textContent = won
    ? "Você completou a carga máxima e estabilizou o Chrono Core."
    : "Faltou energia para concluir a ativação. Tente acelerar o combo e aproveitar o alvo raro.";
  endScore.textContent = formatScore(score);
  endCombo.textContent = `x${bestCombo}`;
  endEnergy.textContent = `${Math.round(energy)}%`;
}

function setPhaseFromEnergy() {
  const newPhase = energy >= 67 ? 3 : energy >= 34 ? 2 : 1;
  if (newPhase !== phase) {
    phase = newPhase;
    setToast(phase === 2 ? "Fase 02: a órbita acelerou." : "Fase 03: núcleo em sobrecarga visual.");
  }
}

function registerMiss() {
  if (!running) return;
  combo = 1;
  streak = 0;
  setStatus("Toque vazio. O combo foi reiniciado.");
  setToast("Toque vazio. Mire nos fragmentos orbitais.", 1.2);
  updateUI();
}

function collectTarget(target) {
  if (!running || target.userData.cooldown > 0.01) return;

  totalHits += 1;
  combo += 1;
  streak += 1;
  bestCombo = Math.max(bestCombo, combo);

  const isBonus = target.userData.isBonus;
  const baseValue = isBonus ? 280 : target.userData.value;
  const comboFactor = 1 + Math.min(combo - 1, 10) * 0.14;
  const gain = Math.round(baseValue * comboFactor);
  const energyGain = isBonus ? 13 : 4.2 + Math.min(combo, 9) * 0.85;

  score += gain;
  energy = Math.min(100, energy + energyGain);
  pulse = 1;
  target.userData.cooldown = 0.4;
  target.userData.angle += Math.PI * (0.7 + Math.random() * 0.5);
  target.userData.height = (Math.random() - 0.5) * 1.7;
  target.userData.radius = 2.0 + Math.random() * 1.3;

  if (isBonus) {
    setStatus(`Fragmento raro capturado. +${Math.round(energyGain)}% de carga.`);
    setToast(`Alvo raro capturado. +${gain} pontos.`, 1.6);
    clearBonus(target);
  } else if (combo >= 6 && combo % 3 === 0) {
    setStatus(`Combo x${combo}. Continue para manter a sobrecarga.`);
    setToast(`Combo x${combo}.`, 1.1);
  } else {
    setStatus("Boa. Continue tocando para crescer o combo.");
  }

  if (!bonusActive && totalHits > 0 && totalHits % 6 === 0) {
    activateRandomBonus();
  }

  setPhaseFromEnergy();
  updateUI();

  if (energy >= 100) {
    endGame(true);
  }
}

function updateTargets(time, dt) {
  let rareTargetVisible = false;

  targets.forEach((target, index) => {
    const data = target.userData;
    data.cooldown = Math.max(0, data.cooldown - dt);

    const speedBoost = 1 + phase * 0.18 + energy * 0.005;
    data.angle += data.speed * dt * speedBoost * (index % 2 === 0 ? 1 : -1);
    const radius = data.radius + Math.sin(time * data.wobble + data.wobbleOffset) * 0.18;
    const y = data.height + Math.cos(time * (0.8 + data.wobble * 0.3) + data.wobbleOffset) * 0.3;
    const z = Math.sin(time * 0.7 + data.wobbleOffset) * 0.65;

    target.position.set(
      Math.cos(data.angle) * radius,
      y,
      Math.sin(data.angle) * radius * 0.58 + z
    );

    const scaleTarget = data.cooldown > 0.01 ? 0.74 : data.isBonus ? 1.22 : 1.0;
    data.baseScale = THREE.MathUtils.lerp(data.baseScale, scaleTarget, 0.12);
    target.scale.setScalar(data.baseScale + Math.sin(time * 5.5 + data.wobbleOffset) * 0.035);
    target.rotation.x += dt * (1.4 + index * 0.12);
    target.rotation.y += dt * (1.2 + index * 0.08);

    target.material.emissiveIntensity = data.isBonus
      ? 1.45 + Math.sin(time * 10.0) * 0.15
      : 0.72 + Math.sin(time * 6.0 + index) * 0.12 + energy * 0.004;

    target.userData.halo.rotation.z += dt * (0.8 + index * 0.1);
    target.userData.halo.material.opacity = data.isBonus
      ? 0.28 + Math.sin(time * 8.0) * 0.06
      : 0.16 + Math.sin(time * 4.0 + index) * 0.03;

    if (data.isBonus) rareTargetVisible = true;
  });

  if (bonusActive) {
    bonusTimer -= dt;
    if (bonusTimer <= 0 || !rareTargetVisible) {
      clearBonus();
      setToast("Alvo raro expirou.", 1.2);
    }
  }
}

function updateWorld(time, dt) {
  pulse = THREE.MathUtils.lerp(pulse, 0, dt * 6.5);

  cameraRotX = THREE.MathUtils.lerp(cameraRotX, targetCameraRotX, 0.06);
  cameraRotY = THREE.MathUtils.lerp(cameraRotY, targetCameraRotY, 0.06);

  pivot.rotation.x = cameraRotX + Math.sin(time * 0.38) * 0.06;
  pivot.rotation.y = cameraRotY + time * (0.22 + energy * 0.0018);
  pivot.rotation.z = Math.sin(time * 0.2) * 0.035;

  ringA.rotation.z += dt * (0.55 + energy * 0.005);
  ringB.rotation.y += dt * (0.7 + energy * 0.006);
  ringC.rotation.x -= dt * (0.62 + energy * 0.005);
  trailGroup.rotation.z -= dt * (0.32 + phase * 0.07);
  trailGroup.rotation.y += dt * 0.18;

  halo.scale.setScalar(1 + pulse * 0.18 + energy * 0.0018);
  reticle.rotation.z += dt * (0.24 + phase * 0.04);
  reticle.scale.setScalar(1 + pulse * 0.1 + energy * 0.001);

  core.rotation.y += dt * (0.48 + energy * 0.004);
  core.rotation.x += dt * 0.16;
  wire.rotation.y -= dt * 0.56;
  innerCore.scale.setScalar(1 + pulse * 0.12 + energy * 0.0018);
  beam.scale.y = 1 + pulse * 0.16 + energy * 0.001;
  beam.material.opacity = 0.05 + energy * 0.001 + pulse * 0.05;

  mist.rotation.z += dt * 0.05;
  mist.rotation.y -= dt * 0.07;

  bgUniforms.uTime.value = time;
  bgUniforms.uEnergy.value = energy / 100;
  portalUniforms.uTime.value = time;
  portalUniforms.uEnergy.value = energy / 100;
  portalUniforms.uPulse.value = pulse;
  coreUniforms.uTime.value = time;
  coreUniforms.uEnergy.value = energy / 100;
  coreUniforms.uPulse.value = pulse;

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraRotY * 0.85, 0.04);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, -targetCameraRotX * 0.72 + 0.2, 0.04);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 8.3 - pulse * 0.25 - phase * 0.08, 0.04);
  camera.lookAt(0, 0, 0);
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);
  const time = clock.elapsedTime;

  if (running) {
    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft <= 0 && energy < 100) {
      endGame(false);
    }
  }

  if (toastTimer > 0 && toastTimer < 900) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      statusToast.classList.add("hidden");
    }
  }

  updateTargets(time, dt);
  updateWorld(time, dt);
  updateUI();

  renderer.render(scene, camera);
}

function getEventPoint(event) {
  if (event.changedTouches && event.changedTouches[0]) {
    return event.changedTouches[0];
  }
  if (event.touches && event.touches[0]) {
    return event.touches[0];
  }
  return event;
}

function setPointerRotation(x, y) {
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  targetCameraRotY = nx * 0.48;
  targetCameraRotX = ny * 0.22;
}

function tryHitTarget(clientX, clientY) {
  pointerNdc.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(targetRaycastables, false);
  if (hits.length > 0) {
    collectTarget(hits[0].object);
  } else {
    registerMiss();
  }
}

function onPointerDown(event) {
  const point = getEventPoint(event);
  downX = point.clientX;
  downY = point.clientY;
  dragActive = true;
  moved = false;
}

function onPointerMove(event) {
  if (!dragActive) return;
  const point = getEventPoint(event);
  const dx = point.clientX - downX;
  const dy = point.clientY - downY;
  if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
  setPointerRotation(point.clientX, point.clientY);
}

function onPointerUp(event) {
  if (!dragActive) return;
  dragActive = false;
  const point = getEventPoint(event);
  setPointerRotation(point.clientX, point.clientY);
  if (!moved && running) {
    tryHitTarget(point.clientX, point.clientY);
  }
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
    return;
  }
  if (app.requestFullscreen) {
    try {
      await app.requestFullscreen();
    } catch (error) {
      setToast("No iPhone, abrir pela Tela de Início costuma ficar melhor.", 2.6);
    }
  } else {
    setToast("Este navegador pode limitar tela cheia. Use a Tela de Início no iPhone.", 2.6);
  }
}

function onFullscreenChange() {
  fullscreenBtn.textContent = document.fullscreenElement ? "Sair" : "Tela cheia";
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

window.addEventListener("resize", onResize);
if (window.PointerEvent) {
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
} else {
  window.addEventListener("touchstart", onPointerDown, { passive: true });
  window.addEventListener("touchmove", onPointerMove, { passive: true });
  window.addEventListener("touchend", onPointerUp, { passive: true });
}

document.addEventListener("fullscreenchange", onFullscreenChange);
fullscreenBtn.addEventListener("click", toggleFullscreen);
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

resetGame();
animate();

if (window.navigator.standalone === true) {
  fullscreenBtn.style.display = "none";
}

if (!gameStartedOnce) {
  setPointerRotation(window.innerWidth * 0.5, window.innerHeight * 0.5);
}
