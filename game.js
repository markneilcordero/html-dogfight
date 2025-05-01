// ====================
// [1] Setup and Initialization
// ====================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

const camera = {
  x: 0,
  y: 0,
  width: window.innerWidth,
  height: window.innerHeight,
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.width = canvas.width;
  camera.height = canvas.height;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// === Load Images ===
const images = {
  sky: loadImage("images/sky.jpg"),
  player: loadImage("images/player.png"),
  opponent: loadImage("images/opponent.png"),
  bullet: loadImage("images/bullet.png"),
  missile: loadImage("images/missile.png"),
  flare: loadImage("images/flare.png"),
  explosion: loadImage("images/explosion.png"),
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function adjustThrottle(
  entity,
  targetThrust,
  rate = 0.02,
  minThrust = 3,
  maxThrust = 5
) {
  if (entity.thrust < targetThrust) {
    entity.thrust = Math.min(entity.thrust + rate, targetThrust);
  } else if (entity.thrust > targetThrust) {
    entity.thrust = Math.max(entity.thrust - rate, targetThrust);
  }

  // Clamp to min/max bounds
  entity.thrust = clamp(entity.thrust, minThrust, maxThrust);
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

// ====================
// [2] Player Controls
// ====================
const joystick = document.getElementById("joystick");
const joystickContainer = document.getElementById("joystickContainer");
let joystickAngle = 0;
let joystickActive = false;

function setupJoystickControls() {
  const container = document.getElementById("joystickContainer");
  const joystick = document.getElementById("joystick");

  container.addEventListener(
    "touchstart",
    (e) => {
      joystickActive = true;
    },
    { passive: false }
  );

  container.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    joystickAngle = Math.atan2(dy, dx);

    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * distance;
    const knobY = Math.sin(angle) * distance;

    joystick.style.left = `50%`;
    joystick.style.top = `50%`;
    joystick.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
  });

  container.addEventListener("touchend", () => {
    joystickActive = false;
    joystick.style.transform = `translate(-50%, -50%)`;
  });
}

setupJoystickControls();

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

function setupThrottleControls() {
  const btnThrottleUp = document.getElementById("btnThrottleUp");
  const btnThrottleDown = document.getElementById("btnThrottleDown");

  let throttleIntervalUp = null;
  let throttleIntervalDown = null;

  // === Throttle Up Button ===
  btnThrottleUp.addEventListener(
    "touchstart",
    () => {
      if (throttleIntervalUp) return;
      throttleIntervalUp = setInterval(() => {
        player.thrust += 0.2;
        if (player.thrust > 5) player.thrust = 5;
      }, 50);
    },
    { passive: true }
  );

  btnThrottleUp.addEventListener("touchend", () => {
    clearInterval(throttleIntervalUp);
    throttleIntervalUp = null;
  });

  btnThrottleUp.addEventListener("touchcancel", () => {
    clearInterval(throttleIntervalUp);
    throttleIntervalUp = null;
  });

  // === Throttle Down Button ===
  btnThrottleDown.addEventListener(
    "touchstart",
    () => {
      if (throttleIntervalDown) return;
      throttleIntervalDown = setInterval(() => {
        player.thrust -= 0.2;
        if (player.thrust < 1.0) player.thrust = 1.0;
      }, 50);
    },
    { passive: true }
  );

  btnThrottleDown.addEventListener("touchend", () => {
    clearInterval(throttleIntervalDown);
    throttleIntervalDown = null;
  });

  btnThrottleDown.addEventListener("touchcancel", () => {
    clearInterval(throttleIntervalDown);
    throttleIntervalDown = null;
  });
}

function setupWeaponControls() {
  const btnMachineGun = document.getElementById("btnMachineGun");
  const btnMissile = document.getElementById("btnMissile");
  const btnFlare = document.getElementById("btnFlare");

  let machineGunInterval = null;
  let missileTouchHandled = false;

  // === Machine Gun Button (touch) ===
  btnMachineGun.addEventListener(
    "touchstart",
    () => {
      if (machineGunInterval) return;
      machineGunInterval = setInterval(fireMachineGun, 100);
    },
    { passive: true }
  );

  btnMachineGun.addEventListener("touchend", () => {
    clearInterval(machineGunInterval);
    machineGunInterval = null;
  });

  btnMachineGun.addEventListener("touchcancel", () => {
    clearInterval(machineGunInterval);
    machineGunInterval = null;
  });

  // === Machine Gun Key (keyboard) ===
  window.addEventListener("keydown", (e) => {
    if (e.key === "f" && !machineGunInterval) {
      machineGunInterval = setInterval(fireMachineGun, 100);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "f") {
      clearInterval(machineGunInterval);
      machineGunInterval = null;
    }
  });

  // === Missile Button (touch and click) ===
  btnMissile.addEventListener(
    "touchstart",
    () => {
      missileTouchHandled = true;
      fireMissile();
    },
    { passive: true }
  );

  btnMissile.addEventListener("click", () => {
    if (missileTouchHandled) {
      missileTouchHandled = false; // skip accidental double fire
      return;
    }
    fireMissile();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "g") {
      fireMissile();
    }
  });

  // === Flare Button (click) ===
  btnFlare.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault(); // <--- allow touch even if joystick is active
      if (player.flareCooldown <= 0) {
        releaseFlaresFor(player);
        player.flareCooldown = 300;
      }
    },
    { passive: false }
  );

  window.addEventListener("keydown", (e) => {
    if (e.key === "h" && player.flareCooldown <= 0) {
      releaseFlaresFor(player);
      player.flareCooldown = 300;
    }
  });
}

function setupPlayerAIButton() {
  const btnAI = document.getElementById("btnAI");
  const btnMode = document.getElementById("btnMode");

  btnMode.addEventListener("click", () => {
    const modes = ["balanced", "aggressive", "defensive"];
    const currentIndex = modes.indexOf(autopilotMode);
    autopilotMode = modes[(currentIndex + 1) % modes.length];

    createFloatingText(
      `🧠 Mode: ${autopilotMode.toUpperCase()}`,
      player.x,
      player.y - 80,
      "yellow",
      20
    );
  });

  btnAI.addEventListener("click", () => {
    playerAIEnabled = !playerAIEnabled;
    createFloatingText(
      playerAIEnabled ? "🧠 AI ON" : "🧠 AI OFF",
      player.x,
      player.y - 80,
      "cyan",
      20
    );
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "j" || e.key === "J") {
      playerAIEnabled = !playerAIEnabled;
      createFloatingText(
        playerAIEnabled ? "🧠 AI ON" : "🧠 AI OFF",
        player.x,
        player.y - 80,
        "cyan",
        20
      );
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "k") {
      const modes = ["balanced", "aggressive", "defensive"];
      const currentIndex = modes.indexOf(autopilotMode);
      autopilotMode = modes[(currentIndex + 1) % modes.length];
      createFloatingText(
        `🧠 Mode: ${autopilotMode.toUpperCase()}`,
        player.x,
        player.y - 80,
        "yellow",
        20
      );
    }
  });
}

setupThrottleControls();
setupWeaponControls();
setupPlayerAIButton();

// ====================
// [3] Entity Definitions
// ====================
const player = createPlane(WORLD_WIDTH - 150, WORLD_HEIGHT - 150);
player.angle = -Math.PI / 2; // Point upward
player.isTakingOff = true;
player.taxiTimer = 120;
player.killCount = 0;
updateCamera();

// === 10 Opponents randomly placed on map
const opponents = [];
const oppStartX = 50; // Starting X position near top-left
const oppStartY = 50;

for (let i = 0; i < 10; i++) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = oppStartX + col * 60;
  const y = oppStartY + row * 60;

  const opp = createPlane(x, y);
  opp.angle = Math.PI / 2; // Downward
  opp.isTakingOff = false;
  opp.delayedTaxiStart = i * 90; // staggered takeoff
  opp.taxiTimer = 90;
  opp.hasStartedTaxi = false;

  opp.mode = Math.random() < 0.5 ? "aggressive" : "defensive";

  opponents.push(opp);
}

// === 9 Allies near the player (formation)
// === 9 Allies at the bottom-right corner "airport"
const allies = [];
const startX = WORLD_WIDTH - 200;
const startY = WORLD_HEIGHT - 200;

for (let i = 0; i < 9; i++) {
  const row = Math.floor(i / 3);
  const col = i % 3;
  const x = startX + col * 50;
  const y = startY + row * 50;
  const ally = createPlane(x, y);
  ally.angle = -Math.PI / 2; // Pointing up

  // ✅ Delayed takeoff logic
  ally.isTakingOff = false;
  ally.delayedTaxiStart = i * 60; // stagger each ally by 60 frames (1 second)
  ally.taxiTimer = 90; // actual taxi time once started

  ally.mode = Math.random() < 0.5 ? "aggressive" : "defensive"; // or randomized

  allies.push(ally);
}

