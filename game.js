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

let patrolCenter = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  timer: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function createFlare(fromPlane) {
  if (!fromPlane || typeof fromPlane.x !== "number" || fromPlane.health <= 0)
    return;
  const rearAngle = fromPlane.angle + Math.PI;
  const pairSpread = 0.4;
  const speed = 3;
  const flareSize = 7;
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

function getLockedTarget(source, targets, sourceType = "unknown") {
  for (const t of targets) {
    if (
      (sourceType === "ally" && t === player) || // ⛔ prevent allies from targeting player
      (sourceType === "enemy" && enemies.includes(t)) || // ⛔ prevent enemies from targeting themselves
      (sourceType === "player" && t === player) // ⛔ prevent player self-target
    ) {
      continue;
    }

    const dx = t.x - source.x;
    const dy = t.y - source.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MISSILE_RANGE) continue;

    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - source.angle;

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
  shoot: new Audio("sounds/shoot.mp3"),
  explosion: new Audio("sounds/explosion.wav"),
  missile: new Audio("sounds/missile.mp3"),
  flare: new Audio("sounds/flares.mp3"),
  sonicboom: new Audio("sounds/sonicboom.mp3"),
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
  width: 50,
  height: 50,
  health: 100,
  throttle: 1.0,
  throttleTarget: 1.0,
  orbitAngle: Math.random() * Math.PI * 2, // ✅ Add this
  orbitDistance: 300, // ✅ Add this
  orbitSpeed: 0.015, // ✅ Add this
  boosting: false,
  boostTimer: 0,
  boostDuration: 120, // frames (2 seconds at 60fps)
  boostMultiplier: 1.5,
};

let kills = 0;
let score = 0;
let isPaused = false;
let isGameOver = false;

const bullets = [];
const BULLET_SPEED = 12;
const BULLET_LIFESPAN = 100; // ~1 second @ 60fps
const BULLET_SIZE = 10;
let shootCooldown = 0;

const trails = [];

const missiles = [];
const MISSILE_SPEED = 6;
const MISSILE_TURN_RATE = 0.02;
const MISSILE_SIZE = 30;
const MISSILE_RANGE = 900;
const MISSILE_CONE = Math.PI / 6; // ~30°
const MISSILE_DAMAGE = 50;
let missileCooldown = 0;
const MISSILE_LIFESPAN = 400; // Change this value to increase/decrease

let flareCooldown = 0;
const FLARE_COOLDOWN_MAX = 300; // ~5 seconds @ 60 FPS

const enemies = [];
const ENEMY_COUNT = 2;
const ENEMY_SIZE = 50;
const ENEMY_HEALTH = 50;

let level = 1;
let enemiesRemaining = ENEMY_COUNT;

const enemyBullets = [];
const ENEMY_FIRE_COOLDOWN = 10;
const ENEMY_BULLET_SPEED = 12;

const allies = [];
const ALLY_COUNT = 1;
const ALLY_SIZE = 50;
const ALLY_HEALTH = 100;
const allyBullets = [];
const ALLY_FIRE_COOLDOWN = 10;
const ALLY_BULLET_SPEED = 12;

const flares = [];
const FLARE_DURATION = 90;

const explosions = [];
const EXPLOSION_DURATION = 30;

let sonicBooms = [];

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

const SPAWN_PLAYER_X = WORLD_WIDTH - 300;
const SPAWN_PLAYER_Y = WORLD_HEIGHT - 300;

const SPAWN_ALLY_X = WORLD_WIDTH - 300;
const SPAWN_ALLY_Y = WORLD_HEIGHT - 300;

const SPAWN_ENEMY_X = 200;
const SPAWN_ENEMY_Y = 200;

let joyX = 0;
let joyY = 0;

for (let i = 0; i < ENEMY_COUNT; i++) {
  enemies.push({
    x: SPAWN_ENEMY_X + Math.random() * 100,
    y: SPAWN_ENEMY_Y + Math.random() * 100,
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
    boosting: false,
    boostTimer: 0,
    boostDuration: 120,
    boostMultiplier: 1.5,
  });
}

for (let i = 0; i < ALLY_COUNT; i++) {
  allies.push({
    x: SPAWN_ALLY_X + Math.random() * 100,
    y: SPAWN_ALLY_Y + Math.random() * 100,
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
    boosting: false,
    boostTimer: 0,
    boostDuration: 120,
    boostMultiplier: 1.5,
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
  if (e.key.toLowerCase() === "h" && flareCooldown <= 0) {
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
  if (e.key.toLowerCase() === "j") {
    autopilotEnabled = !autopilotEnabled;
  }
});

window.addEventListener("keydown", (e) => {
  if (
    e.key.toLowerCase() === "b" &&
    !player.boosting &&
    player.throttle >= 0.99
  ) {
    player.boosting = true;
    player.boostTimer = player.boostDuration;

    sonicBooms.push({
      x: player.x,
      y: player.y,
      radius: 0,
      alpha: 1.0,
      angle: player.angle,
    });
    playSound("sonicboom");
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

function setupUI() {
  const joystick = document.getElementById("joystick");
  const thumb = document.getElementById("thumb");

  joystick.addEventListener(
    "touchmove",
    (e) => {
      const touch = e.touches[0];
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      joyX = dx / 40;
      joyY = dy / 40;

      const maxDistance = 30;
      const angle = Math.atan2(dy, dx);
      const distance = Math.min(Math.hypot(dx, dy), maxDistance);
      thumb.style.left = `${30 + Math.cos(angle) * distance}px`;
      thumb.style.top = `${30 + Math.sin(angle) * distance}px`;

      e.preventDefault();
    },
    { passive: false }
  );

  joystick.addEventListener("touchend", () => {
    joyX = 0;
    joyY = 0;
    thumb.style.left = "30px";
    thumb.style.top = "30px";
  });

  const upBtn = document.getElementById("throttleUpBtn");
  const downBtn = document.getElementById("throttleDownBtn");
  let throttleInterval = null;

  function startThrottle(direction) {
    if (throttleInterval) clearInterval(throttleInterval);
    throttleInterval = setInterval(() => {
      player.throttleTarget = clamp(
        player.throttleTarget + direction * 0.05,
        0.2,
        1.0
      );
    }, 30);
  }

  function stopThrottle() {
    clearInterval(throttleInterval);
    throttleInterval = null;
  }

  upBtn.addEventListener("mousedown", () => startThrottle(1));
  downBtn.addEventListener("mousedown", () => startThrottle(-1));
  upBtn.addEventListener("mouseup", stopThrottle);
  downBtn.addEventListener("mouseup", stopThrottle);
  upBtn.addEventListener("mouseleave", stopThrottle);
  downBtn.addEventListener("mouseleave", stopThrottle);
  upBtn.addEventListener("touchstart", () => startThrottle(1));
  downBtn.addEventListener("touchstart", () => startThrottle(-1));
  upBtn.addEventListener("touchend", stopThrottle);
  downBtn.addEventListener("touchend", stopThrottle);

  let fireInterval = null;
  document.getElementById("fireBtn").addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (fireInterval) return;

    fireInterval = setInterval(() => {
      if (shootCooldown <= 0) {
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
    }, 50); // fire every 100ms (adjust for faster/slower shooting)
  });

  document.getElementById("fireBtn").addEventListener("touchend", (e) => {
    e.preventDefault();
    clearInterval(fireInterval);
    fireInterval = null;
  });

  document.getElementById("missileBtn").addEventListener("touchstart", (e) => {
    e.preventDefault();
    fireMissile(); // or keys["m"] = true
  });

  document.getElementById("flareBtn").addEventListener("touchstart", (e) => {
    e.preventDefault();
    createFlare(player);
  });

  document.getElementById("restartBtn").addEventListener("click", () => {
    restartGame();
  });

  document.addEventListener("contextmenu", (e) => {
    if (e.target.closest("button") || e.target.tagName === "IMG") {
      e.preventDefault();
    }
  });

  const autopilotBtn = document.getElementById("autopilotBtn");
  autopilotBtn.addEventListener("click", () => {
    autopilotEnabled = !autopilotEnabled;
    autopilotBtn.style.border = autopilotEnabled
      ? "2px solid lime"
      : "2px solid #444";
  });
}

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
  playSound("shoot");
}

function fireMissile() {
  if (missileCooldown <= 0) {
    const target = getLockedTarget(player, enemies, "player");
    if (target) {
      createMissile({
        x: player.x,
        y: player.y,
        angle: player.angle,
        target,
        ownerType: "player",
      });
      missileCooldown = 180; // 🔁 adjust cooldown as needed
    }
  }
}

function createMissile({ x, y, angle, target, ownerType }) {
  missiles.push({
    x,
    y,
    angle,
    target,
    ownerType, // ✅ Now defined
    trailHistory: [],
    lifetime: MISSILE_LIFESPAN,
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
    if (dist > 300 || f.ownerType === m.ownerType) return false;

    const angleToFlare = Math.atan2(dy, dx);
    let angleDiff = angleToFlare - m.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    return Math.abs(angleDiff) < MISSILE_CONE; // ✅ Only flares in front cone
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
    m.angle += clamp(diff, -MISSILE_TURN_RATE * 0.6, MISSILE_TURN_RATE * 0.6);
    // m.angle += clamp(diff, -MISSILE_TURN_RATE, MISSILE_TURN_RATE);
  }

  m.x += Math.cos(m.angle) * MISSILE_SPEED;
  m.y += Math.sin(m.angle) * MISSILE_SPEED;

  m.trailHistory = m.trailHistory || [];
  m.trailHistory.push({ x: m.x, y: m.y, alpha: 1.0 });
  if (m.trailHistory.length > 20) m.trailHistory.shift();
  m.trailHistory.forEach((p) => (p.alpha *= 0.95));

  m.lifetime--;

  // === Impact
  let dist = Infinity;
  if (
    target &&
    (typeof target.health === "number" ||
      target === player ||
      flares.includes(target))
  ) {
    dist = Math.hypot(m.x - target.x, m.y - target.y);
  }

  // if (dist < 40 || m.lifetime <= 0) {
  //   if (target && typeof target.health === "number") {
  //     // Apply damage only if target is valid and opposite type
  //     const isFriendlyFire =
  //       (m.ownerType === "player" && target === player) ||
  //       (m.ownerType === "enemy" && enemies.includes(target)) ||
  //       (m.ownerType === "ally" && allies.includes(target));
  //     if (!isFriendlyFire) {
  //       let damage = 0;
  //       if (m.ownerType === "player") damage = PLAYER_MISSILE_DAMAGE;
  //       else if (m.ownerType === "ally") damage = ALLY_MISSILE_DAMAGE;
  //       else if (m.ownerType === "enemy") damage = ENEMY_MISSILE_DAMAGE;

  //       target.health = Math.max(0, target.health - damage);

  //       if (typeof target.health === "number" && target.health <= 0) {
  //         spawnExplosion(target.x, target.y);

  //         if (m.ownerType === "player" && enemies.includes(target)) {
  //           kills++;
  //         }

  //         if (target === player) {
  //           player.x = SPAWN_PLAYER_X;
  //           player.y = SPAWN_PLAYER_Y;
  //           player.health = 100;

  //           // Clear missiles still targeting the player
  //           for (let i = missiles.length - 1; i >= 0; i--) {
  //             if (missiles[i].target === player) {
  //               missiles.splice(i, 1);
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }
  //   spawnExplosion(m.x, m.y);
  //   missiles.splice(index, 1);
  // }
  if (dist < 40) {
    if (target && typeof target.health === "number") {
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

        if (typeof target.health === "number" && target.health <= 0) {
          spawnExplosion(target.x, target.y);

          if (m.ownerType === "player" && enemies.includes(target)) {
            kills++;
          }

          if (target === player) {
            player.x = SPAWN_PLAYER_X;
            player.y = SPAWN_PLAYER_Y;
            player.health = 100;

            // Clear missiles still targeting the player
            for (let i = missiles.length - 1; i >= 0; i--) {
              if (missiles[i].target === player) {
                missiles.splice(i, 1);
              }
            }
          }
        }
      }
    }
    spawnExplosion(m.x, m.y);
    missiles.splice(index, 1);
  } else if (m.lifetime <= 0) {
    // Only explode visually, no damage
    spawnExplosion(m.x, m.y);
    missiles.splice(index, 1);
  }
}

function runAutopilot(entity, targetList, ownerType = "player") {
  const target = getLockedTarget(entity, targetList, ownerType);

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
    const wanderX = patrolCenter.x + Math.cos(entity.orbitAngle) * 300;
    const wanderY = patrolCenter.y + Math.sin(entity.orbitAngle) * 300;

    orbitAroundTarget(entity, { x: wanderX, y: wanderY });
  }

  // === Throttle control
  entity.throttleTarget = 1.0;
  entity.throttle += (entity.throttleTarget - entity.throttle) * 0.1;
  entity.throttle = clamp(entity.throttle, 0.5, 1.0);
  entity.speed =
    MIN_PLANE_SPEED + (MAX_PLANE_SPEED - MIN_PLANE_SPEED) * entity.throttle;

  if (entity.boosting && entity.boostTimer > 0) {
    entity.speed *= entity.boostMultiplier;
    entity.boostTimer--;
    if (entity.boostTimer <= 0) entity.boosting = false;
  }

  // Optional AI logic to auto-trigger boost if being chased
  const shouldBoost =
    missiles.find((m) => m.target === entity) || Math.random() < 0.001; // rare random boost
  if (!entity.boosting && shouldBoost && entity.throttle >= 0.99) {
    entity.boosting = true;
    entity.boostTimer = entity.boostDuration;

    sonicBooms.push({
      x: entity.x,
      y: entity.y,
      radius: 0,
      alpha: 1.0,
      angle: entity.angle,
    });

    playSound("sonicboom");
  }

  // === Separation: Avoid clustering with nearby allies/opponents
  const others =
    ownerType === "ally" ? allies : ownerType === "enemy" ? enemies : [];
  const SEPARATION_RADIUS = 2000;
  let repulseX = 0;
  let repulseY = 0;

  for (const other of others) {
    if (other === entity || other.health <= 0) continue;
    const dx = entity.x - other.x;
    const dy = entity.y - other.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && dist < SEPARATION_RADIUS) {
      const force = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS;
      repulseX += (dx / dist) * force;
      repulseY += (dy / dist) * force;
    }
  }

  entity.x += repulseX * 0.5;
  entity.y += repulseY * 0.5;

  // === Rear Avoidance: Don't get too close behind other planes
  const REAR_AVOID_DIST = 100; // how close is "too close"
  const REAR_AVOID_ANGLE = Math.PI / 3; // 60° rear cone

  const avoidTargets = [...allies, ...enemies, player].filter(
    (other) => other !== entity && other.health > 0
  );

  for (const other of avoidTargets) {
    const dx = other.x - entity.x;
    const dy = other.y - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist < REAR_AVOID_DIST) {
      const angleToEntity = Math.atan2(entity.y - other.y, entity.x - other.x);
      let rearDiff = angleToEntity - other.angle;
      while (rearDiff > Math.PI) rearDiff -= 2 * Math.PI;
      while (rearDiff < -Math.PI) rearDiff += 2 * Math.PI;

      // If we're inside the other plane's rear cone, back off
      if (Math.abs(rearDiff) < REAR_AVOID_ANGLE) {
        // Steer slightly away from the target's rear
        const avoidAngle = Math.atan2(dy, dx) + Math.PI; // move opposite of other
        entity.angle += clamp(avoidAngle - entity.angle, -0.05, 0.05);
      }
    }
  }

  avoidMapEdges(entity);

  entity.x += Math.cos(entity.angle) * entity.speed;
  entity.y += Math.sin(entity.angle) * entity.speed;
  entity.x = clamp(entity.x, 0, WORLD_WIDTH);
  entity.y = clamp(entity.y, 0, WORLD_HEIGHT);

  // === Initialize cooldowns if not present
  entity.cooldown = entity.cooldown ?? 0;
  entity.missileCooldown = entity.missileCooldown ?? 0;
  entity.flareCooldown = entity.flareCooldown ?? 0;

  // === Decrease cooldowns
  if (entity.cooldown > 0) entity.cooldown--;
  if (entity.missileCooldown > 0) entity.missileCooldown--;
  if (entity.flareCooldown > 0) entity.flareCooldown--;

  // === Fire bullets
  if (target && entity.cooldown <= 0) {
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.hypot(dx, dy);
    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = angleToTarget - entity.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const angleThreshold = Math.PI / 2; // 90° forward cone

    const TOO_CLOSE_DIST = 80; // Avoid shooting when very close

    if (Math.abs(angleDiff) < angleThreshold && dist > TOO_CLOSE_DIST) {
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
  }

  // === Fire missiles with cooldown
  if (target && entity.missileCooldown <= 0) {
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.hypot(dx, dy);
    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = angleToTarget - entity.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    angleDiff = Math.abs(angleDiff);

    const angleThreshold = MISSILE_CONE * 1.5;
    const TOO_CLOSE_DIST = 120; // Prevent missile spam under own body

    if (
      angleDiff < angleThreshold &&
      dist > TOO_CLOSE_DIST &&
      dist < MISSILE_RANGE
    ) {
      createMissile({
        x: entity.x,
        y: entity.y,
        angle: entity.angle,
        target,
        ownerType,
        owner: entity,
      });

      entity.missileCooldown = 180;
    }
  }

  // === Drop flare if missile is near and cooldown expired
  const MISSILE_DANGER_RADIUS = 150;
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
    updateEngineTrail(player);
    return; // skip manual controls
  }

  if (typeof updatePlayerJoystick === "function") updatePlayerJoystick();

  // 🔵 Throttle input control (W / ArrowUp = up, S / ArrowDown = down)
  if (keys["w"] || keys["arrowup"]) {
    player.throttleTarget = 1.0;
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
  let baseSpeed =
    MIN_PLANE_SPEED + (MAX_PLANE_SPEED - MIN_PLANE_SPEED) * player.throttle;
  if (player.boosting && player.boostTimer > 0) {
    player.speed = baseSpeed * player.boostMultiplier;
    player.boostTimer--;
    if (player.boostTimer <= 0) player.boosting = false;
  } else {
    player.speed = baseSpeed;
  }

  avoidMapEdges(player);

  // Move
  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);

  updateWingTrails(player);

  // Shooting
  if ((keys["f"] || keys["F"]) && shootCooldown <= 0) {
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
  if ((keys["g"] || keys["G"]) && missileCooldown <= 0) {
    const target = getLockedTarget(player, enemies, "player");
    if (target) {
      createMissile({
        x: player.x,
        y: player.y,
        angle: player.angle,
        target,
        ownerType: "player",
      });
      missileCooldown = 180;
    }
  }
  if (missileCooldown > 0) missileCooldown--;
  if (flareCooldown > 0) flareCooldown--;
  updateWingTrails(player);
  updateEngineTrail(player);
}

function updatePlayerJoystick() {
  const magnitude = Math.hypot(joyX, joyY);
  if (magnitude > 0.2) {
    const desiredAngle = Math.atan2(joyY, joyX); // joystick gives direction
    let diff = desiredAngle - player.angle;

    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    // Smoothly rotate toward the joystick direction
    player.angle += clamp(diff, -0.08, 0.08);

    // Apply throttle based on joystick push strength
    player.throttleTarget = clamp(magnitude, 0.2, 1.0);
  } else {
    // No strong input? Idle
    player.throttleTarget = 0.2;
  }

  // === Boost via joystick if full strength in any direction
  if (
    magnitude > 0.95 &&
    !player.boosting &&
    player.throttle >= 0.99
  ) {
    player.boosting = true;
    player.boostTimer = player.boostDuration;

    sonicBooms.push({
      x: player.x,
      y: player.y,
      radius: 0,
      alpha: 1.0,
      angle: player.angle,
    });

    playSound("sonicboom");
  }
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
      kills++;
      spawnExplosion(deadEnemy.x, deadEnemy.y);

      // 🔁 Respawn after delay
      // setTimeout(() => {
      //   enemies.push({
      //     x: Math.random() * WORLD_WIDTH,
      //     y: Math.random() * WORLD_HEIGHT,
      //     angle: Math.random() * Math.PI * 2,
      //     speed: 2 + level * 0.2,
      //     health: ENEMY_HEALTH + level * 10,
      //     turnTimer: Math.floor(Math.random() * 60),
      //     image: enemyImage,
      //     flareCooldown: 0,
      //     missileCooldown: 0,
      //     width: ENEMY_SIZE,
      //     height: ENEMY_SIZE,
      //     orbitAngle: Math.random() * Math.PI * 2,
      //     orbitDistance: 250 + Math.random() * 100,
      //     orbitSpeed: 0.01 + Math.random() * 0.01,
      //     throttle: 1.0,
      //     throttleTarget: 1.0,
      //   });
      //   enemiesRemaining++;
      // }, 2000);
    }
  }
}

