import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { locale, randomLine, t } from './i18n.js';
import { initLeaderboard, snapshotPreRunBest, submitFinalScore } from './leaderboard.js';
import { playClick, playCollect, playCrash, playMove, playStart, playWin, resumeAudio } from './sounds.js';
import studentGlb from './assets/gltf/people__student.glb?url';
import teenGlb from './assets/gltf/people__teen.glb?url';
import punkGlb from './assets/gltf/archetypes__punk.glb?url';
import cowboyGlb from './assets/gltf/archetypes__cowboy.glb?url';
import nurseGlb from './assets/gltf/archetypes__nurse.glb?url';
import catGlb from './assets/gltf/animals__cat.glb?url';
import studentSprite from './assets/sprites/people__student.png?url';
import teenSprite from './assets/sprites/people__teen.png?url';
import punkSprite from './assets/sprites/archetypes__punk.png?url';
import cowboySprite from './assets/sprites/archetypes__cowboy.png?url';
import nurseSprite from './assets/sprites/archetypes__nurse.png?url';
import catSprite from './assets/sprites/animals__cat.png?url';

const GAME_MS = 60000;
const GRACE_MS = 1500;
const LANES = [-2.4, 0, 2.4];
const SPAWN_Z = -64;
const REMOVE_Z = 6;
const PLAYER_Z = 0;
const BEST_KEY = 'prism_rush_best';
const CHARACTER_KEY = 'prism_rush_character';
const FRAME_COUNT = 24;
const FRAME_SPACING = 4;
const CHARACTER_OPTIONS = [
  { id: 'student', labelKey: 'character_student', glb: studentGlb, sprite: studentSprite, height: 1.36, y: 0.18, rotY: Math.PI },
  { id: 'teen', labelKey: 'character_teen', glb: teenGlb, sprite: teenSprite, height: 1.32, y: 0.18, rotY: Math.PI },
  { id: 'punk', labelKey: 'character_punk', glb: punkGlb, sprite: punkSprite, height: 1.44, y: 0.15, rotY: Math.PI },
  { id: 'cowboy', labelKey: 'character_cowboy', glb: cowboyGlb, sprite: cowboySprite, height: 1.42, y: 0.13, rotY: Math.PI },
  { id: 'nurse', labelKey: 'character_nurse', glb: nurseGlb, sprite: nurseSprite, height: 1.4, y: 0.15, rotY: Math.PI },
  { id: 'cat', labelKey: 'character_cat', glb: catGlb, sprite: catSprite, height: 0.72, y: 0.2, rotY: Math.PI },
];

const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
const gameScreen = document.getElementById('gameScreen');
const startScreen = document.getElementById('startScreen');
const endScreen = document.getElementById('endScreen');
const startButton = document.getElementById('startButton');
const againButton = document.getElementById('againButton');
const homeButton = document.getElementById('homeButton');
const timeLeftEl = document.getElementById('timeLeft');
const scoreValueEl = document.getElementById('scoreValue');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const maxComboValueEl = document.getElementById('maxComboValue');
const resultLabelEl = document.getElementById('resultLabel');
const comboBadge = document.getElementById('comboBadge');
const laneCue = document.getElementById('laneCue');
const popLayer = document.getElementById('popLayer');
const bubble = document.getElementById('bubble');
const characterPicker = document.getElementById('characterPicker');
const readySprite = document.getElementById('readySprite');
const readyName = document.getElementById('readyName');

document.documentElement.lang = locale;
document.querySelectorAll('[data-i18n]').forEach((el) => {
  el.textContent = t(el.dataset.i18n);
});

const state = {
  phase: 'start',
  score: 0,
  best: Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10),
  combo: 0,
  maxCombo: 0,
  lane: 1,
  targetLane: 1,
  startAt: 0,
  elapsedMs: 0,
  spawnTimer: 0,
  lastTime: 0,
  speed: 18,
  lastGateLane: -1,
  gateStreak: 0,
  cueHidden: false,
  endedBy: 'lose',
  characterId: localStorage.getItem(CHARACTER_KEY) || 'student',
};

