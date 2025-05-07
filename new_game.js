// ======================
// [1] Canvas Setup
// ======================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

camera = {
  x: 0,
  y: 0,
  width: canvas.width,
  height: canvas.height,
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.width = canvas.width;
  camera.height = canvas.height;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ======================
// [2] World & Camera
// ======================
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function createFlare(fromPlane) {
  const rearAngle = fromPlane.angle + Math.PI;
  const pairSpread = 0.4;
  const speed = 2;
  const flareSize = 12;
  const flareCount = 10;
  let pairsEmitted = 0;

  const ownerType =
    fromPlane === player
      ? "player"
      : allies.includes(fromPlane)
      ? "ally"
      : enemies.includes(fromPlane)
      ? "enemy"
      : "unknown";

  const interval = setInterval(() => {
    if (pairsEmitted >= flareCount) {
      clearInterval(interval);
      return;
    }

    let leftAngle = rearAngle - pairSpread / 2;
    let rightAngle = rearAngle + pairSpread / 2;

    flares.push({
      x: fromPlane.x,
      y: fromPlane.y,
      vx: Math.cos(leftAngle) * speed,
      vy: Math.sin(leftAngle) * speed,
      timer: FLARE_DURATION,
      size: flareSize,
      trail: [{ x: fromPlane.x, y: fromPlane.y, alpha: 1.0 }],
      ownerType, // ✅ Add owner type
    });

    flares.push({
      x: fromPlane.x,
      y: fromPlane.y,
      vx: Math.cos(rightAngle) * speed,
      vy: Math.sin(rightAngle) * speed,
      timer: FLARE_DURATION,
      size: flareSize,
      trail: [{ x: fromPlane.x, y: fromPlane.y, alpha: 1.0 }],
      ownerType, // ✅ Add owner type
    });

    playSound("flare");
    pairsEmitted++;
  }, 100);
}


function getLockedTarget(source, targets) {
  for (const t of targets) {
    const dx = t.x - source.x;
    const dy = t.y - source.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MISSILE_RANGE) continue;

    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - source.angle;

    // Normalize angle difference to [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) < MISSILE_CONE) {
      return t;
    }
  }
  return null;
}

function orbitAroundTarget(flyer, target) {
  if (!flyer || !target) return;

  // Update angle of orbit
  flyer.orbitAngle += flyer.orbitSpeed;

  // Calculate desired orbit position
  const orbitX = target.x + Math.cos(flyer.orbitAngle) * flyer.orbitDistance;
  const orbitY = target.y + Math.sin(flyer.orbitAngle) * flyer.orbitDistance;

  // Calculate angle to move toward orbit point
  const dx = orbitX - flyer.x;
  const dy = orbitY - flyer.y;
  const desiredAngle = Math.atan2(dy, dx);
  let diff = desiredAngle - flyer.angle;

  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  flyer.angle += clamp(diff, -0.05, 0.05); // turning speed
}

function rotateToward(entity, targetAngle, turnSpeed = 0.05) {
  let diff = targetAngle - entity.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  entity.angle += clamp(diff, -turnSpeed, turnSpeed);
}

function avoidMapEdges(entity, buffer = 200, turnSpeed = 0.05) {
  let turnAwayAngle = null;

  if (entity.x < buffer) {
    turnAwayAngle = 0; // Face right
  } else if (entity.x > WORLD_WIDTH - buffer) {
    turnAwayAngle = Math.PI; // Face left
  } else if (entity.y < buffer) {
    turnAwayAngle = Math.PI / 2; // Face down
  } else if (entity.y > WORLD_HEIGHT - buffer) {
    turnAwayAngle = -Math.PI / 2; // Face up
  }

  if (turnAwayAngle !== null) {
    rotateToward(entity, turnAwayAngle, turnSpeed);
  }
}

// ======================
// [3] Load Images
// ======================
function loadImage(src) {
  const img = new Image();
  img.src = src;
  img.loaded = false;
  img.onload = () => {
    img.loaded = true;
  };
  return img;
}

const playerImage = loadImage("images/player.png");
const allyImage = loadImage("images/ally.png");
const enemyImage = loadImage("images/enemy.png");
const bulletImage = loadImage("images/bullet.png");
const missileImage = loadImage("images/missile.png");
const explosionImage = loadImage("images/explosion.png");
const flareImage = loadImage("images/flare.png");
const skyImage = loadImage("images/sky.jpg");

// ======================
// [3.1] Load Sounds
// ======================
const sounds = {
  shoot: new Audio("sounds/shoot.wav"),
  explosion: new Audio("sounds/explosion.wav"),
  missile: new Audio("sounds/missile.wav"),
  flare: new Audio("sounds/flare.wav"),
};

function playSound(name) {
  const sfx = sounds[name].cloneNode(); // allow overlapping
  sfx.volume = 0.5;
  sfx.play();
}

// ======================
// [4] Player
// ======================

const MIN_PLANE_SPEED = 3;
const MAX_PLANE_SPEED = 5;

const player = {
  x: WORLD_WIDTH - 300, // near bottom-right
  y: WORLD_HEIGHT - 300,
  angle: 0,
  speed: 0,
  maxSpeed: MAX_PLANE_SPEED,
  rotationSpeed: 0.05,
  acceleration: 0.1,
  image: playerImage,
  width: 60,
  height: 60,
  health: 100,
  throttle: 1.0,
  throttleTarget: 1.0,
  orbitAngle: Math.random() * Math.PI * 2,   // ✅ Add this
  orbitDistance: 300,                        // ✅ Add this
  orbitSpeed: 0.015                          // ✅ Add this
};


let lives = 3;
let isGameOver = false;
let score = 0;
let isPaused = false;

const bullets = [];
const BULLET_SPEED = 10;
const BULLET_LIFESPAN = 1000; // ~1 second @ 60fps
const BULLET_SIZE = 10;
let shootCooldown = 0;

const trails = [];

const missiles = [];
const MISSILE_SPEED = 6;
const MISSILE_TURN_RATE = 0.08;
const MISSILE_SIZE = 30;
const MISSILE_RANGE = 900;
const MISSILE_CONE = Math.PI / 6; // ~30°
const MISSILE_DAMAGE = 50;
let missileCooldown = 0;

