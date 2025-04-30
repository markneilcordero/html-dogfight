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
  sky: loadImage("images/sky.jpeg"),
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
        player.thrust += 0.1;
        if (player.thrust > 5) player.thrust = 5;
      }, 100);
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
        player.thrust -= 0.05;
        if (player.thrust < 1.0) player.thrust = 1.0;
      }, 100);
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
  btnFlare.addEventListener("click", () => {
    if (player.flareCooldown <= 0) {
      releaseFlaresFor(player);
      player.flareCooldown = 300; // reset cooldown
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "h" && player.flareCooldown <= 0) {
      releaseFlaresFor(player);
      player.flareCooldown = 300;
    }
  });
}

function setupPlayerAIButton() {
  const btnAI = document.getElementById("btnAI");

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

// === Lock Variables ===
const PLAYER_LOCK_TIME = 300; // Player needs 1.5 seconds to lock (adjust this!)
const OPPONENT_LOCK_TIME = 300; // Opponent needs 1.5 seconds to lock (adjust this!)

let playerMissileLockTimer = 0; // how long player has been locking onto opponent
let playerMissileLockReady = false;

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

function checkCollision(entityA, entityB, threshold = 40) {
  const dx = entityA.x - entityB.x;
  const dy = entityA.y - entityB.y;
  const distance = Math.hypot(dx, dy);
  return distance < threshold;
}

// ====================
// [5] Player Actions
// ====================
function fireMachineGun() {
  if (player.machineGunAmmo <= 0) {
    createFloatingText("🔫 OUT OF AMMO", player.x, player.y - 60, "gray", 16);
    return;
  }

  machineGunBullets.push({
    x: player.x,
    y: player.y,
    angle: player.angle,
    speed: 16,
    life: 60,
  });

  player.machineGunAmmo--; // 🔻 reduce ammo
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
    life: 60,
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
  const minRange = 300;
  const maxRange = 900;
  if (distance < minRange || distance > maxRange) return;

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
    speed: 4,
    life: 180,
    target: nearestOpponent,
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

  const distanceToTarget = Math.hypot(dx, dy);

  // === Custom range check
  const minRange = 300;
  const maxRange = 900;
  if (distanceToTarget < minRange || distanceToTarget > maxRange) {
    createFloatingText("🚫 OUT OF RANGE", player.x, player.y - 60, "gray", 16);
    return;
  }

  // === Check if facing the target (±30 degrees)
  const angleDiff = Math.abs(
    ((player.angle - targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI
  );
  const maxAngleOffset = Math.PI / 6; // 30 degrees
  if (angleDiff > maxAngleOffset) {
    createFloatingText("❌ NOT ALIGNED", player.x, player.y - 60, "gray", 16);
    return;
  }

  missiles.push({
    x: player.x,
    y: player.y,
    angle: targetAngle,
    speed: 4,
    life: 180,
    target: nearestOpponent,
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
          life: 180,
          size: 12 + Math.random() * 6,
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
      createExplosion(opp.x, opp.y, 100); // Optional explosion effect
      respawnPlane(opp, true); // true = isOpponent
      continue; // Skip this frame after respawn
    }
    if (!opp.isTakingOff && opp.delayedTaxiStart > 0) {
      opp.delayedTaxiStart--;
      continue; // ⏳ wait before taxiing
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
      opp.thrust = 0.5; // Taxi speed
      moveForward(opp);
      createEngineParticles(opp);
      opp.taxiTimer--;

      if (opp.taxiTimer > 0) continue; // still taxiing
      opp.isTakingOff = false;
      opp.thrust = 5; // Ready for battle
      continue; // ✅ skip combat logic this frame
    }

    const { target, distance } = findNearestEnemy(opp.x, opp.y);

    if (target) {
      const dx = target.x - opp.x;
      const dy = target.y - opp.y;
      const offset = Math.PI / 3;
      maybeDodge(opp);
      const targetAngle =
        Math.atan2(dy, dx) + offset * opp.orbitDirection + opp.dodgeOffset;

      rotateToward(opp, targetAngle, 0.04);
      opp.thrust = 5;
      moveForward(opp);
      bounceOffWalls(opp);
      createEntityWingTrails(opp);
      createEngineParticles(opp);

      // Shooting logic
      if (distance < 800 && Math.random() < 0.05) fireOpponentMachineGun(opp);
      if (distance < 1000) {
        opp.lockTimer = (opp.lockTimer || 0) + 1;
        if (opp.lockTimer > OPPONENT_LOCK_TIME && Math.random() < 0.02) {
          fireOpponentMissile(opp, target);
          opp.lockTimer = 0;
        }
      } else {
        opp.lockTimer = Math.max(0, (opp.lockTimer || 0) - 1); // 📌 Do not reset to 0 instantly
      }
    }
  }
}

function updateAllies() {
  for (const ally of allies) {
    if (!ally.isTakingOff && ally.delayedTaxiStart > 0) {
      ally.delayedTaxiStart--;
      continue; // wait for its turn
    }

    if (!ally.hasStartedTaxi && ally.delayedTaxiStart <= 0) {
      ally.isTakingOff = true;
      ally.hasStartedTaxi = true; // ✅ Add flag
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
      ally.taxiTimer = 90; // Reset taxiTimer if needed
    }

    if (ally.health <= 0) {
      createExplosion(ally.x, ally.y, 100); // Optional explosion effect
      respawnPlane(ally, false); // false = isAlly
      continue; // Skip this frame after respawn
    }
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

    if (nearestOpponent) {
      const dx = nearestOpponent.x - ally.x;
      const dy = nearestOpponent.y - ally.y;
      const offset = Math.PI / 3;
      maybeDodge(ally);
      const targetAngle = Math.atan2(dy, dx) + offset * ally.orbitDirection + ally.dodgeOffset;
    
      rotateToward(ally, targetAngle, 0.06);
      ally.thrust = 5;
      moveForward(ally);
      bounceOffWalls(ally);
      createEntityWingTrails(ally);
      createEngineParticles(ally);
    
      // Only fire when within range
      if (nearestDist < 600 && Math.random() < 0.04) fireAllyMachineGun(ally);
      if (nearestDist < 1000 && Math.random() < 0.01) fireAllyMissile(ally);
    }
    

    // === Anti-stacking
    for (const other of allies) {
      if (ally === other) continue;
      const dx2 = ally.x - other.x;
      const dy2 = ally.y - other.y;
      const dist2 = Math.hypot(dx2, dy2);
      if (dist2 < 80) {
        const repelStrength = (80 - dist2) * 0.02;
        ally.x += (dx2 / dist2) * repelStrength;
        ally.y += (dy2 / dist2) * repelStrength;
      }
    }
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
        t.health -= 10;
        createExplosion(t.x, t.y);
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
    life: 60,
  });

  opp.machineGunAmmo--;
}

function fireOpponentMissile(opp, target) {
  if (opp.missileAmmo <= 0) return;
  const predicted = predictTargetPosition(opp, target, 4);
  const dx = predicted.x - opp.x;
  const dy = predicted.y - opp.y;

  const distance = Math.hypot(dx, dy);
  const minRange = 300;
  const maxRange = 900;
  if (distance < minRange || distance > maxRange) return;

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
    speed: 4,
    life: 180,
  });

  opp.missileAmmo--;
}