const objects = [];
const particles = [];
let objectId = 0;
let bubbleTimer = 0;
let characterLoadToken = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setClearColor(0x08111f, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08111f);
scene.fog = new THREE.Fog(0x0b1d35, 18, 78);

const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 120);
camera.position.set(0, 4.8, 8.8);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.72, 0.58, 0.18);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const ambient = new THREE.HemisphereLight(0x9eeaff, 0x11071f, 1.25);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-3, 7, 6);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0xff8ad8, 3.6, 28, 1.35);
rimLight.position.set(3, 3, -4);
scene.add(rimLight);

const farLight = new THREE.PointLight(0x72f8ff, 4.2, 42, 1.2);
farLight.position.set(0, 3.6, -24);
scene.add(farLight);

const trackGroup = new THREE.Group();
scene.add(trackGroup);

const floorMat = new THREE.MeshStandardMaterial({
  color: 0x111b2e,
  roughness: 0.82,
  metalness: 0.05,
});
const floor = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.08, 96), floorMat);
floor.position.set(0, -0.08, -31);
trackGroup.add(floor);

const laneMat = new THREE.MeshBasicMaterial({ color: 0x72f8ff, transparent: true, opacity: 0.5 });
LANES.forEach((x) => {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 96), laneMat);
  line.position.set(x, 0.01, -31);
  trackGroup.add(line);
});

const frameMatA = new THREE.MeshBasicMaterial({ color: 0x72f8ff, transparent: true, opacity: 0.42 });
const frameMatB = new THREE.MeshBasicMaterial({ color: 0xbc7cff, transparent: true, opacity: 0.34 });
const frames = [];
const frameSideGeo = new THREE.BoxGeometry(0.035, 3.1, 0.055);
const frameTopGeo = new THREE.BoxGeometry(8.0, 0.035, 0.055);
const frameBaseGeo = new THREE.BoxGeometry(8.0, 0.025, 0.055);

for (let i = 0; i < FRAME_COUNT; i += 1) {
  const frame = new THREE.Group();
  const mat = i % 2 === 0 ? frameMatA : frameMatB;
  const left = new THREE.Mesh(frameSideGeo, mat);
  const right = new THREE.Mesh(frameSideGeo, mat);
  const top = new THREE.Mesh(frameTopGeo, mat);
  const base = new THREE.Mesh(frameBaseGeo, mat);
  left.position.set(-4, 1.52, 0);
  right.position.set(4, 1.52, 0);
  top.position.set(0, 3.06, 0);
  base.position.set(0, 0.04, 0);
  frame.add(left, right, top, base);
  frame.position.z = -i * FRAME_SPACING;
  frames.push(frame);
  trackGroup.add(frame);
}

const starCount = 280;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  starPositions[i * 3] = THREE.MathUtils.randFloatSpread(24);
  starPositions[i * 3 + 1] = THREE.MathUtils.randFloat(1.2, 10);
  starPositions[i * 3 + 2] = THREE.MathUtils.randFloat(-76, 10);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({
    color: 0xbc7cff,
    size: 0.055,
    transparent: true,
    opacity: 0.64,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
scene.add(stars);

function glowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 2, 48, 48, 48);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.5, outer);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const player = new THREE.Group();
const playerMat = new THREE.MeshPhysicalMaterial({
  color: 0xfff7aa,
  emissive: 0x245a65,
  emissiveIntensity: 0.62,
  roughness: 0.22,
  metalness: 0.05,
  transmission: 0.16,
  thickness: 1.8,
});
const playerMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 1), playerMat);
playerMesh.rotation.set(0.2, 0.2, 0.2);
playerMesh.scale.set(1.2, 0.28, 0.86);
const playerRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.72, 0.025, 6, 56),
  new THREE.MeshBasicMaterial({ color: 0x72f8ff, transparent: true, opacity: 0.78 }),
);
playerRing.rotation.x = Math.PI / 2;
playerRing.position.y = 0.04;
const playerGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTexture('rgba(114,248,255,0.64)', 'rgba(255,138,216,0.2)'),
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
playerGlow.scale.set(3.2, 3.2, 1);
const characterSlot = new THREE.Group();
characterSlot.position.y = 0.1;
player.add(playerGlow, playerMesh, playerRing, characterSlot);
player.position.set(LANES[state.lane], 0.78, PLAYER_Z);
scene.add(player);