let machineGunBullets = [],
  missiles = [],
  flares = [],
  explosions = [];
let opponentBullets = [],
  opponentMissiles = [];
let particles = [],
  wingTrails = [],
  floatingTexts = [];

let isMissileLockedOn = false;
let lockOnAlertCooldown = 0;
let missileLockAnnounced = false;

let playerRespawnCooldown = 0;
let playerDead = false;

let playerAIEnabled = false; // 🧠 Whether player AI is on
let autopilotMode = "balanced"; // "balanced", "aggressive", "defensive"

// === Lock Variables ===
const PLAYER_LOCK_TIME = 10; // Player needs 1.5 seconds to lock (adjust this!)
const OPPONENT_LOCK_TIME = 60; // Opponent needs 1.5 seconds to lock (adjust this!)

let playerMissileLockTimer = 0; // how long player has been locking onto opponent
let playerMissileLockReady = false;

let playerLockTarget = null;
let playerLockTimer = 0;

let opponentMissileLockTimer = 0; // how long opponent has been locking onto player
let opponentMissileLockReady = false;

// Inside createPlane():
function createPlane(x, y) {
  return {
    x,
    y,
    width: 60,
    height: 60,
    speed: 1,
    angle: 0,
    thrust: 1.0,
    health: 100,
    maxHealth: 100,
    wingTrails: [],
    engineParticles: [],
    orbitDirection: Math.random() < 0.5 ? 1 : -1,
    dodgeCooldown: 0,
    dodgeOffset: 0,
    flareCooldown: 0,
    machineGunAmmo: 200, // 🔫 New
    missileAmmo: 4, // 🚀 New
    lockTimer: 0,
    lockTarget: null,
    collisionCooldown: 0,
    mode: "balanced",
    missileCooldown: 0,
    maxTurnRate: 0.01,
  };
}

function respawnPlane(plane, isOpponent = false) {
  let safe = false;
  let attempt = 0;

  while (!safe && attempt < 10) {
    if (isOpponent) {
      const offsetX = Math.floor(Math.random() * 2) * 60;
      const offsetY = Math.floor(Math.random() * 5) * 60;
      plane.x = 50 + offsetX;
      plane.y = 50 + offsetY;
      plane.angle = Math.PI / 2; // Take off downward
      plane.isTakingOff = true;
      plane.taxiTimer = 90;
      plane.hasStartedTaxi = false;
    } else {
      const offsetX = Math.floor(Math.random() * 3) * 50;
      const offsetY = Math.floor(Math.random() * 3) * 50;
      plane.x = WORLD_WIDTH - 200 + offsetX;
      plane.y = WORLD_HEIGHT - 200 + offsetY;
      plane.angle = -Math.PI / 2;

      plane.isTakingOff = true;
      plane.taxiTimer = 120;
      plane.hasStartedTaxi = false;
    }

    // ✅ Stay away from player spawn (if not the player)
    const dx = plane.x - player.x;
    const dy = plane.y - player.y;
    const dist = Math.hypot(dx, dy);

    safe = dist > 300;
    attempt++;
  }

  if (isOpponent) {
    plane.angle = Math.PI / 2; // Downward (top-left airport)
  } else {
    plane.angle = -Math.PI / 2; // Upward (bottom-right airport)
  }
  plane.health = plane.maxHealth;
  plane.thrust = 1.0;
  plane.engineParticles = [];
  plane.wingTrails = [];
  plane.orbitDirection = Math.random() < 0.5 ? 1 : -1;
  plane.dodgeCooldown = 0;
  plane.dodgeOffset = 0;

  plane.machineGunAmmo = 200;
  plane.missileAmmo = 4;

  plane.collisionCooldown = 60; // 1 second cooldown

  createFloatingText(
    "✈️ Respawned!",
    plane.x,
    plane.y - 40,
    isOpponent ? "red" : "cyan",
    16
  );
}

// ====================
// [4] Utility Functions
// ====================
function createFloatingText(text, x, y, color = "white", size = 20) {
  floatingTexts.push({ text, x, y, color, size, alpha: 1, life: 60 });
}

function createParticle(x, y, angle, color) {
  particles.push({
    x,
    y,
    angle,
    color,
    radius: 3 + Math.random() * 2,
    alpha: 1,
  });
}

function createTrail(x, y, color) {
  wingTrails.push({ x, y, color, alpha: 0.6 });
  if (wingTrails.length > 60) wingTrails.shift();
}

function findNearestOpponent(x, y) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const opp of opponents) {
    if (opp.health <= 0) continue; // ignore dead opponents

    const dx = opp.x - x;
    const dy = opp.y - y;
    const dist = Math.hypot(dx, dy);

    if (dist < nearestDist) {
      nearest = opp;
      nearestDist = dist;
    }
  }

  return { target: nearest, distance: nearestDist };
}

function findNearestFlare(x, y) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const flare of flares) {
    const dx = flare.x - x;
    const dy = flare.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearestDist) {
      nearest = flare;
      nearestDist = dist;
    }
  }

  return nearest;
}

function findNearestEnemy(x, y) {
  let nearest = player;
  let nearestDist = Math.hypot(player.x - x, player.y - y);

  for (const ally of allies) {
    if (ally.health <= 0) continue;
    const dist = Math.hypot(ally.x - x, ally.y - y);
    if (dist < nearestDist) {
      nearest = ally;
      nearestDist = dist;
    }
  }

  return { target: nearest, distance: nearestDist };
}

function findNearestEnemyFlare(x, y, ownerType) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const flare of flares) {
    if (
      (ownerType === "ally" && allies.includes(flare.owner)) ||
      (ownerType === "opponent" && opponents.includes(flare.owner))
    ) {
      continue; // 🚫 Skip flares from same team
    }

    const dx = flare.x - x;
    const dy = flare.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearestDist) {
      nearest = flare;
      nearestDist = dist;
    }
  }

  return nearest;
}

function findAggroTarget(entity, defaultFinder) {
  const now = performance.now(); // use timestamp
  if (entity.lastAttacker && entity.lastAttacker.health > 0) {
    if (!entity.lastAttackedTime || now - entity.lastAttackedTime < 5000) {
      return {
        target: entity.lastAttacker,
        distance: Math.hypot(
          entity.x - entity.lastAttacker.x,
          entity.y - entity.lastAttacker.y
        ),
      };
    }
  }
  return defaultFinder(entity.x, entity.y);
}

function detectIncomingFire(entity) {
  for (const b of machineGunBullets) {
    const dx = b.x - entity.x;
    const dy = b.y - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 150) return true;
  }
  return false;
}

function detectIncomingMissile(entity) {
  for (const m of opponentMissiles) {
    const dx = m.x - entity.x;
    const dy = m.y - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 300) return true; // missile within danger zone
  }
  return false;
}

function applyAntiStacking(allPlanes, minDistance = 80, strength = 0.05) {
  for (let i = 0; i < allPlanes.length; i++) {
    for (let j = i + 1; j < allPlanes.length; j++) {
      const a = allPlanes[i];
      const b = allPlanes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);

      if (dist < minDistance && dist > 0.01) {
        const repel = (minDistance - dist) * strength;
        const nx = dx / dist;
        const ny = dy / dist;

        a.x += nx * repel;
        a.y += ny * repel;
        b.x -= nx * repel;
        b.y -= ny * repel;
      }
    }
  }
}

// Avoid nearby allies or opponents (real-time adjustment)
function avoidOthers(self, others, avoidDistance = 80, avoidStrength = 0.02) {
  let offsetX = 0;
  let offsetY = 0;
  for (const other of others) {
    if (self === other || other.health <= 0) continue;

    const dx = self.x - other.x;
    const dy = self.y - other.y;
    const dist = Math.hypot(dx, dy);
    if (dist < avoidDistance && dist > 0.01) {
      const force = (avoidDistance - dist) / avoidDistance; // 0 to 1
      const nx = dx / dist;
      const ny = dy / dist;
      offsetX += nx * force * avoidStrength * 60;
      offsetY += ny * force * avoidStrength * 60;
    }
  }

  // Apply total offset softly
  self.x += offsetX;
  self.y += offsetY;
}

function checkCollision(entityA, entityB, threshold = 100) {
  const dx = entityA.x - entityB.x;
  const dy = entityA.y - entityB.y;
  const distance = Math.hypot(dx, dy);
  return distance < threshold;
}

function isAngleAligned(angle1, angle2, tolerance = Math.PI / 6) {
  let diff = ((angle1 - angle2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return Math.abs(diff) <= tolerance;
}

function isInMissileCone(
  player,
  target,
  maxRange = 900,
  coneAngle = Math.PI / 6
) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance > maxRange) return false; // ✅ Allow close-range locks

  const angleToTarget = Math.atan2(dy, dx);
  const angleDiff =
    ((angleToTarget - player.angle + Math.PI * 3) % (2 * Math.PI)) - Math.PI;

  return Math.abs(angleDiff) <= coneAngle;
}