let flareCooldown = 0;
const FLARE_COOLDOWN_MAX = 300; // ~5 seconds @ 60 FPS

const enemies = [];
const ENEMY_COUNT = 5;
const ENEMY_SIZE = 50;
const ENEMY_HEALTH = 50;

let level = 1;
let enemiesRemaining = ENEMY_COUNT;

const enemyBullets = [];
const ENEMY_FIRE_COOLDOWN = 10;
const ENEMY_BULLET_SPEED = 8;

const allies = [];
const ALLY_COUNT = 3;
const ALLY_SIZE = 50;
const ALLY_HEALTH = 100;
const allyBullets = [];
const ALLY_FIRE_COOLDOWN = 10;
const ALLY_BULLET_SPEED = 8;

const flares = [];
const FLARE_DURATION = 90;

const explosions = [];
const EXPLOSION_DURATION = 30;

const wingTrails = [];

const PLAYER_BULLET_SPREAD = 0.02; // slightly tighter
const ENEMY_BULLET_SPREAD = 0.02; // looser, less accurate
const ALLY_BULLET_SPREAD = 0.02; // medium accuracy

const PLAYER_BULLET_DAMAGE = 1;
const ALLY_BULLET_DAMAGE = 1;
const ENEMY_BULLET_DAMAGE = 1;

const PLAYER_MISSILE_DAMAGE = 100;
const ALLY_MISSILE_DAMAGE = 100;
const ENEMY_MISSILE_DAMAGE = 100;

let autopilotEnabled = false; // 🔁 You can toggle this via a key or button

for (let i = 0; i < ENEMY_COUNT; i++) {
  enemies.push({
    x: 200 + Math.random() * 100, // Top-left cluster
    y: 200 + Math.random() * 100,
    angle: Math.random() * Math.PI * 2,
    speed: 2,
    health: ENEMY_HEALTH,
    turnTimer: Math.floor(Math.random() * 60),
    image: enemyImage,
    flareCooldown: 0,
    throttle: 1.0, // 🟢 full throttle
    throttleTarget: 1.0,
    width: ENEMY_SIZE,
    height: ENEMY_SIZE,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitDistance: 250 + Math.random() * 100,
    orbitSpeed: 0.01 + Math.random() * 0.01,
  });
}

for (let i = 0; i < ALLY_COUNT; i++) {
  allies.push({
    x: WORLD_WIDTH - 300 + Math.random() * 100, // Bottom-right cluster
    y: WORLD_HEIGHT - 300 + Math.random() * 100,
    angle: Math.random() * Math.PI * 2,
    speed: 2.5,
    health: ALLY_HEALTH,
    cooldown: 0,
    missileCooldown: 0,
    image: allyImage,
    flareCooldown: 0,
    throttle: 1.0, // 🟢 full throttle
    throttleTarget: 1.0,
    width: ALLY_SIZE,
    height: ALLY_SIZE,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitDistance: 250 + Math.random() * 100,
    orbitSpeed: 0.01 + Math.random() * 0.01,
  });
}

// ======================
// [5] Input
// ======================
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "p") isPaused = !isPaused;
});

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "f" && flareCooldown <= 0) {
    dropFlareFromPlayer();
    flareCooldown = FLARE_COOLDOWN_MAX;
  }
});

window.addEventListener("keydown", (e) => {
  if (isGameOver && e.key.toLowerCase() === "r") {
    restartGame();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "x") {
    autopilotEnabled = !autopilotEnabled;
  }
});

document
  .getElementById("fireBtn")
  .addEventListener("touchstart", () => (keys[" "] = true));
document
  .getElementById("fireBtn")
  .addEventListener("touchend", () => (keys[" "] = false));
document
  .getElementById("missileBtn")
  .addEventListener("touchstart", () => (keys["m"] = true));
document
  .getElementById("missileBtn")
  .addEventListener("touchend", () => (keys["m"] = false));
document.getElementById("flareBtn").addEventListener("click", () => {
  if (flareCooldown <= 0) {
    dropFlareFromPlayer();
    flareCooldown = FLARE_COOLDOWN_MAX;
  }
}); 
document.getElementById("restartBtn").addEventListener("click", () => {
  restartGame();
});

// ======================
// [6] Update Logic
// ======================

function fireBullet({
  origin,
  angle,
  speed,
  life,
  targetArray,
  spread = 0.2,
  offset = 30,
}) {
  const randomSpread = (Math.random() - 0.5) * spread;
  const finalAngle = angle + randomSpread;

  targetArray.push({
    x: origin.x + Math.cos(finalAngle) * offset,
    y: origin.y + Math.sin(finalAngle) * offset,
    vx: Math.cos(finalAngle) * speed,
    vy: Math.sin(finalAngle) * speed,
    life: life,
    trailHistory: [],
  });
}

function createMissile({ x, y, angle, target, ownerType }) {
  missiles.push({
    x,
    y,
    angle,
    target,
    ownerType, // ✅ Now defined
    trailHistory: [],
    lifetime: 300,
  });
  playSound("missile");
}

function isInMissileCone(source, target) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const angleToTarget = Math.atan2(dy, dx);
  let diff = angleToTarget - source.angle;

  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const distance = Math.hypot(dx, dy);
  return Math.abs(diff) < MISSILE_CONE && distance <= MISSILE_RANGE;
}

