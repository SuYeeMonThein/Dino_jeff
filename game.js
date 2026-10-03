/* ===========================================================
   Little Dino's Love Run
   A cute endless-runner built with plain canvas + JS.
   No images, no frameworks — everything is drawn with code.
=========================================================== */

/* -----------------------------------------------------------
   EDIT ME: milestone banners and the words that pop up when a
   heart is collected. Feel free to change the text/emoji here.
----------------------------------------------------------- */
const MILESTONES = [
  { score: 100, message: "Nice! You're amazing 💕" },
  { score: 250, message: "Your smile lights up my whole day ☀️" },
  { score: 450, message: "Being with you is my luckiest thing 🍀" },
  { score: 700, message: "No matter how far, I'll always be by your side 🤍" },
  { score: 1000, message: "I love you… so, so much ❤️" },
];

const HEART_WORDS = ["love you", "miss you", "thinking of you", "only you", "forever"];

/* -----------------------------------------------------------
   Tunable game constants
----------------------------------------------------------- */
const LOGICAL_WIDTH = 800;   // fixed "world" resolution — the canvas
const LOGICAL_HEIGHT = 400;  // is scaled to fit the screen via CSS.
const GROUND_Y = 320;        // y position of the ground line

const DINO_X = 90;
const DINO_WIDTH = 64;
const DINO_HEIGHT = 60;

const GRAVITY = 2600;           // px/s^2
const JUMP_VELOCITY = -920;     // px/s, applied the instant you jump
const JUMP_CUT_MULTIPLIER = 0.45; // releasing early shortens the jump

const BASE_SPEED = 330;   // px/s at the start
const MAX_SPEED = 820;    // px/s speed cap
const SPEED_RAMP = 0.028; // how fast speed grows with distance

const HITBOX_SHRINK = 0.82; // AABB hitboxes are shrunk so collisions feel fair

const prefersReducedMotion =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -----------------------------------------------------------
   DOM references
----------------------------------------------------------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const heartsCountEl = document.getElementById("heartsCount");
const scoreCountEl = document.getElementById("scoreCount");
const toastEl = document.getElementById("toast");

const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const finalScoreEl = document.getElementById("finalScore");
const finalHeartsEl = document.getElementById("finalHearts");
const bestScoreEl = document.getElementById("bestScore");
const encourageNoteEl = document.getElementById("encourageNote");

/* -----------------------------------------------------------
   Best score persistence (localStorage, with a safe fallback)
----------------------------------------------------------- */
const BEST_SCORE_KEY = "littleDinoLoveRun.bestScore";
let memoryBestScore = 0; // used if localStorage is unavailable

function loadBestScore() {
  try {
    const raw = localStorage.getItem(BEST_SCORE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (err) {
    return memoryBestScore;
  }
}

function saveBestScore(value) {
  memoryBestScore = value;
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch (err) {
    // localStorage blocked (private mode, etc.) — memory fallback is fine
  }
}

/* -----------------------------------------------------------
   Canvas sizing — fixed logical resolution, scaled for the
   device's pixel ratio so everything stays crisp.
----------------------------------------------------------- */
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = LOGICAL_WIDTH * dpr;
  canvas.height = LOGICAL_HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupCanvas();
window.addEventListener("resize", setupCanvas);

/* -----------------------------------------------------------
   Game state
----------------------------------------------------------- */
let state = "start"; // 'start' | 'playing' | 'gameover'
let elapsedTime = 0;
let distance = 0;
let speed = BASE_SPEED;
let score = 0;
let heartsCollected = 0;
let bestScore = loadBestScore();

const dino = {
  y: GROUND_Y - DINO_HEIGHT, // top-left y of the dino's bounding box
  velocityY: 0,
  grounded: true,
  runPhase: 0,     // drives the leg/tail animation
  squash: 0,       // 0..1, decays after landing for a squash/stretch pop
  blinkTimer: randomBetween(2, 5),
  blinking: false,
  blinkDuration: 0,
};

let obstacles = [];
let hearts = [];
let floatingWords = []; // transient "love you" text popups
let nextObstacleAt = randomBetween(380, 600);
let nextHeartAt = randomBetween(260, 520);

let milestonesShown = MILESTONES.map(() => false);
let toastQueue = [];
let toastTimer = null;

// Background decoration (generated once, scrolls based on distance)
const stars = createStars(60);
const hillsFar = createHillLayer(5, 60, 90);
const hillsNear = createHillLayer(3, 40, 55);
const groundFlowers = createGroundFlowers(40);

/* -----------------------------------------------------------
   Small helpers
----------------------------------------------------------- */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Shrinks a bounding box toward its center by `factor` (for fairer collisions)
function shrinkRect(x, y, w, h, factor) {
  const dw = w * (1 - factor);
  const dh = h * (1 - factor);
  return { x: x + dw / 2, y: y + dh / 2, w: w - dw, h: h - dh };
}

/* -----------------------------------------------------------
   Background decoration generators (run once at load)
----------------------------------------------------------- */
function createStars(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * (GROUND_Y - 40),
      radius: randomBetween(0.6, 1.8),
      phase: Math.random() * Math.PI * 2,
      speed: randomBetween(1.2, 2.4),
    });
  }
  return list;
}