// ====================
// [5] Player Actions
// ====================
function fireMachineGun() {
  if (player.machineGunAmmo <= 0) {
    createFloatingText("🔫 OUT OF AMMO", player.x, player.y - 60, "gray", 16);
    return;
  }

  // 🔥 Add small random angle spread (±2.5 degrees)
  const spread = (Math.random() - 0.5) * (Math.PI / 36); // ≈ ±5 degrees
  const bulletAngle = player.angle + spread;

  machineGunBullets.push({
    x: player.x,
    y: player.y,
    angle: bulletAngle,
    speed: 16,
    life: 500,
    owner: player,
  });

  player.machineGunAmmo--;
}

function fireAllyMachineGun(ally) {
  if (ally.machineGunAmmo <= 0) return;

  const targetData = findNearestOpponent(ally.x, ally.y);
  if (!targetData.target) return;

  const predicted = predictTargetPosition(ally, targetData.target, 16); // 16 = bullet speed
  const dx = predicted.x - ally.x;
  const dy = predicted.y - ally.y;
  const angle = Math.atan2(dy, dx);

  machineGunBullets.push({
    x: ally.x,
    y: ally.y,
    angle,
    speed: 16,
    life: 500,
    owner: ally,
  });

  ally.machineGunAmmo--;
}

function fireAllyMissile(ally) {
  if (ally.missileAmmo <= 0) return;
  let nearestOpponent = null;
  let nearestDist = Infinity;

  for (const opp of opponents) {
    const dx = opp.x - ally.x;
    const dy = opp.y - ally.y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestOpponent = opp;
    }
  }

  if (!nearestOpponent) return;

  const predicted = predictTargetPosition(ally, nearestOpponent, 4);
  const dx = predicted.x - ally.x;
  const dy = predicted.y - ally.y;

  const distance = Math.hypot(dx, dy);
  const maxRange = 900;
  if (distance > maxRange) return; // ✅ Allow close range shots

  const targetAngle = Math.atan2(dy, dx);
  const angleDiff = Math.abs(
    ((ally.angle - targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI
  );
  const maxAngleOffset = Math.PI / 6; // ±30 degrees
  if (angleDiff > maxAngleOffset) return;

  missiles.push({
    x: ally.x,
    y: ally.y,
    angle: targetAngle,
    speed: 6,
    life: 250,
    target: nearestOpponent,
    owner: ally,
  });

  ally.missileAmmo--;
}

function fireMissile() {
  if (player.missileAmmo <= 0) {
    createFloatingText(
      "🚀 OUT OF MISSILES",
      player.x,
      player.y - 60,
      "gray",
      16
    );
    return;
  }

  // === Find nearest opponent
  let nearestOpponent = null;
  let nearestDist = Infinity;

  for (const opp of opponents) {
    const dx = opp.x - player.x;
    const dy = opp.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestOpponent = opp;
    }
  }

  if (!nearestOpponent) return;

  const predicted = predictTargetPosition(player, nearestOpponent, 4); // 4 = missile speed
  const dx = predicted.x - player.x;
  const dy = predicted.y - player.y;
  const targetAngle = Math.atan2(dy, dx);

  if (!isInMissileCone(player, nearestOpponent)) {
    const dx = nearestOpponent.x - player.x;
    const dy = nearestOpponent.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleToTarget = Math.atan2(dy, dx);
    const angleDiff =
      ((angleToTarget - player.angle + Math.PI * 3) % (2 * Math.PI)) - Math.PI;

    let reason = "❌ NOT IN RANGE";
    if (dist < 0) {
      reason = "❌ INVALID DIST";
    } else if (dist > 900) {
      reason = "❌ TOO FAR";
    } else if (Math.abs(angleDiff) > Math.PI / 6) {
      reason = "❌ NOT ALIGNED";
    }

    createFloatingText(reason, player.x, player.y - 60, "gray", 16);
    return;
  }

  missiles.push({
    x: player.x,
    y: player.y,
    angle: targetAngle,
    speed: 6,
    life: 250,
    target: nearestOpponent,
    owner: player,
  });

  player.missileAmmo--;
  playerMissileLockReady = false;
  playerMissileLockTimer = 0;
}

function releaseFlaresFor(entity) {
  const flarePairs = 10; // 5 pairs = 10 total flares
  const flareSpacing = 20; // distance from center
  const baseAngle = entity.angle + Math.PI; // backwards
  const delayBetweenPairs = 80; // in milliseconds

  for (let i = 0; i < flarePairs; i++) {
    setTimeout(() => {
      for (let dir of [-1, 1]) {
        // left (-1), right (+1)
        const offsetX =
          entity.x +
          Math.cos(entity.angle + (dir * Math.PI) / 2) * flareSpacing;
        const offsetY =
          entity.y +
          Math.sin(entity.angle + (dir * Math.PI) / 2) * flareSpacing;
        const spread = (Math.random() - 0.5) * 0.5;

        flares.push({
          x: offsetX,
          y: offsetY,
          angle: baseAngle + spread,
          speed: 1 + Math.random() * 0.5,
          life: 100,
          size: 12 + Math.random() * 6,
          owner: entity, // ✅ assign owner
        });
      }

      // Optional: create text on first pair only
      if (i === 0) {
        createFloatingText("🔥 Flares!", entity.x, entity.y - 60, "orange", 16);
      }
    }, i * delayBetweenPairs);
  }
}

// ====================
// [6] Opponent AI
// ====================
function updateOpponents() {
  for (const opp of opponents) {
    if (opp.health <= 0) {
      if (opp.lastAttacker === player) {
        player.killCount++;
        createFloatingText(
          `☠️ Kills: ${player.killCount}`,
          player.x,
          player.y - 100,
          "lime",
          20
        );
      }

      createExplosion(opp.x, opp.y, 100);
      respawnPlane(opp, true);
      continue;
    }

    if (!opp.isTakingOff && opp.delayedTaxiStart > 0) {
      opp.delayedTaxiStart--;
      continue;
    }

    if (!opp.hasStartedTaxi && opp.delayedTaxiStart <= 0) {
      opp.isTakingOff = true;
      opp.hasStartedTaxi = true;
      opp.taxiTimer = 90;
      createFloatingText(
        "🛫 Opponent Taking Off!",
        opp.x,
        opp.y - 50,
        "red",
        14
      );
      continue;
    }

    if (opp.isTakingOff) {
      opp.thrust = 0.5;
      moveForward(opp);
      createEngineParticles(opp);
      opp.taxiTimer--;

      if (opp.taxiTimer > 0) continue;
      opp.isTakingOff = false;
      opp.thrust = 5;
      continue;
    }

    // 🔒 Force aggressive mode only
    opp.mode = "aggressive";

    const { target, distance } = findAggroTarget(opp, findNearestEnemy);

    if (target) {
      // === Ammo Regen
      if (opp.machineGunAmmo <= 0) {
        opp.ammoRegenTimer = (opp.ammoRegenTimer || 0) + 1;
        if (opp.ammoRegenTimer >= 120) {
          opp.machineGunAmmo = 200;
          createFloatingText(
            "🔫 Opponent Ammo Refilled!",
            opp.x,
            opp.y - 40,
            "red",
            14
          );
          opp.ammoRegenTimer = 0;
        }
      } else {
        opp.ammoRegenTimer = 0;
      }

      if (opp.missileAmmo <= 0) {
        opp.missileRegenTimer = (opp.missileRegenTimer || 0) + 1;
        if (opp.missileRegenTimer >= 300) {
          opp.missileAmmo = 4;
          opp.lockTarget = null;
          opp.lockTimer = 0;
          createFloatingText(
            "🚀 Opponent Missile Refilled!",
            opp.x,
            opp.y - 60,
            "red",
            14
          );
          opp.missileRegenTimer = 0;
        }
      } else {
        opp.missileRegenTimer = 0;
      }

      const dx = target.x - opp.x;
      const dy = target.y - opp.y;
      const offset = Math.PI / 3;

      maybeDodge(opp);
      const targetAngle =
        Math.atan2(dy, dx) + offset * opp.orbitDirection + opp.dodgeOffset;

      avoidMapEdges(opp);
      const underFire = detectIncomingFire(opp);
      if (underFire) {
        maybeDodge(opp);
        adjustThrottle(opp, 4.5);
      }

      // 🧠 Aggressive behavior
      adjustThrottle(opp, 5);
      rotateToward(opp, targetAngle, 0.015, 0);
      moveForward(opp);

      bounceOffWalls(opp);
      createEntityWingTrails(opp);
      createEngineParticles(opp);

      const angleToTarget = Math.atan2(dy, dx);
      if (
        distance < 800 &&
        isAngleAligned(opp.angle, angleToTarget) &&
        Math.random() < 0.05
      ) {
        fireOpponentMachineGun(opp);
      }

      if (isInMissileCone(opp, target)) {
        if (opp.lockTarget === target) {
          opp.lockTimer += 1;
        } else {
          opp.lockTarget = target;
          opp.lockTimer = 1;
        }

        const shouldFireMissile =
          opp.lockTimer > OPPONENT_LOCK_TIME &&
          opp.missileAmmo > 0 &&
          isAngleAligned(opp.angle, angleToTarget) &&
          Math.random() < 0.1;

        if (shouldFireMissile) {
          createFloatingText("🚀 LOCKED", target.x, target.y - 50, "red", 18);
          fireOpponentMissile(opp, target);
          opp.lockTimer = 0;
        }
      } else {
        opp.lockTimer = Math.max(0, opp.lockTimer - 1);
        opp.lockTarget = null;
      }
    }

    if (opp.collisionCooldown > 0) opp.collisionCooldown--;
  }
}