function updateMissile(m, index) {
  let target = m.target;

  // === Flare Redirect ===
  const possibleFlares = flares.filter((f) => {
    const dx = f.x - m.x;
    const dy = f.y - m.y;
    const dist = Math.hypot(dx, dy);
    return dist < 300 && f.ownerType !== m.ownerType; // ✅ Only target other team flares
  });  

  if (possibleFlares.length > 0) {
    possibleFlares.sort((a, b) => {
      const da = Math.hypot(a.x - m.x, a.y - m.y);
      const db = Math.hypot(b.x - m.x, b.y - m.y);
      return da - db;
    });
    target = possibleFlares[0];
  }

  // === Homing Movement
  if (target) {
    const dx = target.x - m.x;
    const dy = target.y - m.y;
    const desiredAngle = Math.atan2(dy, dx);
    let diff = desiredAngle - m.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    m.angle += clamp(diff, -MISSILE_TURN_RATE, MISSILE_TURN_RATE);
  }

  m.x += Math.cos(m.angle) * MISSILE_SPEED;
  m.y += Math.sin(m.angle) * MISSILE_SPEED;

  m.trailHistory = m.trailHistory || [];
  m.trailHistory.push({ x: m.x, y: m.y, alpha: 1.0 });
  if (m.trailHistory.length > 20) m.trailHistory.shift();
  m.trailHistory.forEach((p) => (p.alpha *= 0.95));

  // === Impact
  m.lifetime--;
  const dist = target ? Math.hypot(m.x - target.x, m.y - target.y) : Infinity;

  if (dist < 40 || m.lifetime <= 0) {
    if (target && typeof target.health === "number") {
      // Apply damage only if target is valid and opposite type
      const isFriendlyFire =
        (m.ownerType === "player" && target === player) ||
        (m.ownerType === "enemy" && enemies.includes(target)) ||
        (m.ownerType === "ally" && allies.includes(target));
      if (!isFriendlyFire) {
        let damage = 0;
        if (m.ownerType === "player") damage = PLAYER_MISSILE_DAMAGE;
        else if (m.ownerType === "ally") damage = ALLY_MISSILE_DAMAGE;
        else if (m.ownerType === "enemy") damage = ENEMY_MISSILE_DAMAGE;

        target.health = Math.max(0, target.health - damage);

        if (target.health <= 0) {
          spawnExplosion(target.x, target.y);
    
          // ✅ Optional: handle player-specific logic
          if (target === player) {
            lives--;
            if (lives > 0) {
              player.x = WORLD_WIDTH / 2;
              player.y = WORLD_HEIGHT / 2;
              player.health = 100;
            } else {
              isGameOver = true;
            }
          }
        }
      }
    }
    spawnExplosion(m.x, m.y);
    missiles.splice(index, 1);
  }
}

function runAutopilot(entity, targetList, ownerType = "player") {
  const target = getLockedTarget(entity, targetList);

  // === Aggressive: Chase directly or orbit closely
  if (target) {
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - entity.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    entity.angle += clamp(diff, -0.08, 0.08);
    entity.orbitDistance = 100;
  } else {
    entity.orbitAngle = (entity.orbitAngle || 0) + 0.02;
    const wanderX = WORLD_WIDTH / 2 + Math.cos(entity.orbitAngle) * 300;
    const wanderY = WORLD_HEIGHT / 2 + Math.sin(entity.orbitAngle) * 300;
    orbitAroundTarget(entity, { x: wanderX, y: wanderY });
  }

  // === Throttle control
  entity.throttleTarget = 1.0;
  entity.throttle += (entity.throttleTarget - entity.throttle) * 0.1;
  entity.throttle = clamp(entity.throttle, 0.5, 1.0);
  entity.speed = MIN_PLANE_SPEED + (MAX_PLANE_SPEED - MIN_PLANE_SPEED) * entity.throttle;

  entity.x += Math.cos(entity.angle) * entity.speed;
  entity.y += Math.sin(entity.angle) * entity.speed;
  entity.x = clamp(entity.x, 0, WORLD_WIDTH);
  entity.y = clamp(entity.y, 0, WORLD_HEIGHT);

  // === Initialize cooldowns if not present
  entity.cooldown = entity.cooldown || 0;
  entity.missileCooldown = entity.missileCooldown || 0;
  entity.flareCooldown = entity.flareCooldown || 0;

  // === Decrease cooldowns
  entity.cooldown--;
  entity.missileCooldown--;
  if (entity.flareCooldown > 0) entity.flareCooldown--;

  // === Fire bullets
  if (target && entity.cooldown <= 0) {
    fireBullet({
      origin: entity,
      angle: entity.angle,
      speed: BULLET_SPEED,
      life: BULLET_LIFESPAN,
      targetArray:
        ownerType === "player"
          ? bullets
          : ownerType === "ally"
          ? allyBullets
          : enemyBullets,
      spread:
        ownerType === "player"
          ? PLAYER_BULLET_SPREAD
          : ownerType === "ally"
          ? ALLY_BULLET_SPREAD
          : ENEMY_BULLET_SPREAD,
      offset: 30,
    });
    entity.cooldown = 5;
  }

  // === Fire missiles
  if (target && entity.missileCooldown <= 0) {
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.hypot(dx, dy);
    const angleToTarget = Math.atan2(dy, dx);
    const angleDiff = Math.abs(angleToTarget - entity.angle);

    if (angleDiff < MISSILE_CONE * 1.5 && dist < MISSILE_RANGE) {
      createMissile({
        x: entity.x,
        y: entity.y,
        angle: entity.angle,
        target,
        ownerType,
      });
      entity.missileCooldown =
        ownerType === "player" ? 40 : ownerType === "ally" ? 120 : 180;
    }
  }

  // === Drop flare if missile locked AND close
  const MISSILE_DANGER_RADIUS = 300;
  const incomingMissile = missiles.find(
    (m) =>
      m.target === entity &&
      Math.hypot(m.x - entity.x, m.y - entity.y) < MISSILE_DANGER_RADIUS
  );

  if (incomingMissile && entity.flareCooldown <= 0) {
    createFlare(entity);
    entity.flareCooldown = FLARE_COOLDOWN_MAX;
    playSound("flare");
  }
}