function updatePlayerMissileLock() {
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

  if (nearestOpponent && nearestDist < 1000) {
    playerMissileLockTimer += 1;
    if (playerMissileLockTimer > PLAYER_LOCK_TIME) {
      playerMissileLockReady = true;
    }
  } else {
    playerMissileLockTimer = 0;
    playerMissileLockReady = false;
  }
}

function updateOpponentMissileLock() {
  const dx = player.x - opponents[0].x;
  const dy = player.y - opponents[0].y;
  const dist = Math.hypot(dx, dy);

  if (dist < 1000) {
    opponentMissileLockTimer++;
    if (opponentMissileLockTimer > OPPONENT_LOCK_TIME) {
      opponentMissileLockReady = true;
    }
  } else {
    opponentMissileLockTimer = 0;
    opponentMissileLockReady = false;
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

  // === Check Ally-Opponent Collision
  for (const ally of allies) {
    for (const opp of opponents) {
      if (ally.health > 0 && opp.health > 0 && checkCollision(ally, opp, 40)) {
        // 💥 Explosion on both
        createExplosion(ally.x, ally.y, 100);
        createExplosion(opp.x, opp.y, 100);
        ally.health = 0;
        opp.health = 0;
        createFloatingText("💥 COLLISION!", ally.x, ally.y - 60, "orange", 18);
      }
    }
  }

  // === Check Player-Opponent Collision
  for (const opp of opponents) {
    if (
      player.health > 0 &&
      opp.health > 0 &&
      checkCollision(player, opp, 40)
    ) {
      createExplosion(player.x, player.y, 100);
      createExplosion(opp.x, opp.y, 100);
      player.health = 0;
      opp.health = 0;
      createFloatingText(
        "💥 Player Crashed!",
        player.x,
        player.y - 60,
        "red",
        20
      );
      createFloatingText(
        "💥 Opponent Crashed!",
        opp.x,
        opp.y - 60,
        "orange",
        16
      );
    }
  }

  applyAntiStacking([...opponents, ...allies]);
  updateFlares();
  updateParticles();
  updateFloatingTexts();
  updateExplosions();
  updatePlayerMissileLock();
  updateOpponentMissileLock();
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
  if (playerAIEnabled) {
    const { target, distance } = findNearestOpponent(player.x, player.y);

    if (target) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const targetAngle = Math.atan2(dy, dx);

      maybeDodge(player);

      // Avoid steering directly into an opponent
      for (const opp of opponents) {
        if (opp.health <= 0) continue;
        const dx = opp.x - player.x;
        const dy = opp.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          const avoidAngle = Math.atan2(-dy, -dx); // steer away
          rotateToward(player, avoidAngle, 0.05);
          break; // prioritize escape over aiming
        }
      }

      rotateToward(player, targetAngle + player.dodgeOffset, 0.05);
      player.thrust = 5;

      // === Avoid collision with opponents
      for (const opp of opponents) {
        if (opp.health <= 0) continue;
        const dx = player.x - opp.x;
        const dy = player.y - opp.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 80) {
          const repelStrength = (80 - dist) * 0.03; // fine-tune this strength
          const nx = dx / dist;
          const ny = dy / dist;
          player.x += nx * repelStrength;
          player.y += ny * repelStrength;
        }
      }

      // ✅ Fire machine gun only if we have ammo
      if (player.machineGunAmmo > 0 && distance < 800 && Math.random() < 0.15) {
        fireMachineGun();
      }

      // ✅ Fire missile only if we have ammo and lock is ready
      let missileFired = false;

      if (
        player.missileAmmo > 0 &&
        playerMissileLockReady &&
        target.health > 30 &&
        Math.random() < 0.03
      ) {
        const prevAmmo = player.missileAmmo;
        fireMissile();
        if (player.missileAmmo < prevAmmo) missileFired = true;
      }

      // Fallback to machine gun if missile wasn't fired or failed
      if (
        (!missileFired || player.missileAmmo <= 0) &&
        player.machineGunAmmo > 0 &&
        distance < 800 &&
        Math.random() < 0.1
      ) {
        fireMachineGun();
      }
    }

    // ✅ Smart flares
    if (detectIncomingMissile(player) && player.flareCooldown <= 0) {
      releaseFlaresFor(player);
      player.flareCooldown = 300;
    }

    if (player.machineGunAmmo <= 0 && Math.random() < 0.01) {
      createFloatingText(
        "🔫 OUT OF BULLETS",
        player.x,
        player.y - 70,
        "gray",
        14
      );
    }

    if (player.missileAmmo <= 0 && Math.random() < 0.01) {
      createFloatingText(
        "🚀 OUT OF MISSILES",
        player.x,
        player.y - 70,
        "gray",
        14
      );
    }
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

    const isChased = missiles.some((m) => {
      const dx = plane.x - m.x;
      const dy = plane.y - m.y;
      return Math.hypot(dx, dy) < 250;
    });

    if (isChased && Math.random() < 0.02) {
      releaseFlaresFor(plane);
      plane.flareCooldown = 300; // wait 5 seconds (at 60 FPS)
    }
  }
}