const gltfLoader = new GLTFLoader();
const characterCache = new Map();

const crystalGeo = new THREE.OctahedronGeometry(0.38, 0);
const gateBarGeo = new THREE.BoxGeometry(0.16, 2.5, 0.22);
const gateTopGeo = new THREE.BoxGeometry(1.32, 0.16, 0.22);
const gatePlaneGeo = new THREE.BoxGeometry(1.18, 1.78, 0.08);
const particleGeo = new THREE.OctahedronGeometry(0.075, 0);

const crystalMat = new THREE.MeshStandardMaterial({
  color: 0x72f8ff,
  emissive: 0x1ccde8,
  emissiveIntensity: 1.6,
  roughness: 0.22,
  metalness: 0.08,
});
const crystalPinkMat = new THREE.MeshBasicMaterial({
  color: 0xff8ad8,
  transparent: true,
  opacity: 0.68,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const gateMat = new THREE.MeshStandardMaterial({
  color: 0xff3f5f,
  emissive: 0xff163d,
  emissiveIntensity: 1.8,
  roughness: 0.36,
  metalness: 0.02,
});
const gatePlaneMat = new THREE.MeshBasicMaterial({
  color: 0xff3f5f,
  transparent: true,
  opacity: 0.2,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

function getCharacterOption(id) {
  return CHARACTER_OPTIONS.find((option) => option.id === id) || CHARACTER_OPTIONS[0];
}

function clearCharacterSlot() {
  while (characterSlot.children.length) {
    characterSlot.remove(characterSlot.children[0]);
  }
}

async function loadCharacter(option) {
  const token = ++characterLoadToken;
  try {
    let source = characterCache.get(option.id);
    if (!source) {
      const gltf = await gltfLoader.loadAsync(option.glb);
      source = gltf.scene;
      source.traverse((child) => {
        if (child.isMesh) {
          child.frustumCulled = false;
          if (child.material) {
            child.material.flatShading = true;
            child.material.needsUpdate = true;
          }
        }
      });
      characterCache.set(option.id, source);
    }
    if (token !== characterLoadToken) return;
    const model = source.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? option.height / size.y : 1;
    model.scale.setScalar(scale);
    model.rotation.y = option.rotY;
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    model.position.set(-center.x, option.y - scaledBox.min.y, -center.z - 0.05);
    clearCharacterSlot();
    characterSlot.add(model);
  } catch {
    clearCharacterSlot();
  }
}

function renderCharacterPicker() {
  characterPicker.innerHTML = '';
  CHARACTER_OPTIONS.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pr-character-card';
    button.dataset.character = option.id;
    button.setAttribute('aria-label', t(option.labelKey));
    const img = document.createElement('img');
    img.src = option.sprite;
    img.alt = '';
    img.draggable = false;
    const label = document.createElement('span');
    label.textContent = t(option.labelKey);
    button.append(img, label);
    button.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      selectCharacter(option.id);
    });
    characterPicker.appendChild(button);
  });
  updateCharacterPicker();
}

function updateCharacterPicker() {
  characterPicker.querySelectorAll('.pr-character-card').forEach((button) => {
    const selected = button.dataset.character === state.characterId;
    button.classList.toggle('is-selected', selected);
    if (selected) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  updateReadyCard();
}

function updateReadyCard() {
  const option = getCharacterOption(state.characterId);
  readySprite.src = option.sprite;
  readyName.textContent = t(option.labelKey);
}

function selectCharacter(id) {
  const option = getCharacterOption(id);
  state.characterId = option.id;
  localStorage.setItem(CHARACTER_KEY, option.id);
  updateCharacterPicker();
  loadCharacter(option);
  playClick();
}

function createCrystal(lane) {
  const group = new THREE.Group();
  group.position.set(LANES[lane], 0.9, SPAWN_Z);
  const mesh = new THREE.Mesh(crystalGeo, crystalMat);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.018, 6, 44), crystalPinkMat);
  halo.rotation.x = Math.PI / 2;
  group.add(mesh, halo);
  group.userData.mesh = mesh;
  group.userData.halo = halo;
  return group;
}