function updatePlayer() {
  if (autopilotEnabled) {
    runAutopilot(player, enemies, "player");
    updateWingTrails(player);
    return; // skip manual controls
  }

  if (typeof updatePlayerJoystick === "function") updatePlayerJoystick();

  // 🔵 Throttle input control (W / ArrowUp = up, S / ArrowDown = down)
  if (keys["w"] || keys["arrowup"]) {
    player.throttleTarget = Math.min(1.0, player.throttleTarget + 0.02);
  }
  if (keys["s"] || keys["arrowdown"]) {
    player.throttleTarget = Math.max(0.2, player.throttleTarget - 0.02);
  }

  // Turn
  if (keys["a"] || keys["arrowleft"]) player.angle -= player.rotationSpeed;
  if (keys["d"] || keys["arrowright"]) player.angle += player.rotationSpeed;

  // 🟡 Throttle smoothing
  player.throttle += (player.throttleTarget - player.throttle) * 0.1;
  player.throttle = clamp(player.throttle, 0.2, 1.0);

  // 🟡 Apply throttle to speed
  player.speed =
    MIN_PLANE_SPEED + (MAX_PLANE_SPEED - MIN_PLANE_SPEED) * player.throttle;

  // Move
  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);

  updateWingTrails(player);

  // Shooting
  if ((keys[" "] || keys["space"]) && shootCooldown <= 0) {
    fireBullet({
      origin: player,
      angle: player.angle,
      speed: BULLET_SPEED,
      life: BULLET_LIFESPAN,
      targetArray: bullets,
      spread: PLAYER_BULLET_SPREAD,
      offset: 30,
    });
    shootCooldown = 10;
  }
  if (shootCooldown > 0) shootCooldown--;

  // Missile
  if ((keys["m"] || keys["M"]) && missileCooldown <= 0) {
    const target = getLockedTarget(player, enemies);
    if (target) {
      createMissile({
        x: player.x,
        y: player.y,
        angle: player.angle,
        target,
        ownerType: "player",
      });
      missileCooldown = 60;
    }
  }
  if (missileCooldown > 0) missileCooldown--;
  if (flareCooldown > 0) flareCooldown--;
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    b.trailHistory = b.trailHistory || [];
    b.trailHistory.push({ x: b.x, y: b.y, alpha: 1.0 });
    if (b.trailHistory.length > 8) b.trailHistory.shift();
    b.trailHistory.forEach((p) => (p.alpha *= 0.9));

    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // Remove bullets out of bounds or expired
    if (
      b.life <= 0 ||
      b.x < 0 ||
      b.x > WORLD_WIDTH ||
      b.y < 0 ||
      b.y > WORLD_HEIGHT
    ) {
      bullets.splice(i, 1);
    }
  }

  // Check for collisions with enemies
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ENEMY_SIZE / 2 + BULLET_SIZE) {
        e.health -= PLAYER_BULLET_DAMAGE;
        spawnExplosion(b.x, b.y, 0.4); // 💥 Add explosion
        bullets.splice(bi, 1); // remove bullet
      }
    });
  });

  // Remove dead enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].health <= 0) {
      const deadEnemy = enemies.splice(i, 1)[0];
      enemiesRemaining--;
      score += 100;
      spawnExplosion(deadEnemy.x, deadEnemy.y);

      // 🔁 Respawn after delay
      setTimeout(() => {
        enemies.push({
          x: Math.random() * WORLD_WIDTH,
          y: Math.random() * WORLD_HEIGHT,
          angle: Math.random() * Math.PI * 2,
          speed: 2 + level * 0.2,
          health: ENEMY_HEALTH + level * 10,
          turnTimer: Math.floor(Math.random() * 60),
          image: enemyImage,
          flareCooldown: 0,
          missileCooldown: 0,
          width: ENEMY_SIZE,
          height: ENEMY_SIZE,
          orbitAngle: Math.random() * Math.PI * 2,
          orbitDistance: 250 + Math.random() * 100,
          orbitSpeed: 0.01 + Math.random() * 0.01,
          throttle: 1.0,
          throttleTarget: 1.0,
        });
        enemiesRemaining++;
      }, 2000); // 2-second delay
    }
  }
}

function updateMissiles() {
  for (let i = missiles.length - 1; i >= 0; i--) {
    updateMissile(missiles[i], i);
  }
}

function updateEnemyBullets() {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];

    b.trailHistory = b.trailHistory || [];
    b.trailHistory.push({ x: b.x, y: b.y, alpha: 1.0 });
    if (b.trailHistory.length > 8) b.trailHistory.shift();
    b.trailHistory.forEach((p) => (p.alpha *= 0.9));

    b.x += b.vx;
    b.y += b.vy;

    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 20) {
      player.health = Math.max(0, player.health - ENEMY_BULLET_DAMAGE);
      spawnExplosion(b.x, b.y, 0.4);
      if (player.health <= 0) {
        lives--;
        if (lives > 0) {
          player.x = WORLD_WIDTH / 2;
          player.y = WORLD_HEIGHT / 2;
          player.health = 100;
        } else {
          isGameOver = true;
        }
      }

      enemyBullets.splice(i, 1);
      continue;
    }

    b.life--;
    if (
      b.life <= 0 ||
      b.x < 0 ||
      b.x > WORLD_WIDTH ||
      b.y < 0 ||
      b.y > WORLD_HEIGHT
    ) {
      enemyBullets.splice(i, 1);
    }
  }
}

function updateAllyBullets() {
  for (let i = allyBullets.length - 1; i >= 0; i--) {
    const b = allyBullets[i];

    b.trailHistory = b.trailHistory || [];
    b.trailHistory.push({ x: b.x, y: b.y, alpha: 1.0 });
    if (b.trailHistory.length > 8) b.trailHistory.shift();
    b.trailHistory.forEach((p) => (p.alpha *= 0.9));

    b.x += b.vx;
    b.y += b.vy;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dist = Math.hypot(b.x - e.x, b.y - e.y);
      if (dist < ENEMY_SIZE / 2) {
        e.health -= ALLY_BULLET_DAMAGE;
        spawnExplosion(b.x, b.y, 0.4); // 💥 Add explosion
        allyBullets.splice(i, 1);
        break;
      }
    }

    b.life--;
    if (
      b.life <= 0 ||
      b.x < 0 ||
      b.x > WORLD_WIDTH ||
      b.y < 0 ||
      b.y > WORLD_HEIGHT
    ) {
      allyBullets.splice(i, 1);
    }
  }

  for (let i = allies.length - 1; i >= 0; i--) {
    if (allies[i].health <= 0) {
      const deadAlly = allies.splice(i, 1)[0];
      spawnExplosion(deadAlly.x, deadAlly.y);

      // 🔁 Respawn after delay
      setTimeout(() => {
        allies.push({
          x: Math.random() * WORLD_WIDTH,
          y: Math.random() * WORLD_HEIGHT,
          angle: Math.random() * Math.PI * 2,
          speed: 2.5,
          health: ALLY_HEALTH,
          cooldown: 0,
          missileCooldown: 0,
          image: allyImage,
          flareCooldown: 0,
          throttle: 1.0,
          throttleTarget: 1.0,
          width: ALLY_SIZE,
          height: ALLY_SIZE,
          orbitAngle: Math.random() * Math.PI * 2,
          orbitDistance: 250 + Math.random() * 100,
          orbitSpeed: 0.01 + Math.random() * 0.01,
        });
      }, 2000); // 2-second delay
    }
  }
}