function rotateToward(entity, targetAngle, speed, wiggle = 0) {
  let angleDiff =
    ((targetAngle - entity.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

  // === Add random wiggle (optional)
  angleDiff += (Math.random() - 0.5) * wiggle;

  entity.angle += Math.max(-speed, Math.min(speed, angleDiff));
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
        opp.health -= 10;
        createExplosion(opp.x, opp.y, 20);
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
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];

    // Find nearest opponent
    let nearestOpponent = null;
    let nearestDist = Infinity;
    for (const opp of opponents) {
      const dx = opp.x - m.x;
      const dy = opp.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestOpponent = opp;
      }
    }

    if (nearestOpponent) {
      const dx = nearestOpponent.x - m.x;
      const dy = nearestOpponent.y - m.y;
      const targetAngle = Math.atan2(dy, dx);

      rotateToward(m, targetAngle, 0.05, 0.2);

      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.life--;

      // Missile trail
      particles.push({
        x: m.x,
        y: m.y,
        alpha: 0.5,
        radius: 2 + Math.random() * 2,
        angle: m.angle + (Math.random() * 0.2 - 0.1),
        color: "white",
      });

      // Check hit
      if (Math.hypot(dx, dy) < 40) {
        nearestOpponent.health -= 25;
        createExplosion(nearestOpponent.x, nearestOpponent.y, 70);
        missiles.splice(i, 1);
        continue;
      }

      if (m.life <= 0) {
        createExplosion(m.x, m.y); // 💥 explode on timeout
        missiles.splice(i, 1);
      }
    }
  }

  // === Update opponent missiles ===
  for (let i = opponentMissiles.length - 1; i >= 0; i--) {
    const m = opponentMissiles[i];

    let targetX, targetY;

    // === If there are flares, prefer chasing the nearest flare
    const nearestFlare = findNearestFlare(m.x, m.y);
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

    rotateToward(m, targetAngle, 0.05, 0.2);

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
        player.health -= 25;
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
  const minRange = 300;
  const maxRange = 900;
  const coneAngle = Math.PI / 20; // Smaller angle = sharper triangle

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

  // === Draw pointy cone ===
  ctx.beginPath();
  ctx.moveTo(px, py); // sharp tip at the nose of the plane
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();

  ctx.fillStyle = "rgba(0, 255, 0, 0.06)";
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}


function drawUI() {
  drawHealthBars();
  drawSpeedometer();
  drawFloatingTexts();
  drawWingTrails(player.wingTrails);
  drawMissileRangeGuide();

  // Show ammo count
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  ctx.fillText(
    `🔫 ${player.machineGunAmmo} | 🚀 ${player.missileAmmo}`,
    20,
    50
  );
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