function createGate(lane) {
  const group = new THREE.Group();
  group.position.set(LANES[lane], 1.05, SPAWN_Z);
  const left = new THREE.Mesh(gateBarGeo, gateMat);
  const right = new THREE.Mesh(gateBarGeo, gateMat);
  const top = new THREE.Mesh(gateTopGeo, gateMat);
  const panel = new THREE.Mesh(gatePlaneGeo, gatePlaneMat);
  left.position.set(-0.66, 0, 0);
  right.position.set(0.66, 0, 0);
  top.position.set(0, 1.17, 0);
  panel.position.set(0, 0.02, -0.025);
  group.add(left, right, top, panel);
  group.userData.panel = panel;
  return group;
}

function randomLane() {
  return Math.floor(Math.random() * LANES.length);
}

function spawnEvent() {
  const type = Math.random() < 0.62 ? 'crystal' : 'gate';
  let lane = randomLane();
  if (type === 'gate') {
    if (lane === state.lastGateLane) {
      state.gateStreak += 1;
      if (state.gateStreak > 2) {
        lane = (lane + 1 + Math.floor(Math.random() * 2)) % LANES.length;
        state.gateStreak = 1;
      }
    } else {
      state.lastGateLane = lane;
      state.gateStreak = 1;
    }
  }
  const group = type === 'crystal' ? createCrystal(lane) : createGate(lane);
  scene.add(group);
  objects.push({
    id: objectId,
    type,
    lane,
    z: SPAWN_Z,
    group,
    collected: false,
    passed: false,
  });
  objectId += 1;
}

function removeObjectAt(index) {
  const obj = objects[index];
  scene.remove(obj.group);
  objects.splice(index, 1);
}

function clearObjects() {
  while (objects.length) removeObjectAt(objects.length - 1);
}

function spawnParticles(origin, color, count, crash = false) {
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(particleGeo, material);
    mesh.position.copy(origin);
    mesh.scale.setScalar(crash ? THREE.MathUtils.randFloat(1.0, 1.8) : THREE.MathUtils.randFloat(0.72, 1.25));
    scene.add(mesh);
    const speed = crash ? THREE.MathUtils.randFloat(2.2, 6.4) : THREE.MathUtils.randFloat(1.8, 4.2);
    const angle = Math.random() * Math.PI * 2;
    const lift = crash ? THREE.MathUtils.randFloat(0.2, 3.8) : THREE.MathUtils.randFloat(1.2, 4.4);
    particles.push({
      mesh,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, lift, Math.sin(angle) * speed),
      life: crash ? 0.8 : 0.55,
      maxLife: crash ? 0.8 : 0.55,
    });
  }
}

function resetGame() {
  clearObjects();
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.lane = 1;
  state.targetLane = 1;
  state.spawnTimer = 0;
  state.elapsedMs = 0;
  state.speed = 18;
  state.lastGateLane = -1;
  state.gateStreak = 0;
  state.cueHidden = false;
  player.position.x = LANES[state.lane];
  laneCue.classList.remove('is-hidden');
  updateScoreUI();
  updateComboUI();
  timeLeftEl.textContent = '60';
}

function setPhase(next) {
  state.phase = next;
  startScreen.classList.toggle('is-active', next === 'start');
  gameScreen.classList.toggle('is-active', next === 'playing');
  endScreen.classList.toggle('is-active', next === 'end');
  hud.classList.toggle('is-visible', next === 'playing');
}

function startGame() {
  resumeAudio();
  playStart();
  snapshotPreRunBest();
  resetGame();
  state.startAt = performance.now();
  setPhase('playing');
}

function goHome() {
  resumeAudio();
  playClick();
  clearObjects();
  setPhase('start');
}