function updateAllies() {
  for (const ally of allies) {
    if (!ally.isTakingOff && ally.delayedTaxiStart > 0) {
      ally.delayedTaxiStart--;
      continue;
    }

    if (!ally.hasStartedTaxi && ally.delayedTaxiStart <= 0) {
      ally.isTakingOff = true;
      ally.hasStartedTaxi = true;
      ally.taxiTimer = 90;
      createFloatingText(
        "🛫 Ally Taking Off!",
        ally.x,
        ally.y - 50,
        "cyan",
        14
      );
      continue;
    }

    if (!ally.isTakingOff && ally.delayedTaxiStart <= 0) {
      ally.isTakingOff = true;
      ally.taxiTimer = 90;
    }

    if (ally.health <= 0) {
      createExplosion(ally.x, ally.y, 100);
      respawnPlane(ally, false);
      continue;
    }

    // 🔒 Force aggressive mode only
    ally.mode = "aggressive";

    const { target: nearestOpponent, distance: nearestDist } = findAggroTarget(
      ally,
      findNearestOpponent
    );

    if (nearestOpponent) {
      // === Ammo Regen
      if (ally.machineGunAmmo <= 0) {
        ally.ammoRegenTimer = (ally.ammoRegenTimer || 0) + 1;
        if (ally.ammoRegenTimer >= 120) {
          ally.machineGunAmmo = 200;
          createFloatingText(
            "🔫 Ally Ammo Refilled!",
            ally.x,
            ally.y - 40,
            "cyan",
            14
          );
          ally.ammoRegenTimer = 0;
        }
      } else {
        ally.ammoRegenTimer = 0;
      }

      if (ally.missileAmmo <= 0) {
        ally.missileRegenTimer = (ally.missileRegenTimer || 0) + 1;
        if (ally.missileRegenTimer >= 300) {
          ally.missileAmmo = 4;
          ally.lockTarget = null;
          ally.lockTimer = 0;
          createFloatingText(
            "🚀 Ally Missile Refilled!",
            ally.x,
            ally.y - 60,
            "cyan",
            14
          );
          ally.missileRegenTimer = 0;
        }
      } else {
        ally.missileRegenTimer = 0;
      }

      const dx = nearestOpponent.x - ally.x;
      const dy = nearestOpponent.y - ally.y;
      const offset = Math.PI / 3;
      maybeDodge(ally);
      const targetAngle =
        Math.atan2(dy, dx) + offset * ally.orbitDirection + ally.dodgeOffset;

      avoidMapEdges(ally);
      const underFire = detectIncomingFire(ally);
      if (underFire) {
        maybeDodge(ally);
        adjustThrottle(ally, 4.5);
      }

      adjustThrottle(ally, 5);
      rotateToward(ally, targetAngle, ally.maxTurnRate || 0.015, 0);
      moveForward(ally);

      avoidOthers(ally, allies);
      bounceOffWalls(ally);
      createEntityWingTrails(ally);
      createEngineParticles(ally);

      const angleToTarget = Math.atan2(dy, dx);
      if (
        nearestDist < 600 &&
        isAngleAligned(ally.angle, angleToTarget) &&
        Math.random() < 0.04
      ) {
        fireAllyMachineGun(ally);
      }

      if (isInMissileCone(ally, nearestOpponent)) {
        if (ally.lockTarget === nearestOpponent) {
          ally.lockTimer += 1;
        } else {
          ally.lockTarget = nearestOpponent;
          ally.lockTimer = 1;
        }

        const shouldFireMissile =
          ally.lockTimer > OPPONENT_LOCK_TIME &&
          ally.missileAmmo > 0 &&
          isAngleAligned(ally.angle, angleToTarget) &&
          Math.random() < 0.1;

        if (shouldFireMissile) {
          createFloatingText(
            "🚀 LOCKED",
            nearestOpponent.x,
            nearestOpponent.y - 50,
            "cyan",
            18
          );
          fireAllyMissile(ally);
          ally.lockTimer = 0;
        }
      } else {
        ally.lockTimer = Math.max(0, ally.lockTimer - 1);
        ally.lockTarget = null;
      }
    }

    if (ally.collisionCooldown > 0) ally.collisionCooldown--;
  }
}

function updateOpponentBullets() {
  for (let i = opponentBullets.length - 1; i >= 0; i--) {
    const b = opponentBullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;

    // Check collision with player
    let hit = false;
    const targets = [player, ...allies];
    for (const t of targets) {
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        t.health -= 1;
        createExplosion(t.x, t.y, 20);
        t.lastAttacker = b.owner || null;
        t.lastAttackedTime = performance.now();
        opponentBullets.splice(i, 1);
        hit = true;
        break;
      }
    }
    if (hit) continue;

    if (b.life <= 0) {
      createExplosion(b.x, b.y, 15);
      opponentBullets.splice(i, 1);
    }
  }
}

function fireOpponentMachineGun(opp) {
  if (opp.machineGunAmmo <= 0) return;

  const targetData = findNearestEnemy(opp.x, opp.y); // target allies or player
  if (!targetData.target) return;

  const predicted = predictTargetPosition(opp, targetData.target, 12); // 12 = opponent bullet speed
  const dx = predicted.x - opp.x;
  const dy = predicted.y - opp.y;
  const angle = Math.atan2(dy, dx);

  opponentBullets.push({
    x: opp.x,
    y: opp.y,
    angle,
    speed: 12,
    life: 500,
    owner: opp,
  });

  opp.machineGunAmmo--;
}