// A repeating "tile" of rolling hill humps, drawn twice side by side
// and scrolled with a parallax factor so it loops seamlessly.
function createHillLayer(bumpCount, minHeight, maxHeight) {
  const tileWidth = LOGICAL_WIDTH;
  const bumps = [];
  for (let i = 0; i < bumpCount; i++) {
    bumps.push({
      x: (tileWidth / bumpCount) * i + randomBetween(-20, 20),
      width: randomBetween(160, 260),
      height: randomBetween(minHeight, maxHeight),
    });
  }
  return { tileWidth, bumps };
}

function createGroundFlowers(count) {
  const tileWidth = LOGICAL_WIDTH;
  const colors = ["#ff9ecb", "#d6a8ff", "#ffc6e0"];
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: Math.random() * tileWidth,
      y: GROUND_Y + randomBetween(14, LOGICAL_HEIGHT - GROUND_Y - 10),
      radius: randomBetween(1.5, 3),
      color: pickRandom(colors),
    });
  }
  return { tileWidth, list };
}

/* -----------------------------------------------------------
   Resetting / starting a run
----------------------------------------------------------- */
function resetGame() {
  elapsedTime = 0;
  distance = 0;
  speed = BASE_SPEED;
  score = 0;
  heartsCollected = 0;

  dino.y = GROUND_Y - DINO_HEIGHT;
  dino.velocityY = 0;
  dino.grounded = true;
  dino.runPhase = 0;
  dino.squash = 0;

  obstacles = [];
  hearts = [];
  floatingWords = [];
  nextObstacleAt = randomBetween(380, 600);
  nextHeartAt = randomBetween(260, 520);

  milestonesShown = MILESTONES.map(() => false);
  toastQueue = [];
  hideToastImmediately();

  updateHud();
}

function startGame() {
  resetGame();
  state = "playing";
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
}

function endGame() {
  state = "gameover";

  const isNewBest = score > bestScore;
  if (isNewBest) {
    bestScore = score;
    saveBestScore(bestScore);
  }

  finalScoreEl.textContent = score;
  finalHeartsEl.textContent = heartsCollected;
  bestScoreEl.textContent = bestScore;

  let note;
  if (score >= 1000) {
    note = "You're my champion 👑❤️";
  } else if (isNewBest) {
    note = "New high score! 🎉";
  } else {
    note = "Try again, you've got this 💪";
  }
  encourageNoteEl.textContent = note;

  gameOverScreen.classList.remove("hidden");
}

/* -----------------------------------------------------------
   Input handling
   - Space / ArrowUp / W, or a tap/click on the game area, jumps.
   - Holding longer reaches the full jump height; releasing early
     cuts the upward velocity short for a quick hop.
----------------------------------------------------------- */
const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);