function endGame(kind) {
  if (state.phase !== 'playing') return;
  state.endedBy = kind;
  setPhase('end');
  state.best = Math.max(state.best, state.score);
  localStorage.setItem(BEST_KEY, String(state.best));
  resultLabelEl.textContent = t(kind === 'win' ? 'win' : 'lose');
  finalScoreEl.textContent = String(state.score);
  bestScoreEl.textContent = String(state.best);
  maxComboValueEl.textContent = String(state.maxCombo);
  submitFinalScore(state.score);
  showBubble(randomLine(kind === 'win' ? 'winLines' : 'loseLines'));
  if (kind === 'win') {
    playWin();
  } else {
    playCrash();
    spawnParticles(player.position.clone().add(new THREE.Vector3(0, 0.35, 0)), 0xff3f5f, 32, true);
  }
}

function updateScoreUI() {
  scoreValueEl.textContent = String(state.score);
}

function updateComboUI() {
  comboBadge.textContent = `x${Math.max(2, Math.min(state.combo, 5))}`;
  comboBadge.classList.toggle('is-visible', state.combo >= 2 && state.phase === 'playing');
}

function moveLane(delta) {
  if (state.phase !== 'playing') return;
  const next = THREE.MathUtils.clamp(state.targetLane + delta, 0, LANES.length - 1);
  if (next === state.targetLane) return;
  state.targetLane = next;
  state.cueHidden = true;
  laneCue.classList.add('is-hidden');
  playMove();
}

function collectObject(obj) {
  obj.collected = true;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const multiplier = Math.min(state.combo, 5);
  const gain = 10 * multiplier;
  state.score += gain;
  updateScoreUI();
  updateComboUI();
  const origin = obj.group.position.clone();
  spawnParticles(origin, 0x72f8ff, 12, false);
  popScore(gain, origin);
  showBubble(randomLine('collectLines'));
  playCollect(state.combo);
}

function popScore(value, worldPos) {
  const pos = worldToScreen(worldPos.clone().add(new THREE.Vector3(0, 0.72, 0)));
  const el = document.createElement('div');
  el.className = 'pr-score-pop';
  el.textContent = `+${value}`;
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  popLayer.appendChild(el);
  window.setTimeout(() => el.remove(), 780);
}

function showBubble(text) {
  if (!text) return;
  const pos = worldToScreen(player.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
  bubble.textContent = text;
  bubble.style.left = `${pos.x}px`;
  bubble.style.top = `${pos.y}px`;
  bubble.classList.add('is-visible');
  window.clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => {
    bubble.classList.remove('is-visible');
  }, 900);
}

function worldToScreen(worldPos) {
  const rect = stage.getBoundingClientRect();
  const projected = worldPos.project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * rect.width,
    y: (-projected.y * 0.5 + 0.5) * rect.height,
  };
}