function fireOpponentMissile(opp, target) {
  if (opp.missileAmmo <= 0) return;
  const predicted = predictTargetPosition(opp, target, 4);
  const dx = predicted.x - opp.x;
  const dy = predicted.y - opp.y;

  const distance = Math.hypot(dx, dy);
  const maxRange = 900;
  if (distance > maxRange) return;

  const targetAngle = Math.atan2(dy, dx);
  const angleDiff = Math.abs(
    ((opp.angle - targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI
  );
  const maxAngleOffset = Math.PI / 6; // ±30 degrees
  if (angleDiff > maxAngleOffset) return;

  opponentMissiles.push({
    x: opp.x,
    y: opp.y,
    angle: targetAngle,
    speed: 6,
    life: 250,
  });

  opp.missileAmmo--;
}

function updatePlayerMissileLock() {
  let nearestOpponent = null;
  let nearestDist = Infinity;

  for (const opp of opponents) {
    if (opp.health <= 0) continue;

    const dx = opp.x - player.x;
    const dy = opp.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestOpponent = opp;
    }
  }

  if (nearestOpponent && isInMissileCone(player, nearestOpponent)) {
    if (playerLockTarget === nearestOpponent) {
      playerLockTimer += 1;
    } else {
      playerLockTarget = nearestOpponent;
      playerLockTimer = 1;
    }

    if (playerLockTimer > PLAYER_LOCK_TIME) {
      if (!playerMissileLockReady && !missileLockAnnounced) {
        createFloatingText(
          "🚀 LOCKED",
          nearestOpponent.x,
          nearestOpponent.y - 50,
          "red",
          18
        );
        missileLockAnnounced = true;
      }

      playerMissileLockReady = true;
    }
  } else {
    playerLockTimer = Math.max(0, playerLockTimer - 1);
    playerLockTarget = null;
    playerMissileLockReady = false;
    missileLockAnnounced = false;
  }
}

function updateOpponentMissileLock() {
  for (const opp of opponents) {
    if (opp.health <= 0) continue;

    const { target, distance } = findNearestEnemy(opp.x, opp.y);
    if (target && isInMissileCone(opp, target)) {
      opp.lockTimer = (opp.lockTimer || 0) + 1;
      opp.lockTarget = target;
      if (opp.lockTimer > OPPONENT_LOCK_TIME && Math.random() < 0.02) {
        createFloatingText("🚀 LOCKED", target.x, target.y - 50, "red", 18);
        fireOpponentMissile(opp, target);
        opp.lockTimer = 0;
      }
    } else {
      opp.lockTimer = Math.max(0, (opp.lockTimer || 0) - 1);
      opp.lockTarget = null;
    }
  }
}

// ====================
// [7] Update Functions
// ====================

function update() {
  maybeDeployFlares(opponents);
  maybeDeployFlares(allies);
  updatePlayer();
  updateBullets();
  updateOpponentBullets();
  updateMissiles();
  updateOpponents();
  updateAllies();

  // handleCollisions();

  // applyAntiStacking([player, ...opponents, ...allies]);
  updateFlares();
  updateParticles();
  updateFloatingTexts();
  updateExplosions();
  updatePlayerMissileLock();
  updateOpponentMissileLock();
}

function updatePlayerAutopilot() {
  // avoidOthers(player, [...opponents, ...allies]);
  const { target, distance } = findNearestOpponent(player.x, player.y);

  // === [1] Handle Evading First
  const underFire = detectIncomingMissile(player) || detectIncomingFire(player);
  if (underFire) {
    if (autopilotMode !== "aggressive") {
      maybeDodge(player);
      adjustThrottle(player, 4.5);
    }
    // Always release flares if missile is incoming and cooldown is ready
    if (player.flareCooldown <= 0 && detectIncomingMissile(player)) {
      releaseFlaresFor(player);
      player.flareCooldown = 300;
    }
  }

  // === [3] Patrol if No Target
  if (!target || target.health <= 0) {
    moveForward(player);
    return;
  }

  // 🎲 Randomize orbit direction occasionally
  if (Math.random() < 0.01) {
    player.orbitDirection = Math.random() < 0.5 ? 1 : -1;
  }

  maybeDodge(player);

  const predicted = predictTargetPosition(player, target, 6);
  const interceptAngle = Math.atan2(
    predicted.y - player.y,
    predicted.x - player.x
  );
  rotateToward(
    player,
    interceptAngle + player.dodgeOffset,
    player.maxTurnRate || 0.02,
    0
  );

  const targetAngle = Math.atan2(target.y - player.y, target.x - player.x);

  // 🛡️ In defensive mode, back away slowly instead of pursuing
  if (autopilotMode === "defensive" && distance < 600) {
    const retreatAngle = Math.atan2(player.y - target.y, player.x - target.x);
    rotateToward(
      player,
      retreatAngle + player.dodgeOffset,
      player.maxTurnRate || 0.02,
      0
    );
  } else if (autopilotMode === "aggressive") {
    const strafeOffset = (player.orbitDirection || 1) * (Math.PI / 3); // 60° strafe
    const strafeAngle = targetAngle + strafeOffset + player.dodgeOffset;
    rotateToward(player, strafeAngle, player.maxTurnRate || 0.02, 0);
  } else if (autopilotMode === "balanced") {
    if (player.health < 30) {
      // 🚨 Low health — disengage
      const retreatAngle = Math.atan2(player.y - target.y, player.x - target.x);
      rotateToward(player, retreatAngle, player.maxTurnRate || 0.02);
      adjustThrottle(player, 4.5);
      return;
    }

    const noAmmo = player.machineGunAmmo <= 0 && player.missileAmmo <= 0;
    if (noAmmo) {
      // 🕊️ No ammo — fly evasively
      const orbitAngle =
        targetAngle + (player.orbitDirection || 1) * (Math.PI / 2);
      rotateToward(player, orbitAngle, player.maxTurnRate || 0.02, 0);
      adjustThrottle(player, 3);
      return;
    }

    if (distance < 400) {
      // 🧠 Strafe around the target at mid-range
      const strafeOffset = (player.orbitDirection || 1) * (Math.PI / 4); // 45° strafe
      const strafeAngle = targetAngle + strafeOffset + player.dodgeOffset;
      rotateToward(player, strafeAngle, player.maxTurnRate || 0.02);
    } else {
      // 📡 Close in or reposition with predictive aim
      const aimAngle = targetAngle + player.dodgeOffset + Math.random() * 0.05;
      rotateToward(player, aimAngle, player.maxTurnRate || 0.02, 0);
    }
  }

  // === [4] Throttle Based on Mode
  if (autopilotMode === "defensive") {
    // 🛡️ If too close to enemy, back off
    if (distance < 300) {
      const retreatAngle = Math.atan2(player.y - target.y, player.x - target.x);
      rotateToward(player, retreatAngle, player.maxTurnRate || 0.02);
      adjustThrottle(player, 3.5);
      return;
    }

    // 🛡️ Use flares more reactively if missiles nearby
    if (detectIncomingMissile(player) && player.flareCooldown <= 0) {
      releaseFlaresFor(player);
      player.flareCooldown = 300;
    }

    adjustThrottle(player, distance > 600 ? 2.5 : 1.5);
  } else if (autopilotMode === "aggressive") {
    adjustThrottle(player, 3.5);
  } else {
    if (autopilotMode === "balanced") {
      if (underFire) {
        adjustThrottle(player, 4); // escape if under fire
      } else {
        adjustThrottle(player, distance > 800 ? 4.5 : distance > 400 ? 3 : 2.5);
      }
    }
  }

  // === [5] Fire Logic
  // === [5] Fire Logic
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const angleToTarget = Math.atan2(dy, dx);

  const aligned = isAngleAligned(player.angle, angleToTarget);

  let gunFireChance = 1.0;
  if (autopilotMode === "defensive") gunFireChance = 1.0;
  else if (autopilotMode === "balanced") gunFireChance = 1.0;

  const tryFireGun = player.machineGunAmmo > 0 && aligned && distance < 600;

  const inCone = isInMissileCone(player, target);

  const tryFireMissile =
    playerMissileLockReady &&
    player.missileAmmo > 0 &&
    aligned &&
    inCone &&
    distance < 1000 &&
    target.health > 1 &&
    player.missileCooldown <= 0;

  if (tryFireMissile) {
    fireMissile();
    player.missileCooldown = 60;
    createFloatingText(
      "🚀 AUTOPILOT FIRED",
      player.x,
      player.y - 60,
      "yellow",
      16
    );
    return; // 🔥 missile takes priority
  } else if (tryFireGun) {
    fireMachineGun();
  }
}

function updatePlayer() {
  if (player.isTakingOff) {
    player.thrust = 0.5; // Taxi slowly
    moveForward(player);
    createEngineParticles(player);

    player.taxiTimer--;
    if (player.taxiTimer <= 0) {
      player.isTakingOff = false;
      player.thrust = 5.0; // 🚀 Go full speed after takeoff
      createFloatingText(
        "⚡ Full Throttle!",
        player.x,
        player.y - 50,
        "lime",
        16
      );
    }
    updateCamera();
    return; // Skip rest of update during taxi
  }

  if (player.health <= 0) {
    if (!playerDead) {
      createExplosion(player.x, player.y, 100);
      playerDead = true;
      playerRespawnCooldown = 60;
    } else {
      playerRespawnCooldown--;
      if (playerRespawnCooldown === 0) {
        respawnPlane(player, false);
        createFloatingText(
          "🛬 Player Respawned!",
          player.x,
          player.y - 60,
          "cyan",
          18
        );
        updateCamera();
        playerDead = false;
      }
    }
    return;
  }

  if (player.flareCooldown > 0) player.flareCooldown--;
  if (player.missileCooldown > 0) player.missileCooldown--;
  // === Ammo Regen Logic
  if (player.machineGunAmmo <= 0) {
    if (!player.ammoRegenTimer) player.ammoRegenTimer = 0;
    player.ammoRegenTimer++;
    if (player.ammoRegenTimer >= 120) {
      // 2 seconds at 60 FPS
      player.machineGunAmmo = 200;
      createFloatingText(
        "🔫 Ammo Refilled!",
        player.x,
        player.y - 60,
        "lime",
        16
      );
      player.ammoRegenTimer = 0;
    }
  } else {
    player.ammoRegenTimer = 0; // reset timer if ammo is above 0
  }

  if (player.missileAmmo <= 0) {
    if (!player.missileRegenTimer) player.missileRegenTimer = 0;
    player.missileRegenTimer++;
    if (player.missileRegenTimer >= 300) {
      // 5 seconds at 60 FPS
      player.missileAmmo = 4;
      playerMissileLockReady = false;
      playerMissileLockTimer = 0;
      missileLockAnnounced = false;

      createFloatingText(
        "🚀 Missile Refilled!",
        player.x,
        player.y - 80,
        "orange",
        16
      );
      player.missileRegenTimer = 0;
    }
  } else {
    player.missileRegenTimer = 0;
  }
  if (playerAIEnabled) {
    updatePlayerAutopilot();
  } else {
    if (joystickActive) {
      player.angle = joystickAngle;
    } else {
      if (keys["ArrowLeft"] || keys["a"]) player.angle -= 0.05;
      if (keys["ArrowRight"] || keys["d"]) player.angle += 0.05;
    }

    if (keys["w"] || keys["ArrowUp"]) {
      player.thrust += 0.1;
      if (player.thrust > 5) player.thrust = 5;
    }

    if (keys["s"] || keys["ArrowDown"]) {
      player.thrust -= 0.05;
      if (player.thrust < 1.0) player.thrust = 1.0;
    }
  }

  moveForward(player);

  // === Avoid getting stuck at wall
  // === Bounce off left/right walls
  if (player.x <= 0 || player.x >= WORLD_WIDTH) {
    player.angle = Math.PI - player.angle;
    player.x = clamp(player.x, 1, WORLD_WIDTH - 1); // prevent sticking
  }

  // === Bounce off top/bottom walls
  if (player.y <= 0 || player.y >= WORLD_HEIGHT) {
    player.angle = -player.angle;
    player.y = clamp(player.y, 1, WORLD_HEIGHT - 1); // prevent sticking
  }

  createEntityWingTrails(player);
  createEngineParticles(player);

  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);

  avoidOthers(player, [...opponents, ...allies]);

  updateCamera();
}