function tryStartJump() {
  if (state === "playing" && dino.grounded) {
    dino.velocityY = JUMP_VELOCITY;
    dino.grounded = false;
  } else if (state === "start") {
    startGame();
  } else if (state === "gameover") {
    startGame();
  }
}

function tryCutJump() {
  if (state === "playing" && dino.velocityY < 0) {
    dino.velocityY *= JUMP_CUT_MULTIPLIER;
  }
}

window.addEventListener("keydown", (e) => {
  if (JUMP_KEYS.has(e.code)) {
    e.preventDefault();
    if (e.repeat) return; // ignore OS key-repeat while held
    tryStartJump();
  }
});

window.addEventListener("keyup", (e) => {
  if (JUMP_KEYS.has(e.code)) {
    e.preventDefault();
    tryCutJump();
  }
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  tryStartJump();
});

canvas.addEventListener("pointerup", (e) => {
  e.preventDefault();
  tryCutJump();
});

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

/* -----------------------------------------------------------
   Spawning obstacles & hearts
----------------------------------------------------------- */
function spawnObstacle() {
  const width = randomBetween(34, 58);
  const height = randomBetween(30, 52);
  const hasRose = Math.random() < 0.25;

  obstacles.push({
    x: LOGICAL_WIDTH + width,
    width,
    height,
    hasRose,
    bumpSeed: Math.random() * 1000, // keeps each bush's shape unique but stable
  });

  // At higher speeds, sometimes add a second bush shortly after the first
  if (speed > 520 && Math.random() < 0.35) {
    const width2 = randomBetween(30, 50);
    const height2 = randomBetween(28, 48);
    obstacles.push({
      x: LOGICAL_WIDTH + width + width2 + randomBetween(55, 95),
      width: width2,
      height: height2,
      hasRose: Math.random() < 0.25,
      bumpSeed: Math.random() * 1000,
    });
  }

  nextObstacleAt = distance + randomBetween(320, 600) * (1 - speed / (MAX_SPEED * 2.4));
}

function spawnHeart() {
  const low = Math.random() < 0.5;
  const y = low ? GROUND_Y - 44 : GROUND_Y - 150;
  hearts.push({
    x: LOGICAL_WIDTH + 20,
    y,
    radius: 11,
    collected: false,
    bobPhase: Math.random() * Math.PI * 2,
  });
  nextHeartAt = distance + randomBetween(260, 520);
}

/* -----------------------------------------------------------
   Floating "love you" word popups
----------------------------------------------------------- */
function spawnFloatingWord(x, y) {
  floatingWords.push({
    x,
    y,
    text: pickRandom(HEART_WORDS),
    age: 0,
    maxAge: 1.1,
  });
}

/* -----------------------------------------------------------
   Toast banner queue (milestone messages)
----------------------------------------------------------- */
function queueToast(message) {
  toastQueue.push(message);
  if (!toastTimer) showNextToast();
}

function showNextToast() {
  const message = toastQueue.shift();
  if (!message) {
    toastTimer = null;
    return;
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");

  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    toastTimer = setTimeout(showNextToast, 300);
  }, 2500);
}

function hideToastImmediately() {
  clearTimeout(toastTimer);
  toastTimer = null;
  toastEl.classList.remove("show");
}

/* -----------------------------------------------------------
   HUD
----------------------------------------------------------- */
function updateHud() {
  heartsCountEl.textContent = heartsCollected;
  scoreCountEl.textContent = Math.floor(score);
}