function updateFlares() {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    f.timer--;

    // ✅ Trail logic
    if (!f.trail) f.trail = [];
    f.trail.push({
      x: Math.round(f.x),
      y: Math.round(f.y),
      alpha: 1.0,
    }); // <-- updated line
    if (f.trail.length > 15) f.trail.shift();
    f.trail.forEach((p) => (p.alpha *= 0.92));

    // ✅ Apply velocity to move the flare
    f.x += f.vx;
    f.y += f.vy;

    if (f.timer <= 0) {
      flares.splice(i, 1);
    }
  }
}

function updateCamera() {
  camera.x = clamp(player.x - camera.width / 2, 0, WORLD_WIDTH - camera.width);
  camera.y = clamp(
    player.y - camera.height / 2,
    0,
    WORLD_HEIGHT - camera.height
  );
}

function updateEnemies() {
  enemies.forEach((enemy) => {
    if (enemy.flareCooldown > 0) enemy.flareCooldown--;

    // 🟣 Occasionally change throttle target for realism
    if (Math.random() < 0.01) {
      enemy.throttleTarget = 0.4 + Math.random() * 0.6;
    }

    // 🟡 Smoothly adjust throttle and apply to speed
    enemy.throttle += (enemy.throttleTarget - enemy.throttle) * 0.05;
    enemy.throttle = clamp(enemy.throttle, 0.2, 1.0);
    enemy.speed =
      MIN_PLANE_SPEED + (MAX_PLANE_SPEED - MIN_PLANE_SPEED) * enemy.throttle;

    // === Missile Dodge Check ===
    const incoming = missiles.find((m) => m.target === enemy);
    if (incoming) {
      const dodgeDir = Math.random() > 0.5 ? 1 : -1;
      enemy.angle += 0.1 * dodgeDir;

      if (enemy.flareCooldown <= 0) {
        createFlare(enemy);
        enemy.flareCooldown = 300;
        playSound("flare");
      }
    } else {
      // === Chase player ===
      // === Pick nearest target: player or any ally ===
      let closestTarget = player;
      let closestDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

      for (const ally of allies) {
        const dist = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
        if (dist < closestDist) {
          closestTarget = ally;
          closestDist = dist;
        }
      }

      // === Orbit around the chosen target ===
      orbitAroundTarget(enemy, closestTarget);

      // === Firing bullets ===
      enemy.cooldown--;
      if (enemy.cooldown <= 0 && closestDist < 800) {
        fireBullet({
          origin: enemy,
          angle: enemy.angle,
          speed: ENEMY_BULLET_SPEED,
          life: BULLET_LIFESPAN,
          targetArray: enemyBullets,
          spread: ENEMY_BULLET_SPREAD,
          offset: 30,
        });
        enemy.cooldown = ENEMY_FIRE_COOLDOWN;
      }

      // === Fire missile if available
      enemy.missileCooldown = enemy.missileCooldown || 0;
      enemy.missileCooldown--;
      if (enemy.missileCooldown <= 0 && closestDist < MISSILE_RANGE) {
        const enemyTarget = getLockedTarget(enemy, [player, ...allies]);
if (enemyTarget) {
  createMissile({
    x: enemy.x,
    y: enemy.y,
    angle: enemy.angle,
    target: enemyTarget,
    ownerType: "enemy",
  });
  enemy.missileCooldown = 240;
}
      }
    }

    avoidMapEdges(enemy);

    // === Move Forward ===
    enemy.x += Math.cos(enemy.angle) * enemy.speed;
    enemy.y += Math.sin(enemy.angle) * enemy.speed;

    updateWingTrails(enemy);

    enemy.x = clamp(enemy.x, 0, WORLD_WIDTH);
    enemy.y = clamp(enemy.y, 0, WORLD_HEIGHT);

    // === Shooting ===
    if (!enemy.cooldown) enemy.cooldown = 0;
    enemy.cooldown--;
    if (enemy.cooldown <= 0) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 800) {
        fireBullet({
          origin: enemy,
          angle: enemy.angle,
          speed: ENEMY_BULLET_SPEED,
          life: BULLET_LIFESPAN,
          targetArray: enemyBullets,
          spread: ENEMY_BULLET_SPREAD,
          offset: 30,
        });
        enemy.cooldown = ENEMY_FIRE_COOLDOWN;

        if (!enemy.missileCooldown) enemy.missileCooldown = 0;
        enemy.missileCooldown--;
        if (enemy.missileCooldown <= 0 && dist < MISSILE_RANGE) {
          createMissile({
            x: enemy.x,
            y: enemy.y,
            angle: enemy.angle,
            target: player,
            ownerType: "enemy",
          });
          enemy.missileCooldown = 240;
        }
      }
    }
  });
}