function createEngineParticles(entity) {
  if (entity.thrust / 5 < 0.7) return;

  const backOffset = 32;
  const sideOffset = 5;

  for (const dir of [-1, 1]) {
    entity.engineParticles.push({
      x:
        entity.x -
        Math.cos(entity.angle) * backOffset +
        Math.cos(entity.angle + (dir * Math.PI) / 2) * sideOffset,
      y:
        entity.y -
        Math.sin(entity.angle) * backOffset +
        Math.sin(entity.angle + (dir * Math.PI) / 2) * sideOffset,
      alpha: 1,
      radius: 3 + Math.random() * 2,
      angle: entity.angle + (Math.random() * 0.3 - 0.15),
      color: "white",
    });

    if (entity.engineParticles.length > 40) entity.engineParticles.splice(0, 1);
  }
}

function createEntityWingTrails(entity) {
  if (entity.thrust < 0.5 * 5) return;

  const offset = 25;
  entity.wingTrails.push({
    x: entity.x + Math.cos(entity.angle + Math.PI / 2) * offset,
    y: entity.y + Math.sin(entity.angle + Math.PI / 2) * offset,
    alpha: 0.6,
  });

  entity.wingTrails.push({
    x: entity.x + Math.cos(entity.angle - Math.PI / 2) * offset,
    y: entity.y + Math.sin(entity.angle - Math.PI / 2) * offset,
    alpha: 0.6,
  });

  if (entity.wingTrails.length > 60) {
    entity.wingTrails.splice(0, entity.wingTrails.length - 60);
  }
}

function updateWingTrails() {
  for (let i = wingTrails.length - 1; i >= 0; i--) {
    const t = wingTrails[i];
    t.alpha -= 0.02; // fade each frame
    if (t.alpha <= 0) {
      wingTrails.splice(i, 1); // remove faded trails
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

function moveForward(entity) {
  entity.x += Math.cos(entity.angle) * entity.thrust * entity.speed;
  entity.y += Math.sin(entity.angle) * entity.thrust * entity.speed;
}

function bounceOffWalls(entity) {
  // Bounce horizontally
  if (entity.x <= 0 || entity.x >= WORLD_WIDTH) {
    entity.angle = Math.PI - entity.angle;
    entity.x = clamp(entity.x, 1, WORLD_WIDTH - 1);
  }

  // Bounce vertically
  if (entity.y <= 0 || entity.y >= WORLD_HEIGHT) {
    entity.angle = -entity.angle;
    entity.y = clamp(entity.y, 1, WORLD_HEIGHT - 1);
  }
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

function maybeDodge(entity) {
  if (entity.dodgeCooldown > 0) {
    entity.dodgeCooldown--;
  } else {
    // === Dodge incoming bullets
    const underFire = detectIncomingFire(entity);

    // === Dodge nearby missiles
    const beingChased = opponentMissiles.some((m) => {
      const dx = m.x - entity.x;
      const dy = m.y - entity.y;
      return Math.hypot(dx, dy) < 250;
    });

    if ((underFire || beingChased) && Math.random() < 0.4) {
      entity.dodgeOffset = (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 3); // 60°
      entity.dodgeCooldown = 45 + Math.floor(Math.random() * 45);
    }
  }

  // === Flare release (if targeted by missiles)
  if (entity.flareCooldown <= 0) {
    const lockedMissile = opponentMissiles.some((m) => {
      const dx = entity.x - m.x;
      const dy = entity.y - m.y;
      return Math.hypot(dx, dy) < 200;
    });

    if (lockedMissile && Math.random() < 0.1) {
      releaseFlaresFor(entity);
      entity.flareCooldown = 300;
    }
  }

  // === Gradually clear dodge offset
  if (entity.dodgeOffset !== 0) {
    entity.dodgeOffset *= 0.9;
    if (Math.abs(entity.dodgeOffset) < 0.01) entity.dodgeOffset = 0;
  }
}

function maybeDeployFlares(planes) {
  for (const plane of planes) {
    if (plane.flareCooldown > 0) {
      plane.flareCooldown--;
      continue;
    }

    const isChased = missiles.some((m) => m.target === plane);

    if (isChased && Math.random() < 0.02) {
      releaseFlaresFor(plane);
      plane.flareCooldown = 300; // wait 5 seconds (at 60 FPS)
    }
  }
}

function rotateToward(entity, targetAngle, maxTurnRate = 0.03, wiggle = 0) {
  let angleDiff =
    ((targetAngle - entity.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

  // Add optional wiggle
  angleDiff += (Math.random() - 0.5) * wiggle;

  // === Apply inertia (smooth turning) ===
  if (typeof entity.turnSpeed === "undefined") {
    entity.turnSpeed = 0;
  }

  // 🔧 Make acceleration smaller to prevent overshooting
  entity.turnSpeed += angleDiff * 0.05;

  // 🔧 Clamp smaller max turn speed to reduce snapping
  entity.turnSpeed = clamp(entity.turnSpeed, -maxTurnRate, maxTurnRate);

  // 🔧 Apply stronger damping/friction to slow turning oscillations
  entity.turnSpeed *= 0.85;

  // Update angle
  entity.angle += entity.turnSpeed;
}

function predictTargetPosition(shooter, target, projectileSpeed) {
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const distance = Math.hypot(dx, dy);

  const timeToImpact = distance / projectileSpeed;

  // Assume target keeps moving at current velocity
  const predictedX =
    target.x + Math.cos(target.angle) * target.thrust * timeToImpact;
  const predictedY =
    target.y + Math.sin(target.angle) * target.thrust * timeToImpact;

  return { x: predictedX, y: predictedY };
}

function updateBullets() {
  for (let i = machineGunBullets.length - 1; i >= 0; i--) {
    const b = machineGunBullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;

    // === Check collision with each opponent ===
    for (const opp of opponents) {
      const dx = opp.x - b.x;
      const dy = opp.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        // hit radius
        opp.health -= 1;
        createExplosion(opp.x, opp.y, 20);
        opp.lastAttacker = b.owner || player;
        opp.lastAttackedTime = performance.now();
        machineGunBullets.splice(i, 1);
        break; // Stop checking after hit
      }
    }

    if (b.life <= 0) {
      createExplosion(b.x, b.y, 15);
      machineGunBullets.splice(i, 1);
    }
  }
}

function updateMissiles() {
  let anyMissileLockedOn = false;

  for (const m of opponentMissiles) {
    const dx = player.x - m.x;
    const dy = player.y - m.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 300) {
      anyMissileLockedOn = true;
      break;
    }
  }

  if (anyMissileLockedOn) {
    if (!missileLockAnnounced) {
      createFloatingText(
        "🚨 MISSILE LOCKED!",
        player.x,
        player.y - 60,
        "red",
        22,
        true,
        true
      );
      missileLockAnnounced = true;
    }
    lockOnAlertCooldown = 60;
  } else {
    if (lockOnAlertCooldown > 0) {
      lockOnAlertCooldown--;
    }
    if (lockOnAlertCooldown === 0) {
      missileLockAnnounced = false;
    }
  }

  // === Update player missiles ===
  let nearestOpponent = null;
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];

    // === Redirect to flare if available
    const flareTarget = findNearestEnemyFlare(m.x, m.y, "ally"); // 👈 skips ally flares
    let targetX, targetY;

    if (flareTarget) {
      targetX = flareTarget.x;
      targetY = flareTarget.y;
    } else {
      // Lock to nearest opponent
      if (m.target && m.target.health > 0) {
        targetX = m.target.x;
        targetY = m.target.y;
      } else {
        // fallback to nearest opponent if target is invalid
        let nearestDist = Infinity;
        for (const opp of opponents) {
          const dx = opp.x - m.x;
          const dy = opp.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            m.target = opp; // reassign target
          }
        }
        if (!m.target) continue;
        targetX = m.target.x;
        targetY = m.target.y;
      }
    }

    const dx = targetX - m.x;
    const dy = targetY - m.y;
    const targetAngle = Math.atan2(dy, dx);

    rotateToward(m, targetAngle, 0.02, 0.15);
    m.x += Math.cos(m.angle) * m.speed;
    m.y += Math.sin(m.angle) * m.speed;
    m.life--;

    particles.push({
      x: m.x,
      y: m.y,
      alpha: 0.5,
      radius: 2 + Math.random() * 2,
      angle: m.angle + (Math.random() * 0.2 - 0.1),
      color: "white",
    });

    // === Handle impact
    if (flareTarget) {
      if (Math.hypot(dx, dy) < 20) {
        createExplosion(flareTarget.x, flareTarget.y);
        missiles.splice(i, 1);
        flares.splice(flares.indexOf(flareTarget), 1); // remove flare
        continue;
      }
    } else {
      if (m.target && Math.hypot(dx, dy) < 40) {
        m.target.health -= 100;
        m.target.lastAttacker = m.owner || player;
        m.target.lastAttackedTime = performance.now();
        createExplosion(m.target.x, m.target.y, 70);
        missiles.splice(i, 1);
        continue;
      }
    }

    if (m.life <= 0) {
      createExplosion(m.x, m.y);
      missiles.splice(i, 1);
    }
  }

  // === Update opponent missiles ===
  for (let i = opponentMissiles.length - 1; i >= 0; i--) {
    const m = opponentMissiles[i];

    let targetX, targetY;

    // === If there are flares, prefer chasing the nearest flare
    const nearestFlare = findNearestEnemyFlare(m.x, m.y, "opponent"); // ✅ Only chase player/allied flares
    if (nearestFlare) {
      targetX = nearestFlare.x;
      targetY = nearestFlare.y;
    } else {
      targetX = player.x;
      targetY = player.y;
    }

    const dx = targetX - m.x;
    const dy = targetY - m.y;
    const targetAngle = Math.atan2(dy, dx);

    rotateToward(m, targetAngle, 0.02, 0.15);

    m.x += Math.cos(m.angle) * m.speed;
    m.y += Math.sin(m.angle) * m.speed;
    m.life--;

    // === Missile trail (opponent)
    particles.push({
      x: m.x,
      y: m.y,
      alpha: 0.5,
      radius: 2 + Math.random() * 2,
      angle: m.angle + (Math.random() * 0.2 - 0.1),
      color: "white",
    });

    if (nearestFlare) {
      // === Hit flare
      if (Math.hypot(dx, dy) < 20) {
        createExplosion(nearestFlare.x, nearestFlare.y);
        opponentMissiles.splice(i, 1);
        flares.splice(flares.indexOf(nearestFlare), 1); // Remove the flare
        continue;
      }
    } else {
      // === Hit player
      if (Math.hypot(dx, dy) < 40) {
        player.health -= 100;
        createExplosion(player.x, player.y, 70);
        opponentMissiles.splice(i, 1);
        continue;
      }
    }

    if (m.life <= 0) {
      createExplosion(m.x, m.y); // 💥 explode on timeout
      opponentMissiles.splice(i, 1);
    }
  }
}

function updateFlares() {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    f.x += Math.cos(f.angle) * f.speed;
    f.y += Math.sin(f.angle) * f.speed;
    f.life--;
    if (f.life <= 0) {
      flares.splice(i, 1);
    }
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x -= Math.cos(p.angle) * 1;
    p.y -= Math.sin(p.angle) * 1;
    p.alpha -= 0.02;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y -= 0.5;
    ft.alpha -= 0.02;
    ft.life--;
    if (ft.life <= 0 || ft.alpha <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

function createExplosion(x, y, size = 80) {
  explosions.push({ x, y, size, life: 30 });
}

function updateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    exp.life--;
    if (exp.life <= 0) {
      explosions.splice(i, 1);
    }
  }
}

// ====================
// [8] Draw Functions
// ====================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawAirport();
  drawPlayer();
  drawAllies();
  drawOpponents();
  drawProjectiles();
  drawParticles();
  drawExplosions();
  drawUI();
  drawOffscreenIndicators();
  drawOffscreenIndicators();
}