/* -----------------------------------------------------------
   Update loop (delta-time based physics)
----------------------------------------------------------- */
function update(dt) {
  elapsedTime += dt;

  // --- speed & distance ---
  distance += speed * dt;
  speed = clamp(BASE_SPEED + distance * SPEED_RAMP, BASE_SPEED, MAX_SPEED);

  // --- dino physics ---
  dino.velocityY += GRAVITY * dt;
  dino.y += dino.velocityY * dt;

  const restY = GROUND_Y - DINO_HEIGHT;
  if (dino.y >= restY) {
    dino.y = restY;
    if (!dino.grounded) {
      dino.squash = 1; // just landed — trigger squash/stretch pop
    }
    dino.velocityY = 0;
    dino.grounded = true;
  }

  if (dino.grounded) {
    dino.runPhase += dt * (speed / 60);
  }
  dino.squash = Math.max(0, dino.squash - dt * 4);

  // --- blinking ---
  if (dino.blinking) {
    dino.blinkDuration -= dt;
    if (dino.blinkDuration <= 0) dino.blinking = false;
  } else {
    dino.blinkTimer -= dt;
    if (dino.blinkTimer <= 0) {
      dino.blinking = true;
      dino.blinkDuration = 0.12;
      dino.blinkTimer = randomBetween(2.5, 5.5);
    }
  }

  // --- spawn obstacles / hearts ---
  if (distance >= nextObstacleAt) spawnObstacle();
  if (distance >= nextHeartAt) spawnHeart();

  // --- move & collide obstacles ---
  const dinoBox = shrinkRect(DINO_X, dino.y, DINO_WIDTH, DINO_HEIGHT, HITBOX_SHRINK);

  for (const obs of obstacles) {
    obs.x -= speed * dt;
    const obsBox = shrinkRect(obs.x, GROUND_Y - obs.height, obs.width, obs.height, HITBOX_SHRINK);
    if (rectsOverlap(dinoBox, obsBox)) {
      endGame();
      return;
    }
  }
  obstacles = obstacles.filter((o) => o.x + o.width > -10);

  // --- move & collide hearts ---
  for (const heart of hearts) {
    heart.x -= speed * dt;
    if (!heart.collected) {
      const heartBox = {
        x: heart.x - heart.radius,
        y: heart.y - heart.radius,
        w: heart.radius * 2,
        h: heart.radius * 2,
      };
      if (rectsOverlap(dinoBox, heartBox)) {
        heart.collected = true;
        heartsCollected += 1;
        spawnFloatingWord(heart.x, heart.y);
      }
    }
  }
  hearts = hearts.filter((h) => !h.collected && h.x + h.radius > -10);

  // --- floating word popups ---
  for (const w of floatingWords) w.age += dt;
  floatingWords = floatingWords.filter((w) => w.age < w.maxAge);

  // --- score & milestones ---
  score = Math.floor(distance / 10) + heartsCollected * 10;
  updateHud();

  MILESTONES.forEach((m, i) => {
    if (!milestonesShown[i] && score >= m.score) {
      milestonesShown[i] = true;
      queueToast(m.message);
    }
  });
}

/* ===========================================================
   RENDERING
=========================================================== */