function updateAllies() {
  allies.forEach((ally) => {
    if (ally.flareCooldown > 0) ally.flareCooldown--;

    // 🟣 Randomly vary throttle target
    if (Math.random() < 0.01) {
      ally.throttleTarget = 0.4 + Math.random() * 0.6;
    }

    // 🟡 Smooth throttle change
    ally.throttle += (ally.throttleTarget - ally.throttle) * 0.05;
    ally.throttle = clamp(ally.throttle, 0.2, 1.0);
    ally.speed =
      MIN_PLANE_SPEED + (MAX_PLANE_SPEED - MIN_PLANE_SPEED) * ally.throttle;

    // === Lock onto closest opponent ===
    let closest = null;
    let closestDist = Infinity;
    for (const opp of enemies) {
      const dx = opp.x - ally.x;
      const dy = opp.y - ally.y;
      const dist = Math.hypot(dx, dy);
      if (dist < closestDist) {
        closest = opp;
        closestDist = dist;
      }
    }

    if (closest) {
      // Aim & turn toward enemy
      orbitAroundTarget(ally, closest);

      // Fire bullets
      ally.cooldown--;
      if (ally.cooldown <= 0 && closestDist < 800) {
        fireBullet({
          origin: ally,
          angle: ally.angle,
          speed: ALLY_BULLET_SPEED,
          life: BULLET_LIFESPAN,
          targetArray: allyBullets,
          spread: ALLY_BULLET_SPREAD,
          offset: 30,
        });
        ally.cooldown = ALLY_FIRE_COOLDOWN;

        // Fire missile if not on cooldown
        if (!ally.missileCooldown) ally.missileCooldown = 0;
        ally.missileCooldown--;
        if (ally.missileCooldown <= 0 && closestDist < MISSILE_RANGE) {
          const allyTarget = getLockedTarget(ally, enemies);
if (allyTarget) {
  createMissile({
    x: ally.x,
    y: ally.y,
    angle: ally.angle,
    target: allyTarget,
    ownerType: "ally",
  });
  ally.missileCooldown = 180;
}

        }
      }
    }

    // === Drop flare if missile locked ===
    const incoming = missiles.find((m) => m.target === ally);
    if (incoming && ally.flareCooldown <= 0) {
      createFlare(ally);
      ally.flareCooldown = 300;
      playSound("flare");
    }

    avoidMapEdges(ally);

    // Move forward
    ally.x += Math.cos(ally.angle) * ally.speed;
    ally.y += Math.sin(ally.angle) * ally.speed;

    updateWingTrails(ally);

    ally.x = clamp(ally.x, 0, WORLD_WIDTH);
    ally.y = clamp(ally.y, 0, WORLD_HEIGHT);
  });
}