function drawBackground() {
  ctx.drawImage(images.sky, -camera.x, -camera.y, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawPlayer() {
  if (playerDead) return;
  drawEntity(player, images.player);
  drawEngineParticles(player.engineParticles);
}

function drawAllies() {
  for (const ally of allies) {
    drawWingTrails(ally.wingTrails);
    drawEngineParticles(ally.engineParticles);
    drawEntity(ally, images.player);
  }
}

function drawOpponents() {
  for (const opp of opponents) {
    drawWingTrails(opp.wingTrails);
    drawEngineParticles(opp.engineParticles);
    drawEntity(opp, images.opponent);
  }
}

function drawAirport() {
  // Player + ally airport (bottom right)
  const airportX1 = WORLD_WIDTH - 250;
  const airportY1 = WORLD_HEIGHT - 250;
  ctx.fillStyle = "#333";
  ctx.fillRect(airportX1 - camera.x, airportY1 - camera.y, 200, 200);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(airportX1 - camera.x + 20 + i * 40, airportY1 - camera.y);
    ctx.lineTo(airportX1 - camera.x + 20 + i * 40, airportY1 - camera.y + 200);
    ctx.stroke();
  }

  // Opponent airport (top left)
  const airportX2 = 0;
  const airportY2 = 0;
  ctx.fillStyle = "#333";
  ctx.fillRect(airportX2 - camera.x, airportY2 - camera.y, 200, 200);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(airportX2 - camera.x + 20 + i * 40, airportY2 - camera.y);
    ctx.lineTo(airportX2 - camera.x + 20 + i * 40, airportY2 - camera.y + 200);
    ctx.stroke();
  }
}

function drawEntity(entity, img) {
  ctx.save();
  ctx.translate(entity.x - camera.x, entity.y - camera.y);
  ctx.rotate(entity.angle + Math.PI / 4);
  ctx.drawImage(
    img,
    -entity.width / 2,
    -entity.height / 2,
    entity.width,
    entity.height
  );
  ctx.restore();
}

function drawEngineParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Update and fade
    p.x -= Math.cos(p.angle) * 1;
    p.y -= Math.sin(p.angle) * 1;
    p.alpha -= 0.4;

    if (p.alpha <= 0) particles.splice(i, 1);
  }
}

function drawProjectiles() {
  drawMachineGunBullets();
  drawMissiles();
  drawOpponentBullets();
  drawOpponentMissiles();
  drawFlares();
}

function drawMachineGunBullets() {
  for (const b of machineGunBullets) {
    ctx.save();
    ctx.translate(b.x - camera.x, b.y - camera.y);
    ctx.rotate(b.angle);
    ctx.drawImage(images.bullet, -10, -5, 20, 10);
    ctx.restore();
  }
}

function drawMissiles() {
  for (const m of missiles) {
    ctx.save();
    ctx.translate(m.x - camera.x, m.y - camera.y);
    ctx.rotate(m.angle);
    ctx.drawImage(images.missile, -20, -10, 40, 20);
    ctx.restore();
  }
}

function drawOpponentBullets() {
  for (const b of opponentBullets) {
    ctx.save();
    ctx.translate(b.x - camera.x, b.y - camera.y);
    ctx.rotate(b.angle);
    ctx.drawImage(images.bullet, -10, -5, 20, 10);
    ctx.restore();
  }
}

function drawOpponentMissiles() {
  for (const m of opponentMissiles) {
    ctx.save();
    ctx.translate(m.x - camera.x, m.y - camera.y);
    ctx.rotate(m.angle);
    ctx.drawImage(images.missile, -20, -10, 40, 20);
    ctx.restore();
  }
}