function updateObjects(dt) {
  const inGrace = performance.now() - state.startAt < GRACE_MS;
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const obj = objects[i];
    obj.z += state.speed * dt;
    obj.group.position.z = obj.z;

    if (obj.type === 'crystal') {
      obj.group.rotation.y += dt * 5.2;
      obj.group.rotation.z += dt * 2.8;
      obj.group.userData.halo.rotation.z -= dt * 2.6;
    } else {
      const pulse = 0.22 + Math.sin(performance.now() * 0.005 + obj.id) * 0.1;
      obj.group.userData.panel.material.opacity = 0.22 + pulse;
      obj.group.scale.y = 1 + Math.sin(performance.now() * 0.005 + obj.id) * 0.045;
    }

    const closeZ = Math.abs(obj.z - PLAYER_Z) < 1.05;
    const closeX = Math.abs(LANES[obj.lane] - player.position.x) < 0.82;
    if (closeZ && closeX) {
      if (obj.type === 'crystal' && !obj.collected) {
        collectObject(obj);
        removeObjectAt(i);
        continue;
      }
      if (obj.type === 'gate' && !inGrace) {
        endGame('lose');
        return;
      }
    }

    if (obj.type === 'crystal' && !obj.collected && !obj.passed && obj.z > PLAYER_Z + 1.2) {
      obj.passed = true;
      state.combo = 0;
      updateComboUI();
    }

    if (obj.z > REMOVE_Z) {
      removeObjectAt(i);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 4.8 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.x += dt * 7;
    p.mesh.rotation.y += dt * 5;
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function updateTrack(dt, speed) {
  frames.forEach((frame) => {
    frame.position.z += speed * dt;
    if (frame.position.z > 5) frame.position.z -= FRAME_COUNT * FRAME_SPACING;
  });

  const positions = stars.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    let z = positions.getZ(i) + speed * dt * 0.28;
    if (z > 10) z -= 86;
    positions.setZ(i, z);
  }
  positions.needsUpdate = true;
}

function updatePlaying(dt, now) {
  state.elapsedMs = now - state.startAt;
  state.speed = Math.min(28, 18 + Math.floor(state.elapsedMs / 10000) * 1.4);
  const remaining = Math.max(0, Math.ceil((GAME_MS - state.elapsedMs) / 1000));
  timeLeftEl.textContent = String(remaining);

  state.spawnTimer += dt;
  while (state.spawnTimer >= 0.72) {
    state.spawnTimer -= 0.72;
    spawnEvent();
  }

  updateObjects(dt);
  if (state.phase === 'playing' && state.elapsedMs >= GAME_MS) {
    endGame('win');
  }
}

function updateScene(dt, now) {
  const activeSpeed = state.phase === 'playing' ? state.speed : 4.4;
  updateTrack(dt, activeSpeed);
  updateParticles(dt);

  player.position.x = THREE.MathUtils.damp(player.position.x, LANES[state.targetLane], 16, dt);
  player.position.y = 0.78 + Math.sin(now * 0.004) * 0.18;
  player.rotation.z = THREE.MathUtils.damp(player.rotation.z, (state.targetLane - 1) * -0.24, 8, dt);
  playerMesh.rotation.y += dt * (state.phase === 'playing' ? 5.0 : 1.8);
  playerMesh.rotation.x = 0.2 + Math.sin(now * 0.005) * 0.08;
  playerRing.rotation.z -= dt * 2.4;
  characterSlot.position.y = 0.1 + Math.sin(now * 0.006) * 0.04;
  characterSlot.rotation.x = Math.sin(now * 0.006) * 0.035;
  playerGlow.material.opacity = 0.48 + Math.sin(now * 0.005) * 0.12;

  camera.position.x = THREE.MathUtils.damp(camera.position.x, player.position.x * 0.22, 4, dt);
  camera.lookAt(player.position.x * 0.1, 0.95, -14);
  farLight.position.x = Math.sin(now * 0.0012) * 2.5;

  if (state.phase === 'playing') updatePlaying(dt, now);
}

function render(now) {
  const dt = Math.min(0.033, Math.max(0, (now - state.lastTime) / 1000 || 0));
  state.lastTime = now;
  updateScene(dt, now);
  composer.render();
  requestAnimationFrame(render);
}

function resize() {
  const width = stage.clientWidth || window.innerWidth;
  const height = stage.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

startButton.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  startGame();
});

againButton.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  resumeAudio();
  playClick();
  startGame();
});

homeButton.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  goHome();
});

gameScreen.addEventListener('pointerdown', (ev) => {
  if (state.phase !== 'playing') return;
  ev.preventDefault();
  const rect = gameScreen.getBoundingClientRect();
  moveLane(ev.clientX < rect.left + rect.width / 2 ? -1 : 1);
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowLeft' || ev.key.toLowerCase() === 'a') {
    ev.preventDefault();
    moveLane(-1);
  } else if (ev.key === 'ArrowRight' || ev.key.toLowerCase() === 'd') {
    ev.preventDefault();
    moveLane(1);
  } else if (ev.code === 'Space') {
    ev.preventDefault();
    if (state.phase === 'start') startGame();
    if (state.phase === 'end') startGame();
  }
});

window.addEventListener('resize', resize);

bestScoreEl.textContent = String(state.best);
state.characterId = getCharacterOption(state.characterId).id;
renderCharacterPicker();
loadCharacter(getCharacterOption(state.characterId));
initLeaderboard();
resize();
requestAnimationFrame((now) => {
  state.lastTime = now;
  requestAnimationFrame(render);
});