function render() {
  drawSky();
  drawStars();
  drawMoon();
  drawHills(hillsFar, 0.15, "#4a2f72");
  drawHills(hillsNear, 0.35, "#5c3a80");
  drawGround();
  drawObstacles();
  drawHearts();
  drawDino();
  drawFloatingWords();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  gradient.addColorStop(0, "#2b1d52");
  gradient.addColorStop(0.55, "#6a3f86");
  gradient.addColorStop(1, "#f29bb4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, GROUND_Y);
}

function drawStars() {
  for (const star of stars) {
    const twinkle = prefersReducedMotion
      ? 0.8
      : 0.55 + 0.45 * Math.sin(elapsedTime * star.speed + star.phase);
    ctx.globalAlpha = clamp(twinkle, 0.15, 1);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMoon() {
  const cx = LOGICAL_WIDTH - 110;
  const cy = 70;
  const r = 28;

  const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.4);
  glow.addColorStop(0, "rgba(255, 248, 220, 0.55)");
  glow.addColorStop(1, "rgba(255, 248, 220, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff8dc";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // craters
  ctx.fillStyle = "rgba(210, 190, 150, 0.45)";
  ctx.beginPath();
  ctx.arc(cx - 8, cy - 6, 5, 0, Math.PI * 2);
  ctx.arc(cx + 9, cy + 4, 3.5, 0, Math.PI * 2);
  ctx.arc(cx - 2, cy + 10, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Parallax hill layer: draws the tile twice so it scrolls seamlessly
function drawHills(layer, parallaxFactor, color) {
  const offset = (distance * parallaxFactor) % layer.tileWidth;
  ctx.fillStyle = color;
  for (const shiftTile of [0, -layer.tileWidth]) {
    const baseX = shiftTile + layer.tileWidth - offset;
    ctx.beginPath();
    ctx.moveTo(baseX, GROUND_Y);
    for (const bump of layer.bumps) {
      const x = baseX + bump.x;
      ctx.quadraticCurveTo(x + bump.width / 2, GROUND_Y - bump.height, x + bump.width, GROUND_Y);
    }
    ctx.lineTo(baseX + layer.tileWidth, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGround() {
  ctx.fillStyle = "#2a1b3d";
  ctx.fillRect(0, GROUND_Y, LOGICAL_WIDTH, LOGICAL_HEIGHT - GROUND_Y);

  // thin lighter line at the horizon for definition
  ctx.fillStyle = "rgba(255, 180, 210, 0.25)";
  ctx.fillRect(0, GROUND_Y, LOGICAL_WIDTH, 2);

  // scattered flower dots, scrolling with the ground
  const tile = groundFlowers.tileWidth;
  const offset = distance % tile;
  for (const flower of groundFlowers.list) {
    for (const shiftTile of [0, -tile]) {
      let x = flower.x + shiftTile - offset + tile;
      x = ((x % tile) + tile) % tile; // wrap into [0, tile)
      ctx.fillStyle = flower.color;
      ctx.beginPath();
      ctx.arc(x, flower.y, flower.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* --- Thorny bush obstacles --- */
function drawObstacles() {
  for (const obs of obstacles) {
    drawBush(obs.x, GROUND_Y, obs.width, obs.height, obs.hasRose, obs.bumpSeed);
  }
}

// A soft, rounded spike/petal shape — used for both the bush thorns and
// the dino's back spikes. Flares out at the base and tapers to a soft
// point, rather than a sharp triangle, so it reads as "cute" not "jagged".
function drawSoftSpike(cx, cy, length, width) {
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, cy);
  ctx.quadraticCurveTo(cx - width / 2, cy - length * 0.6, cx, cy - length);
  ctx.quadraticCurveTo(cx + width / 2, cy - length * 0.6, cx + width / 2, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawBush(x, baseY, width, height, hasRose, seed) {
  const outline = "#1f4a28";

  // Fused, cloud-like cluster of three overlapping circles (instead of a
  // scattered, randomly-wobbling blob) for a clean, rounded silhouette.
  const puffR = height * 0.5;
  const puffs = [
    { dx: width * 0.26, dr: 0.78 },
    { dx: width * 0.55, dr: 1.0 },
    { dx: width * 0.8, dr: 0.72 },
  ];

  ctx.fillStyle = "#3a8a4f";
  ctx.beginPath();
  for (const p of puffs) {
    const px = x + p.dx;
    const py = baseY - puffR * p.dr * 0.95;
    ctx.moveTo(px + puffR * p.dr, py);
    ctx.arc(px, py, puffR * p.dr, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  for (const p of puffs) {
    const px = x + p.dx;
    const py = baseY - puffR * p.dr * 0.95;
    ctx.beginPath();
    ctx.arc(px, py, puffR * p.dr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // soft highlight catching the moonlight
  ctx.fillStyle = "#5fba76";
  ctx.beginPath();
  ctx.arc(x + width * 0.34, baseY - height * 0.78, height * 0.17, 0, Math.PI * 2);
  ctx.fill();

  // a few neat soft thorns along the top, evenly spaced
  ctx.fillStyle = "#2f6b3c";
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  const thornSpots = [0.22, 0.5, 0.76];
  for (const t of thornSpots) {
    const tx = x + width * t;
    const ty = baseY - height * (0.82 + 0.05 * Math.sin(seed + t * 9));
    ctx.save();
    ctx.translate(tx, ty);
    drawSoftSpike(0, 0, 8, 5);
    ctx.restore();
  }

  if (hasRose) {
    const rx = x + width * 0.5;
    const ry = baseY - height - 10;

    // stem
    ctx.strokeStyle = "#2f6b3c";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(rx, ry + 7);
    ctx.lineTo(rx, baseY - height * 0.72);
    ctx.stroke();

    // tiny leaf
    ctx.fillStyle = "#3a8a4f";
    ctx.beginPath();
    ctx.ellipse(rx + 5, ry + 13, 5, 2.4, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // petals, arranged in a neat ring
    ctx.fillStyle = "#e8647f";
    ctx.strokeStyle = "#b73955";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const px = rx + Math.cos(angle) * 4.2;
      const py = ry + Math.sin(angle) * 4.2;
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // golden center
    ctx.fillStyle = "#ffd36e";
    ctx.beginPath();
    ctx.arc(rx, ry, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* --- Pink glowing collectible hearts --- */
function drawHeartShape(cx, cy, size) {
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(cx, cy + topCurveHeight);
  ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + topCurveHeight);
  ctx.bezierCurveTo(cx - size / 2, cy + (size + topCurveHeight) / 2, cx, cy + (size + topCurveHeight) / 1.3, cx, cy + size);
  ctx.bezierCurveTo(cx, cy + (size + topCurveHeight) / 1.3, cx + size / 2, cy + (size + topCurveHeight) / 2, cx + size / 2, cy + topCurveHeight);
  ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + topCurveHeight);
  ctx.closePath();
}

function drawHearts() {
  for (const heart of hearts) {
    const bob = prefersReducedMotion ? 0 : Math.sin(elapsedTime * 3 + heart.bobPhase) * 4;
    ctx.save();
    ctx.shadowColor = "rgba(255, 111, 165, 0.85)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ff7fb0";
    drawHeartShape(heart.x, heart.y - heart.radius + bob, heart.radius * 1.6);
    ctx.fill();
    ctx.restore();
  }
}

function drawFloatingWords() {
  ctx.textAlign = "center";
  ctx.font = "600 15px 'Baloo 2', sans-serif";
  for (const w of floatingWords) {
    const t = w.age / w.maxAge;
    const riseY = w.y - t * 40;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = "#ffe3ef";
    ctx.fillText(w.text, w.x, riseY);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

/* --- Little Dino itself ---
   The head and body are ONE continuous outlined shape (not a circle
   plopped on top of an ellipse) so there's no seam/crease at the neck —
   that seam was what made earlier versions read as "two blobs glued
   together" instead of one cute character. Legs/tail/spikes are drawn
   as separate pieces UNDER or ON TOP of that shape, like a sticker. */

const DINO_OUTLINE = "#2d6b46";

// Builds a smooth closed path through a polygon by rounding every corner:
// each vertex is replaced with a curve that cuts in from both neighboring
// edges by `factor` (0–0.5), so the whole outline reads as one soft blob
// instead of hard corners — without needing hand-tuned bezier handles.
function roundedPolygonPath(points, factor) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const inPoint = {
      x: curr.x + (prev.x - curr.x) * factor,
      y: curr.y + (prev.y - curr.y) * factor,
    };
    const outPoint = {
      x: curr.x + (next.x - curr.x) * factor,
      y: curr.y + (next.y - curr.y) * factor,
    };
    if (i === 0) {
      ctx.moveTo(inPoint.x, inPoint.y);
    } else {
      ctx.lineTo(inPoint.x, inPoint.y);
    }
    ctx.quadraticCurveTo(curr.x, curr.y, outPoint.x, outPoint.y);
  }
  ctx.closePath();
}

function drawDino() {
  const squash = dino.squash; // 0..1, decays after landing
  const scaleX = 1 + squash * 0.18;
  const scaleY = 1 - squash * 0.18;

  const x = DINO_X;
  const y = dino.y;
  const w = DINO_WIDTH;
  const h = DINO_HEIGHT;

  ctx.save();
  ctx.translate(x + w / 2, y + h); // anchor the squash/stretch to the feet
  ctx.scale(scaleX, scaleY);
  ctx.translate(-(x + w / 2), -(y + h));
  ctx.lineJoin = "round";

  const airborne = !dino.grounded;
  const runCycle = Math.sin(dino.runPhase * 2);
  const tailWag = prefersReducedMotion ? 0 : Math.sin(elapsedTime * 6) * 8;

  // One continuous silhouette: tail root -> up the back -> over the head
  // -> down the snout -> chin -> chest -> belly -> back to the tail root.
  const silhouette = [
    { x: x + 8, y: y + 50 }, // tail root
    { x: x + 6, y: y + 34 }, // back, rising
    { x: x + 14, y: y + 14 }, // shoulder
    { x: x + 28, y: y - 6 }, // head, back-top
    { x: x + 46, y: y - 8 }, // head, front-top
    { x: x + 58, y: y + 3 }, // forehead
    { x: x + 63, y: y + 13 }, // snout top
    { x: x + 66, y: y + 23 }, // snout tip
    { x: x + 59, y: y + 29 }, // snout underside
    { x: x + 50, y: y + 33 }, // chin
    { x: x + 44, y: y + 41 }, // chest
    { x: x + 40, y: y + 49 }, // belly, front
    { x: x + 16, y: y + 51 }, // belly, bottom (flat-ish)
  ];

  // --- tail (wags gently, drawn behind the body) ---
  ctx.fillStyle = "#6fd9a3";
  ctx.strokeStyle = DINO_OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 44);
  ctx.quadraticCurveTo(x - 16, y + 46 + tailWag, x - 6, y + 28 + tailWag);
  ctx.quadraticCurveTo(x + 2, y + 32, x + 10, y + 38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- legs (animate while running, tucked up while airborne); the
  //     body is drawn on top right after, hiding where they attach ---
  ctx.fillStyle = "#4fb888";
  ctx.strokeStyle = DINO_OUTLINE;
  ctx.lineWidth = 2;
  const legTopY = y + 42;
  const legHeight = 14;
  if (airborne) {
    drawDinoLeg(x + 20, legTopY, legHeight * 0.6);
    drawDinoLeg(x + 36, legTopY, legHeight * 0.6);
  } else {
    const swing = runCycle * 6;
    drawDinoLeg(x + 20 + swing, legTopY, legHeight);
    drawDinoLeg(x + 36 - swing, legTopY, legHeight);
  }

  // --- head + body, one seamless outline ---
  ctx.fillStyle = "#8ff0bd";
  ctx.strokeStyle = DINO_OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  roundedPolygonPath(silhouette, 0.4);
  ctx.fill();
  ctx.stroke();

  // belly highlight (inset, no stroke, so it doesn't add a seam)
  ctx.fillStyle = "#e3fff0";
  ctx.beginPath();
  ctx.ellipse(x + 26, y + 40, 11, 9, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // tiny arm nub
  ctx.fillStyle = "#7fe0ad";
  ctx.strokeStyle = DINO_OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(x + 42, y + 44, 5.5, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // --- back spikes: soft pink petals following the back curve ---
  ctx.fillStyle = "#ff9ecb";
  ctx.strokeStyle = "#d8679f";
  ctx.lineWidth = 1.4;
  const spikes = [
    { sx: x + 8, sy: y + 32, angle: 25, len: 9, wid: 6 },
    { sx: x + 13, sy: y + 14, angle: 12, len: 11, wid: 7 },
    { sx: x + 26, sy: y - 2, angle: -5, len: 11, wid: 7 },
    { sx: x + 43, sy: y - 6, angle: -18, len: 9, wid: 6 },
  ];
  for (const s of spikes) {
    ctx.save();
    ctx.translate(s.sx, s.sy);
    ctx.rotate((s.angle * Math.PI) / 180);
    drawSoftSpike(0, 0, s.len, s.wid);
    ctx.restore();
  }

  // --- face (sits on the snout/forehead area of the silhouette) ---
  // blush
  ctx.fillStyle = "rgba(255, 140, 170, 0.7)";
  ctx.beginPath();
  ctx.ellipse(x + 42, y + 20, 7, 4.5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // nostril
  ctx.fillStyle = "#2c2033";
  ctx.beginPath();
  ctx.arc(x + 63, y + 17, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // eye (X if game over, closed arc if blinking, else a big googly eye)
  const eyeX = x + 51;
  const eyeY = y + 7;
  if (state === "gameover") {
    ctx.strokeStyle = "#2c2033";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(eyeX - 4, eyeY - 4);
    ctx.lineTo(eyeX + 4, eyeY + 4);
    ctx.moveTo(eyeX + 4, eyeY - 4);
    ctx.lineTo(eyeX - 4, eyeY + 4);
    ctx.stroke();
  } else if (dino.blinking) {
    ctx.strokeStyle = "#2c2033";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY + 1, 4, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2c2033";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2c2033";
    ctx.beginPath();
    ctx.arc(eyeX + 1.4, eyeY + 0.8, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX + 2.5, eyeY - 0.6, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // mouth
  ctx.strokeStyle = "#2c2033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (state === "gameover") {
    ctx.arc(x + 54, y + 24, 4, Math.PI, Math.PI * 2, true); // small frown
  } else {
    ctx.arc(x + 52, y + 21, 6, 0.1 * Math.PI, 0.8 * Math.PI);
  }
  ctx.stroke();

  ctx.restore(); // end squash/stretch transform

  // --- floating heart above the head (drawn outside the squash transform) ---
  const heartBob = prefersReducedMotion ? 0 : Math.sin(elapsedTime * 2.2) * 3;
  ctx.save();
  ctx.shadowColor = "rgba(255, 111, 165, 0.8)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#ff6fa5";
  drawHeartShape(x + 40, y - 14 + heartBob, 12);
  ctx.fill();
  ctx.restore();
}

// A stubby rounded leg with a little oval foot at the end.
function drawDinoLeg(cx, topY, height) {
  const legW = 11;
  const r = 5;
  ctx.beginPath();
  ctx.moveTo(cx - legW / 2 + r, topY);
  ctx.arcTo(cx + legW / 2, topY, cx + legW / 2, topY + height, r);
  ctx.arcTo(cx + legW / 2, topY + height, cx - legW / 2, topY + height, r);
  ctx.arcTo(cx - legW / 2, topY + height, cx - legW / 2, topY, r);
  ctx.arcTo(cx - legW / 2, topY, cx + legW / 2, topY, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, topY + height, 8, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/* ===========================================================
   Main loop — requestAnimationFrame with delta time.
   Pauses automatically while the browser tab is hidden.
=========================================================== */
let lastTimestamp = null;

function loop(timestamp) {
  if (document.hidden) {
    lastTimestamp = null; // avoid a huge dt jump when the tab comes back
    requestAnimationFrame(loop);
    return;
  }

  if (lastTimestamp === null) lastTimestamp = timestamp;
  let dt = (timestamp - lastTimestamp) / 1000;
  dt = Math.min(dt, 1 / 20); // clamp so a lag spike doesn't teleport anything
  lastTimestamp = timestamp;

  if (state === "playing") {
    update(dt);
  } else {
    // Still animate the background gently on the start/game-over screens
    elapsedTime += dt;
    dino.runPhase += dino.grounded ? dt * (speed / 60) : 0;
  }

  render();
  requestAnimationFrame(loop);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) lastTimestamp = null;
});

// Initial HUD state and first frame (so the start screen isn't blank)
updateHud();
requestAnimationFrame(loop);