function drawFlares() {
  for (const f of flares) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.translate(f.x - camera.x, f.y - camera.y);
    ctx.rotate(f.angle);
    ctx.drawImage(images.flare, -f.size / 2, -f.size / 2, f.size, f.size);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawWingTrails(trails) {
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1.5;
  for (let i = trails.length - 1; i >= 0; i--) {
    const t = trails[i];
    ctx.save();
    ctx.globalAlpha = t.alpha;
    ctx.beginPath();
    ctx.moveTo(t.x - camera.x, t.y - camera.y);
    ctx.lineTo(t.x - camera.x, t.y - camera.y + 1);
    ctx.stroke();
    ctx.restore();
    t.alpha -= 0.02;
    if (t.alpha <= 0) trails.splice(i, 1); // ✅ fade & clean
  }
}

function drawExplosions() {
  for (const exp of explosions) {
    ctx.save();
    ctx.globalAlpha = exp.life / 30; // fade out over 30 frames
    ctx.drawImage(
      images.explosion,
      exp.x - exp.size / 2 - camera.x,
      exp.y - exp.size / 2 - camera.y,
      exp.size,
      exp.size
    );
    ctx.restore();
  }
}

function drawHealthBars() {
  // === Player Health Bar (fixed position)
  const barWidth = 100;
  const barHeight = 10;
  const healthPercent = player.health / player.maxHealth;

  ctx.fillStyle = "red";
  ctx.fillRect(20, 20, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(20, 20, barWidth * healthPercent, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(20, 20, barWidth, barHeight);

  // === Opponents' Health Bars (above each opponent)
  for (const opp of opponents) {
    const oppHealthPercent = opp.health / opp.maxHealth;
    ctx.fillStyle = "gray";
    ctx.fillRect(opp.x - 30 - camera.x, opp.y - 50 - camera.y, 60, 6);
    ctx.fillStyle = "red";
    ctx.fillRect(
      opp.x - 30 - camera.x,
      opp.y - 50 - camera.y,
      60 * oppHealthPercent,
      6
    );
    ctx.strokeStyle = "white";
    ctx.strokeRect(opp.x - 30 - camera.x, opp.y - 50 - camera.y, 60, 6);
  }

  // === Allies' Health Bars (above each ally)
  for (const ally of allies) {
    const allyHealthPercent = ally.health / ally.maxHealth;
    ctx.fillStyle = "gray";
    ctx.fillRect(ally.x - 30 - camera.x, ally.y - 50 - camera.y, 60, 6);
    ctx.fillStyle = "lime";
    ctx.fillRect(
      ally.x - 30 - camera.x,
      ally.y - 50 - camera.y,
      60 * allyHealthPercent,
      6
    );
    ctx.strokeStyle = "white";
    ctx.strokeRect(ally.x - 30 - camera.x, ally.y - 50 - camera.y, 60, 6);
  }
}

function drawSpeedometer() {
  const barWidth = 200;
  const barHeight = 15;
  const barX = canvas.width - barWidth - 20; // <-- Right side (20px margin from right)
  const barY = 20; // <-- Top side (20px from top)

  const speedPercent = player.thrust / 5; // maxSpeed = 5

  ctx.fillStyle = "#555";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  let barColor = "lime";
  if (speedPercent > 0.7) barColor = "red";
  else if (speedPercent > 0.4) barColor = "yellow";

  ctx.fillStyle = barColor;
  ctx.fillRect(barX, barY, barWidth * speedPercent, barHeight);

  ctx.strokeStyle = "white";
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "center"; // <-- center text above the bar
  ctx.fillText(
    `Speed: ${player.thrust.toFixed(1)} / 5`,
    barX + barWidth / 2,
    barY - 5
  );
}

function drawMissileRangeGuide() {
  const maxRange = 900;
  const coneAngle = Math.PI / 6; // 30 degrees

  const px = player.x - camera.x;
  const py = player.y - camera.y;
  const angle = player.angle;

  const left = {
    x: px + Math.cos(angle - coneAngle) * maxRange,
    y: py + Math.sin(angle - coneAngle) * maxRange,
  };
  const right = {
    x: px + Math.cos(angle + coneAngle) * maxRange,
    y: py + Math.sin(angle + coneAngle) * maxRange,
  };

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px, py); // Start at the player
  ctx.lineTo(left.x, left.y); // Draw to left edge
  ctx.lineTo(right.x, right.y); // Draw to right edge
  ctx.closePath();

  ctx.fillStyle = "rgba(0, 255, 0, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawGunRangeGuide(entity) {
  const maxRange = 600;

  const px = entity.x - camera.x;
  const py = entity.y - camera.y;
  const angle = entity.angle;

  const endX = px + Math.cos(angle) * maxRange;
  const endY = py + Math.sin(angle) * maxRange;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = "rgba(255, 255, 0, 0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
}

function drawLockOnLine() {
  if (!playerMissileLockReady) return;

  // Find nearest valid opponent within missile cone
  let nearestOpponent = null;
  let nearestDist = Infinity;

  for (const opp of opponents) {
    if (opp.health <= 0) continue;
    const dx = opp.x - player.x;
    const dy = opp.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < nearestDist && isInMissileCone(player, opp)) {
      nearestDist = dist;
      nearestOpponent = opp;
    }
  }

  if (!nearestOpponent) return;

  const px = player.x - camera.x;
  const py = player.y - camera.y;
  const ox = nearestOpponent.x - camera.x;
  const oy = nearestOpponent.y - camera.y;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(ox, oy);
  ctx.strokeStyle = "red"; // 🔴 Solid red line
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 5]); // ❌ Remove dashed line
  ctx.shadowColor = "red"; // 🔥 Optional glow effect
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function drawOffscreenIndicators() {
  const entities = [...opponents, ...allies];

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

    // Determine edge position
    const playerScreenX = player.x - camera.x;
    const playerScreenY = player.y - camera.y;
    const radius = 80; // You can tweak this distance as needed

    const indicatorX = playerScreenX + Math.cos(angle) * radius;
    const indicatorY = playerScreenY + Math.sin(angle) * radius;

    // Draw triangle
    ctx.save();
    ctx.translate(indicatorX, indicatorY);
    ctx.rotate(angle + Math.PI / 2);

    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-6, 8);
    ctx.lineTo(6, 8);
    ctx.closePath();

    ctx.fillStyle = opponents.includes(entity) ? "red" : "cyan";
    ctx.fill();
    ctx.restore();
  }
}

function drawAllyLockLines() {
  for (const ally of allies) {
    if (ally.health <= 0 || !ally.lockTarget) continue;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ally.x - camera.x, ally.y - camera.y);
    ctx.lineTo(ally.lockTarget.x - camera.x, ally.lockTarget.y - camera.y);
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }
}

function drawOpponentLockLines() {
  for (const opp of opponents) {
    if (opp.health <= 0 || !opp.lockTarget) continue;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(opp.x - camera.x, opp.y - camera.y);
    ctx.lineTo(opp.lockTarget.x - camera.x, opp.lockTarget.y - camera.y);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // Ally missile cone guide (if locking on)
  // for (const ally of allies) {
  //   if (ally.health > 0 && ally.lockTarget) {
  //     drawMissileRangeGuideFor(ally, "rgba(0, 255, 255, 0.08)"); // cyan-ish
  //   }
  // }

  // // Opponent missile cone guide (if locking on)
  // for (const opp of opponents) {
  //   if (opp.health > 0 && opp.lockTarget) {
  //     drawMissileRangeGuideFor(opp, "rgba(255, 0, 0, 0.08)"); // red-ish
  //   }
  // }
}

function drawTargetLockIcon(entity) {
  const iconX = entity.x - camera.x;
  const iconY = entity.y - camera.y - 50;

  ctx.save();
  ctx.fillStyle = "yellow";
  ctx.font = "18px Arial";
  ctx.textAlign = "center";
  ctx.fillText("🎯", iconX, iconY);
  ctx.restore();
}

function drawMissileRangeGuideFor(entity, color = "rgba(0, 255, 0, 0.08)") {
  const maxRange = 900;
  const coneAngle = Math.PI / 6; // 30 degrees

  const px = entity.x - camera.x;
  const py = entity.y - camera.y;
  const angle = entity.angle;

  const left = {
    x: px + Math.cos(angle - coneAngle) * maxRange,
    y: py + Math.sin(angle - coneAngle) * maxRange,
  };
  const right = {
    x: px + Math.cos(angle + coneAngle) * maxRange,
    y: py + Math.sin(angle + coneAngle) * maxRange,
  };

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = color.replace("0.08", "0.3");
  ctx.stroke();
  ctx.restore();
}

function drawUI() {
  drawHealthBars();
  drawSpeedometer();
  drawFloatingTexts();
  drawWingTrails(player.wingTrails);
  drawMissileRangeGuide();
  drawLockOnLine();
  drawAllyLockLines();
  drawOpponentLockLines();
  drawGunRangeGuide(player);
  if (playerAIEnabled) {
    drawGunRangeGuide(player);
  }
  if (playerAIEnabled && playerMissileLockReady) {
    drawLockOnLine();
  }

  // Show ammo count
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  ctx.fillText(
    `🔫 ${player.machineGunAmmo} | 🚀 ${player.missileAmmo}`,
    20,
    50
  );
  ctx.fillText(`☠️ Kills: ${player.killCount}`, 20, 70);
}

function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    ctx.fillStyle = ft.color;
    ctx.font = `${ft.size}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x - camera.x, ft.y - camera.y);
    ctx.restore();
  }
}

// ====================
// [9] Main Game Loop
// ====================
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();