// ======================
// [7] Render World
// ======================
function renderWorld() {
  // Sky background
  if (skyImage.loaded) {
    // Draw the sky image to cover the full world, adjusting for camera position
    ctx.drawImage(
      skyImage,
      -camera.x,
      -camera.y,
      WORLD_WIDTH,
      WORLD_HEIGHT
    );
  } else {
    // Fallback color while image is still loading
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw player
  ctx.save();
  ctx.translate(player.x - camera.x, player.y - camera.y);
  ctx.rotate(player.angle + Math.PI / 4);
  ctx.drawImage(
    player.image,
    -player.width / 2,
    -player.height / 2,
    player.width,
    player.height
  );
  ctx.restore();
}

function renderBulletImage(bullet) {
  const angle = Math.atan2(bullet.vy, bullet.vx);

  // 🟡 Draw Trail
  if (bullet.trailHistory) {
    renderBulletTrail(bullet.trailHistory);
  }

  ctx.save();
  ctx.translate(bullet.x - camera.x, bullet.y - camera.y);
  ctx.rotate(angle);
  if (bulletImage.complete) {
    ctx.drawImage(
      bulletImage,
      -BULLET_SIZE / 2,
      -BULLET_SIZE / 2,
      BULLET_SIZE,
      BULLET_SIZE
    );
  }
  ctx.restore();
}

function renderBullets() {
  bullets.forEach(renderBulletImage);
}

function renderBulletTrail(trail) {
  for (let i = 0; i < trail.length - 1; i++) {
    const p1 = trail[i];
    const p2 = trail[i + 1];
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${p1.alpha})`; // white
    ctx.lineWidth = 0.1;
    ctx.moveTo(p1.x - camera.x, p1.y - camera.y);
    ctx.lineTo(p2.x - camera.x, p2.y - camera.y);
    ctx.stroke();
  }
}

function renderMissileTrail(trail) {
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const radius = 4 * p.alpha; // size fades with alpha
    ctx.beginPath();
    ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha * 0.6})`; // light gray smoke
    ctx.shadowColor = `rgba(200, 200, 200, ${p.alpha * 0.5})`;
    ctx.shadowBlur = 5;
    ctx.arc(p.x - camera.x, p.y - camera.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reset shadow blur after drawing
  ctx.shadowBlur = 0;
}

function renderFlareTrail(trail) {
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const radius = 3 * p.alpha;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.arc(p.x - camera.x, p.y - camera.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderMissileLockLines() {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;

  // === PLAYER Lock Line ===
  const playerTarget = getLockedTarget(player, enemies);
  if (playerTarget) {
    ctx.strokeStyle = "lime";
    ctx.shadowColor = "lime";
    ctx.beginPath();
    ctx.moveTo(player.x - camera.x, player.y - camera.y);
    ctx.lineTo(playerTarget.x - camera.x, playerTarget.y - camera.y);
    ctx.stroke();
  }

  // === ALLY Lock Lines ===
  allies.forEach((ally) => {
    const allyTarget = getLockedTarget(ally, enemies);
    if (allyTarget) {
      ctx.strokeStyle = "cyan";
      ctx.shadowColor = "cyan";
      ctx.beginPath();
      ctx.moveTo(ally.x - camera.x, ally.y - camera.y);
      ctx.lineTo(allyTarget.x - camera.x, allyTarget.y - camera.y);
      ctx.stroke();
    }
  });

  // === ENEMY Lock Lines ===
  enemies.forEach((enemy) => {
    const enemyTarget = getLockedTarget(enemy, [player, ...allies]);
    if (enemyTarget) {
      ctx.strokeStyle = "red";
      ctx.shadowColor = "red";
      ctx.beginPath();
      ctx.moveTo(enemy.x - camera.x, enemy.y - camera.y);
      ctx.lineTo(enemyTarget.x - camera.x, enemyTarget.y - camera.y);
      ctx.stroke();
    }
  });

  ctx.restore();
}



function updateWingTrails(plane) {
  if (!plane) return;
  if (!plane.wingTrail) plane.wingTrail = [];

  const wingOffset = plane.width * 0.4;
  const backwardOffset = plane.height * 0.3;

  const baseX = plane.x - Math.cos(plane.angle) * backwardOffset;
  const baseY = plane.y - Math.sin(plane.angle) * backwardOffset;

  const leftX = baseX + Math.cos(plane.angle + Math.PI / 2) * wingOffset;
  const leftY = baseY + Math.sin(plane.angle + Math.PI / 2) * wingOffset;
  const rightX = baseX + Math.cos(plane.angle - Math.PI / 2) * wingOffset;
  const rightY = baseY + Math.sin(plane.angle - Math.PI / 2) * wingOffset;

  plane.wingTrail.push({ x: leftX, y: leftY, alpha: 0.5 });
  plane.wingTrail.push({ x: rightX, y: rightY, alpha: 0.5 });

  if (plane.wingTrail.length > 100)
    plane.wingTrail.splice(0, plane.wingTrail.length - 100);
  plane.wingTrail.forEach((p) => (p.alpha *= 0.9));
}

function drawAllWingTrails() {
  drawWingTrailsFor(player, "white");
  allies.forEach((a) => drawWingTrailsFor(a, "white"));
  enemies.forEach((e) => drawWingTrailsFor(e, "white"));
}

function drawWingTrailsFor(plane, color = "white") {
  if (!plane.wingTrail) return;
  for (const trail of plane.wingTrail) {
    const screenX = trail.x - camera.x;
    const screenY = trail.y - camera.y;

    ctx.save();
    ctx.globalAlpha = trail.alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function renderEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x - camera.x, e.y - camera.y);
    ctx.rotate(e.angle + Math.PI / 4);
    if (e.image && e.image.loaded) {
      ctx.drawImage(
        e.image,
        -ENEMY_SIZE / 2,
        -ENEMY_SIZE / 2,
        ENEMY_SIZE,
        ENEMY_SIZE
      );
    }

    ctx.restore();

    // Health bar
    ctx.fillStyle = "black";
    ctx.fillRect(
      e.x - 25 - camera.x,
      e.y - ENEMY_SIZE / 2 - 20 - camera.y,
      50,
      6
    );
    ctx.fillStyle = "lime";
    ctx.fillRect(
      e.x - 25 - camera.x,
      e.y - ENEMY_SIZE / 2 - 20 - camera.y,
      (e.health / ENEMY_HEALTH) * 50,
      6
    );
    
  });
}

function renderAllies() {
  allies.forEach((a) => {
    ctx.save();
    ctx.translate(a.x - camera.x, a.y - camera.y);
    ctx.rotate(a.angle + Math.PI / 4);
    ctx.drawImage(
      a.image,
      -ALLY_SIZE / 2,
      -ALLY_SIZE / 2,
      ALLY_SIZE,
      ALLY_SIZE
    );
    ctx.restore();

    // Health bar
    ctx.fillStyle = "black";
    ctx.fillRect(
      a.x - 25 - camera.x,
      a.y - ALLY_SIZE / 2 - 20 - camera.y,
      50,
      6
    );
    ctx.fillStyle = "cyan";
    ctx.fillRect(
      a.x - 25 - camera.x,
      a.y - ALLY_SIZE / 2 - 20 - camera.y,
      (a.health / ALLY_HEALTH) * 50,
      6
    );
  });
}

function renderAllyBullets() {
  allyBullets.forEach(renderBulletImage);
}

function renderMissiles() {
  missiles.forEach((m) => {
    // 🟡 Draw missile trail
    if (!m.trailHistory) m.trailHistory = [];
    const trailOffset = 20; // how far behind the missile
    const trailX = m.x - Math.cos(m.angle) * trailOffset;
    const trailY = m.y - Math.sin(m.angle) * trailOffset;
    m.trailHistory.push({ x: trailX, y: trailY, alpha: 1.0 });

    if (m.trailHistory.length > 20) m.trailHistory.shift();
    m.trailHistory.forEach((p) => (p.alpha *= 0.95));

    renderMissileTrail(m.trailHistory);

    // 🟢 Draw missile image
    const angle = m.angle;
    ctx.save();
    ctx.translate(m.x - camera.x, m.y - camera.y);
    ctx.rotate(angle);
    if (missileImage.complete) {
      ctx.drawImage(
        missileImage,
        -MISSILE_SIZE / 2,
        -MISSILE_SIZE / 2,
        MISSILE_SIZE,
        MISSILE_SIZE
      );
    }
    ctx.restore();
  });
}

function renderFlares() {
  flares.forEach((f) => {
    if (f.trail) renderFlareTrail(f.trail);

    const size = f.size || 24; // use custom size or default
    ctx.save();
    ctx.translate(f.x - camera.x, f.y - camera.y);

    if (flareImage.complete && flareImage.naturalWidth !== 0) {
      ctx.drawImage(flareImage, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

function renderEnemyBullets() {
  enemyBullets.forEach(renderBulletImage);
}

function spawnExplosion(x, y, size = 1.0) {
  explosions.push({ x, y, timer: EXPLOSION_DURATION, size });
}

function dropFlareFromPlayer() {
  createFlare(player);
}

function updateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].timer--;
    if (explosions[i].timer <= 0) {
      explosions.splice(i, 1);
    }
  }
}

function renderExplosions() {
  explosions.forEach((e) => {
    const alpha = e.timer / EXPLOSION_DURATION;
    const size = 64 * alpha * e.size; // scale explosion over time
    ctx.save();
    ctx.globalAlpha = alpha;

    if (explosionImage.complete && explosionImage.naturalWidth !== 0) {
      ctx.drawImage(
        explosionImage,
        e.x - camera.x - size / 2,
        e.y - camera.y - size / 2,
        size,
        size
      );
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

// ======================
// [8] Render HUD
// ======================
function renderHUD() {
  ctx.save();
  ctx.resetTransform();

  ctx.font = "16px monospace";
  ctx.fillStyle = "#00ffcc";
  ctx.fillText(`Throttle: ${((player.speed / player.maxSpeed) * 100).toFixed(0)}%`, 20, 30);
  ctx.fillText(`Health: ${player.health}%`, 20, 55);
  ctx.fillText(`Score: ${score}`, 20, 130);

  const now = performance.now();
  const fps = Math.round(1000 / (now - lastFrameTime));
  lastFrameTime = now;
  ctx.fillText(`FPS: ${fps}`, 20, 80);
  ctx.fillText(`Lives: ${lives}`, 20, 105);
  ctx.fillText(`Level: ${level}`, 20, 155);

  const restartBtn = document.getElementById("restartBtn");

  if (isGameOver) {
    ctx.fillStyle = "red";
    ctx.font = "48px sans-serif";
    ctx.fillText("GAME OVER", canvas.width / 2 - 120, canvas.height / 2);

    restartBtn.style.display = "block"; // ✅ Show button
  } else {
    restartBtn.style.display = "none"; // ✅ Hide button when playing
  }

  if (isPaused && !isGameOver) {
    ctx.fillStyle = "yellow";
    ctx.font = "36px sans-serif";
    ctx.fillText("PAUSED", canvas.width / 2 - 60, canvas.height / 2);
  }

  ctx.restore();
}


let lastFrameTime = performance.now();

// ======================
// [9] Game Loop
// ======================
function update() {
  updatePlayer();
  updateBullets();
  updateMissiles();
  updateEnemyBullets();
  updateAllyBullets();
  updateAllies();
  updateEnemies();
  updateFlares();
  updateExplosions();
  updateCamera();

  if (enemiesRemaining <= 0) {
    level++;
    enemiesRemaining = ENEMY_COUNT + level * 2;

    for (let i = 0; i < enemiesRemaining; i++) {
      enemies.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        angle: Math.random() * Math.PI * 2,
        speed: 2 + level * 0.2,
        health: ENEMY_HEALTH + level * 10,
        turnTimer: Math.floor(Math.random() * 60),
        image: enemyImage,
        missileCooldown: 0,
      });
    }
  }
}

function renderRadar() {
  const radarSize = 150;
  const padding = 20;
  const radarX = canvas.width - radarSize - padding;
  const radarY = padding;

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(radarX, radarY, radarSize, radarSize);
  ctx.strokeStyle = "white";
  ctx.strokeRect(radarX, radarY, radarSize, radarSize);

  const worldToRadarX = radarSize / WORLD_WIDTH;
  const worldToRadarY = radarSize / WORLD_HEIGHT;

  function drawTriangle(worldX, worldY, angle, color) {
    const rx = radarX + worldX * worldToRadarX;
    const ry = radarY + worldY * worldToRadarY;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(angle + Math.PI / 2); // ✅ Fix: align with right-facing 0°
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -4);     // Tip (forward)
    ctx.lineTo(-3, 3);     // Left base
    ctx.lineTo(3, 3);      // Right base
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw player
  drawTriangle(player.x, player.y, player.angle, "lime");

  // Draw allies
  allies.forEach((ally) => {
    drawTriangle(ally.x, ally.y, ally.angle, "cyan");
  });

  // Draw enemies
  enemies.forEach((enemy) => {
    drawTriangle(enemy.x, enemy.y, enemy.angle, "red");
  });
}

function drawOffscreenIndicators() {
  const entities = [...enemies, ...allies]; // You'll change this below to match your variables

  for (const entity of entities) {
    if (entity.health <= 0) continue;

    const dx = entity.x - player.x;
    const dy = entity.y - player.y;
    const angle = Math.atan2(dy, dx);

    const screenX = entity.x - camera.x;
    const screenY = entity.y - camera.y;

    const isOffscreen =
      screenX < 0 ||
      screenX > canvas.width ||
      screenY < 0 ||
      screenY > canvas.height;

    if (!isOffscreen) continue;

    // Determine position relative to player screen center
    const playerScreenX = player.x - camera.x;
    const playerScreenY = player.y - camera.y;
    const radius = 80; // or try 60, 100, etc.

    const indicatorX = playerScreenX + Math.cos(angle) * radius;
    const indicatorY = playerScreenY + Math.sin(angle) * radius;

    // Draw triangle
    ctx.save();
    ctx.translate(indicatorX, indicatorY);
    ctx.rotate(angle + Math.PI / 2);

    ctx.beginPath();
    ctx.moveTo(0, -10); // Tip
    ctx.lineTo(-6, 8);
    ctx.lineTo(6, 8);
    ctx.closePath();

    ctx.fillStyle = enemies.includes(entity) ? "red" : "cyan"; // match your allies/enemies
    ctx.fill();
    ctx.restore();
  }
}


function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderWorld();
  drawAllWingTrails();
  renderAllies();
  renderEnemies();
  renderMissileLockLines(); // ✅ Add this
  renderFlares();
  renderExplosions(); // BOOM
  renderAllyBullets();
  renderBullets();
  renderMissiles();
  renderEnemyBullets();
  renderHUD();
  renderRadar();
  drawOffscreenIndicators();
}

function restartGame() {
  // Reset state flags
  isGameOver = false;
  isPaused = false;
  lives = 3;
  score = 0;
  level = 1;

  // Reset player at bottom-right
  player.x = WORLD_WIDTH - 300;
  player.y = WORLD_HEIGHT - 300;
  player.health = 100;
  player.angle = 0;
  player.throttle = 1.0;
  player.throttleTarget = 1.0;

  // Clear game arrays
  bullets.length = 0;
  missiles.length = 0;
  enemyBullets.length = 0;
  allyBullets.length = 0;
  flares.length = 0;
  explosions.length = 0;
  enemies.length = 0;
  allies.length = 0;

  // Respawn enemies at top-left
  for (let i = 0; i < ENEMY_COUNT; i++) {
    enemies.push({
      x: 200 + Math.random() * 100,
      y: 200 + Math.random() * 100,
      angle: Math.random() * Math.PI * 2,
      speed: 2,
      health: ENEMY_HEALTH,
      turnTimer: Math.floor(Math.random() * 60),
      image: enemyImage,
      flareCooldown: 0,
      missileCooldown: 0,
      width: ENEMY_SIZE,
      height: ENEMY_SIZE,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitDistance: 250 + Math.random() * 100,
      orbitSpeed: 0.01 + Math.random() * 0.01,
      throttle: 1.0,
      throttleTarget: 1.0,
    });
  }

  enemiesRemaining = ENEMY_COUNT;

  // Respawn allies near bottom-right
  for (let i = 0; i < ALLY_COUNT; i++) {
    allies.push({
      x: WORLD_WIDTH - 300 + Math.random() * 100,
      y: WORLD_HEIGHT - 300 + Math.random() * 100,
      angle: Math.random() * Math.PI * 2,
      speed: 2.5,
      health: ALLY_HEALTH,
      cooldown: 0,
      missileCooldown: 0,
      image: allyImage,
      flareCooldown: 0,
      throttle: 1.0,
      throttleTarget: 1.0,
      width: ALLY_SIZE,
      height: ALLY_SIZE,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitDistance: 250 + Math.random() * 100,
      orbitSpeed: 0.01 + Math.random() * 0.01,
    });
  }
}

function gameLoop() {
  if (!isPaused && !isGameOver) {
    update();
  }
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