function updateMissiles() {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    if (m) {
      updateMissile(m, i);
    }
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
        player.x = SPAWN_PLAYER_X;
        player.y = SPAWN_PLAYER_Y;
        player.health = 100;
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
        if (allies.length < ALLY_COUNT) {
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
            boosting: false,
            boostTimer: 0,
            boostDuration: 120,
            boostMultiplier: 1.5,
          });
        }
      }, 2000);
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
    runAutopilot(enemy, [player, ...allies], "enemy");
    updateWingTrails(enemy);
    updateEngineTrail(enemy);
  });
}

function updateAllies() {
  allies.forEach((ally) => {
    runAutopilot(ally, enemies, "ally");
    updateWingTrails(ally);
    updateEngineTrail(ally);
  });
}

// ======================
// [7] Render World
// ======================
function renderWorld() {
  // Sky background
  if (skyImage.loaded) {
    // Draw the sky image to cover the full world, adjusting for camera position
    ctx.drawImage(skyImage, -camera.x, -camera.y, WORLD_WIDTH, WORLD_HEIGHT);
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
    const radius = 3 * p.alpha; // Increased size

    let rgb = "220, 220, 220"; // Brighter gray
    if (p.color === "white") rgb = "255, 255, 255";

    ctx.beginPath();
    ctx.fillStyle = `rgba(${rgb}, ${p.alpha * 0.99})`; // Higher opacity
    ctx.shadowColor = `rgba(${rgb}, ${p.alpha * 0.5})`; // Brighter glow
    ctx.shadowBlur = 12; // Stronger glow
    ctx.arc(p.x - camera.x, p.y - camera.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

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

function drawLockEmoji(source, target, color = "white") {
  ctx.save();
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillText("🔒", target.x - camera.x, target.y - camera.y - 40);
  ctx.restore();
}

function renderMissileLockLines() {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;

  // === PLAYER Lock Line + Lock Emoji
  const playerTarget = getLockedTarget(player, enemies, "player");
  if (playerTarget) {
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "lime";
    ctx.shadowColor = "lime";
    ctx.beginPath();
    ctx.moveTo(player.x - camera.x, player.y - camera.y);
    ctx.lineTo(playerTarget.x - camera.x, playerTarget.y - camera.y);
    ctx.stroke();
    drawLockEmoji(player, playerTarget, "lime");
    ctx.globalAlpha = 1.0;
  }

  // === ALLY Lock Lines + Lock Emoji
  allies.forEach((ally) => {
    const allyTarget = getLockedTarget(ally, enemies, "ally");
    if (allyTarget) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "cyan";
      ctx.shadowColor = "cyan";
      ctx.beginPath();
      ctx.moveTo(ally.x - camera.x, ally.y - camera.y);
      ctx.lineTo(allyTarget.x - camera.x, allyTarget.y - camera.y);
      ctx.stroke();
      drawLockEmoji(ally, allyTarget, "cyan");
      ctx.globalAlpha = 1.0;
    }
  });

  // === ENEMY Lock Lines + Lock Emoji
  enemies.forEach((enemy) => {
    const enemyTarget = getLockedTarget(enemy, [player, ...allies], "enemy");
    if (enemyTarget) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "red";
      ctx.shadowColor = "red";
      ctx.beginPath();
      ctx.moveTo(enemy.x - camera.x, enemy.y - camera.y);
      ctx.lineTo(enemyTarget.x - camera.x, enemyTarget.y - camera.y);
      ctx.stroke();
      drawLockEmoji(enemy, enemyTarget, "red");
      ctx.globalAlpha = 1.0;
    }
  });

  ctx.restore();
}

function updateEngineTrail(plane) {
  if (!plane) return;
  if (!plane.engineTrail) plane.engineTrail = [];

  const backwardOffset = plane.height * 0.5;
  const sideOffset = plane.width * 0.1;

  const baseX = plane.x - Math.cos(plane.angle) * backwardOffset;
  const baseY = plane.y - Math.sin(plane.angle) * backwardOffset;

  const leftX = baseX + Math.cos(plane.angle + Math.PI / 2) * sideOffset;
  const leftY = baseY + Math.sin(plane.angle + Math.PI / 2) * sideOffset;

  const rightX = baseX + Math.cos(plane.angle - Math.PI / 2) * sideOffset;
  const rightY = baseY + Math.sin(plane.angle - Math.PI / 2) * sideOffset;

  plane.engineTrail.push({ x: leftX, y: leftY, alpha: 0.6 });
  plane.engineTrail.push({ x: rightX, y: rightY, alpha: 0.6 });

  if (plane.engineTrail.length > 100)
    plane.engineTrail.splice(0, plane.engineTrail.length - 100);

  plane.engineTrail.forEach((p) => (p.alpha *= 0.92));
}

function drawAllEngineTrails() {
  drawEngineTrailFor(player, player.boosting ? "#ffffcc" : "white"); // pale yellow-white if boosting
  allies.forEach((a) =>
    drawEngineTrailFor(a, a.boosting ? "#ffffcc" : "white")
  );
  enemies.forEach((e) =>
    drawEngineTrailFor(e, e.boosting ? "#ffffcc" : "white")
  );
}

function drawEngineTrailFor(plane, color = "white") {
  if (!plane.engineTrail) return;
  for (const t of plane.engineTrail) {
    const screenX = t.x - camera.x;
    const screenY = t.y - camera.y;

    ctx.save();
    ctx.globalAlpha = t.alpha * 0.6;
    ctx.fillStyle = color;

    // ✨ Apply stronger glow only when not plain white
    ctx.shadowColor = color;
    ctx.shadowBlur = color !== "white" ? 12 : 6;

    ctx.beginPath();
    ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
    ctx.fillStyle = "red";
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
    ctx.fillStyle = "lime";
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
    const trailOffset = 22; // how far behind the missile
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
  playSound("explosion");
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

function updateSonicBooms() {
  for (let i = sonicBooms.length - 1; i >= 0; i--) {
    const boom = sonicBooms[i];
    boom.radius += 8; // slower expansion
    boom.alpha *= 0.92; // slower fade
    if (boom.alpha < 0.05) {
      sonicBooms.splice(i, 1);
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

function renderSonicBooms() {
  for (const boom of sonicBooms) {
    const x = boom.x - camera.x;
    const y = boom.y - camera.y;

    const coneLength = 120;
    const coneWidth = 80;

    // 🔺 Draw sonic shock cone (like in the photo)
    ctx.save();
    ctx.translate(x + Math.cos(boom.angle) * 25, y + Math.sin(boom.angle) * 25);
    ctx.rotate((boom.angle || 0) + Math.PI); // 🔄 Correct the cone direction

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coneLength);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${boom.alpha * 1.0})`);
    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(coneLength, -coneWidth / 2);
    ctx.lineTo(coneLength, coneWidth / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Optional: ring for extra flair
    ctx.save();
    ctx.globalAlpha = boom.alpha * 0.3;
    ctx.strokeStyle = `rgba(255, 255, 255, ${boom.alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, boom.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1.0;
}

// ======================
// [8] Render HUD
// ======================
function renderHUD() {
  ctx.save();
  ctx.resetTransform();

  ctx.font = "16px monospace";
  ctx.fillStyle = "#00ffcc";
  ctx.fillText(
    `Throttle: ${((player.speed / player.maxSpeed) * 100).toFixed(0)}%`,
    20,
    30
  );
  ctx.fillText(`Health: ${player.health}%`, 20, 55);
  ctx.fillText(`Kills: ${kills}`, 20, 105);
  ctx.fillText(`Score: ${score}`, 20, 130);

  const now = performance.now();
  const fps = Math.round(1000 / (now - lastFrameTime));
  lastFrameTime = now;
  ctx.fillText(`FPS: ${fps}`, 20, 80);
  ctx.fillText(`Level: ${level}`, 20, 155);

  const restartBtn = document.getElementById("restartBtn");

  restartBtn.style.display = "none";

  if (isPaused) {
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
  if (isPaused) return;
  updatePlayer();
  updateBullets();
  updateMissiles();
  updateEnemyBullets();
  updateAllyBullets();
  updateAllies();
  updateEnemies();
  updateFlares();
  updateSonicBooms();
  updateExplosions();
  updateCamera();

  if (enemiesRemaining <= 0 && enemies.length < ENEMY_COUNT) {
    for (let i = enemies.length; i < ENEMY_COUNT; i++) {
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
        boosting: false,
        boostTimer: 0,
        boostDuration: 120,
        boostMultiplier: 1.5,
      });
    }
    enemiesRemaining = enemies.length;
  }

  // === Update Patrol Center Every Few Seconds ===
  patrolCenter.timer--;
  if (patrolCenter.timer <= 0) {
    patrolCenter.x = 200 + Math.random() * (WORLD_WIDTH - 400);
    patrolCenter.y = 200 + Math.random() * (WORLD_HEIGHT - 400);
    patrolCenter.timer = 300; // 1 second
    // patrolCenter.timer = 600 + Math.random() * 600;
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
    ctx.moveTo(0, -4); // Tip (forward)
    ctx.lineTo(-3, 3); // Left base
    ctx.lineTo(3, 3); // Right base
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
  drawAllEngineTrails();
  renderAllies();
  renderEnemies();
  renderMissileLockLines(); // ✅ Add this
  renderSonicBooms();
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
  kills = 0;
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
  update();
  render();
  requestAnimationFrame(gameLoop);
}
gameLoop();

setupUI();
