// ====================
// [1] Setup and Initialization
// ====================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

const camera = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };

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
  explosion: loadImage("images/explosion.png")
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
  
    container.addEventListener("touchstart", (e) => {
      joystickActive = true;
    }, { passive: false });
  
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
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

function setupThrottleControls() {
    const btnThrottleUp = document.getElementById("btnThrottleUp");
    const btnThrottleDown = document.getElementById("btnThrottleDown");
  
    let throttleIntervalUp = null;
    let throttleIntervalDown = null;
  
    // === Throttle Up Button ===
    btnThrottleUp.addEventListener("touchstart", () => {
      if (throttleIntervalUp) return;
      throttleIntervalUp = setInterval(() => {
        player.thrust += 0.1;
        if (player.thrust > 5) player.thrust = 5;
      }, 100);
    }, { passive: true });
  
    btnThrottleUp.addEventListener("touchend", () => {
      clearInterval(throttleIntervalUp);
      throttleIntervalUp = null;
    });
  
    btnThrottleUp.addEventListener("touchcancel", () => {
      clearInterval(throttleIntervalUp);
      throttleIntervalUp = null;
    });
  
    // === Throttle Down Button ===
    btnThrottleDown.addEventListener("touchstart", () => {
      if (throttleIntervalDown) return;
      throttleIntervalDown = setInterval(() => {
        player.thrust -= 0.05;
        if (player.thrust < 1.0) player.thrust = 1.0;
      }, 100);
    }, { passive: true });
  
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
    btnMachineGun.addEventListener("touchstart", () => {
      if (machineGunInterval) return;
      machineGunInterval = setInterval(fireMachineGun, 100);
    }, { passive: true });
  
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
    btnMissile.addEventListener("touchstart", () => {
      missileTouchHandled = true;
      fireMissile();
    }, { passive: true });
  
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
      if (flares.length < 1) { // simple cooldown check
        releaseFlares();
      }
    });
  
    window.addEventListener("keydown", (e) => {
      if (e.key === "h") {
        releaseFlares();
      }
    });
  }
  

setupThrottleControls();
setupWeaponControls();

// ====================
// [3] Entity Definitions
// ====================
const player = createPlane(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
const opponent = createPlane(500, 500);

let machineGunBullets = [], missiles = [], flares = [], explosions = [];
let opponentBullets = [], opponentMissiles = [];
let particles = [], wingTrails = [], floatingTexts = [];

let isMissileLockedOn = false;
let lockOnAlertCooldown = 0;
let missileLockAnnounced = false;

// === Lock Variables ===
const PLAYER_LOCK_TIME = 90;    // Player needs 1.5 seconds to lock (adjust this!)
const OPPONENT_LOCK_TIME = 90;  // Opponent needs 1.5 seconds to lock (adjust this!)

let playerMissileLockTimer = 0; // how long player has been locking onto opponent
let playerMissileLockReady = false;

let opponentMissileLockTimer = 0; // how long opponent has been locking onto player
let opponentMissileLockReady = false;


function createPlane(x, y) {
  return { x, y, width: 60, height: 60, speed: 3, angle: 0, thrust: 1.0, health: 100, maxHealth: 100 };
}

// ====================
// [4] Utility Functions
// ====================
function createFloatingText(text, x, y, color = "white", size = 20) {
  floatingTexts.push({ text, x, y, color, size, alpha: 1, life: 60 });
}

function createParticle(x, y, angle, color) {
  particles.push({ x, y, angle, color, radius: 3 + Math.random() * 2, alpha: 1 });
}

function createTrail(x, y, color) {
  wingTrails.push({ x, y, color, alpha: 0.6 });
  if (wingTrails.length > 60) wingTrails.shift();
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
  

// ====================
// [5] Player Actions
// ====================
function fireMachineGun() {
  machineGunBullets.push({ x: player.x, y: player.y, angle: player.angle, speed: 16, life: 60 });
}

function fireMissile() {
    if (!playerMissileLockReady) {
      createFloatingText("LOCKING... 🔒", player.x, player.y - 80, "yellow", 18);
      return;
    }
  
    // Fire missile
    missiles.push({ x: player.x, y: player.y, angle: player.angle, speed: 4, life: 180 });
    
    playerMissileLockReady = false;
    playerMissileLockTimer = 0;
  }
  

function releaseFlares() {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      flares.push({
        x: player.x,
        y: player.y,
        angle: angle,
        speed: 1 + Math.random(),
        life: 180,
        size: 12 + Math.random() * 6 // ✅ Add this!
      });
    }
  }
  

// ====================
// [6] Opponent AI
// ====================
function updateOpponent() {
    const dx = player.x - opponent.x;
    const dy = player.y - opponent.y;
    const dist = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);
  
    rotateToward(opponent, targetAngle, 0.03);
    moveForward(opponent);
  
    // === Inside updateOpponent() ===
if (dist < 1000) {
    opponentMissileLockTimer += 1;
    if (opponentMissileLockTimer > OPPONENT_LOCK_TIME) {
      opponentMissileLockReady = true;
    }
  } else {
    opponentMissileLockTimer = 0;
    opponentMissileLockReady = false;
  }
  
  
    if (dist < 800 && Math.random() < 0.05) {
      fireOpponentMachineGun();
    }
    
    if (opponentMissileLockReady && Math.random() < 0.02) {
      fireOpponentMissile();
      opponentMissileLockReady = false;
      opponentMissileLockTimer = 0;
    }
  }
  

function updateOpponentBullets() {
    for (let i = opponentBullets.length - 1; i >= 0; i--) {
      const b = opponentBullets[i];
      b.x += Math.cos(b.angle) * b.speed;
      b.y += Math.sin(b.angle) * b.speed;
      b.life--;
  
      // Check collision with player
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        player.health -= 10;
        createExplosion(player.x, player.y);
        opponentBullets.splice(i, 1);
        continue;
      }
  
      if (b.life <= 0) {
        opponentBullets.splice(i, 1);
      }
    }
  }
  

function fireOpponentMachineGun() {
  opponentBullets.push({ x: opponent.x, y: opponent.y, angle: opponent.angle, speed: 12, life: 60 });
}

function fireOpponentMissile() {
  opponentMissiles.push({ x: opponent.x, y: opponent.y, angle: opponent.angle, speed: 4, life: 180 });
}

function updatePlayerMissileLock() {
    const dx = opponent.x - player.x;
    const dy = opponent.y - player.y;
    const dist = Math.hypot(dx, dy);
  
    // === Inside updatePlayerMissileLock() ===
if (dist < 1000) {
    playerMissileLockTimer += 1;
    if (playerMissileLockTimer > PLAYER_LOCK_TIME) {
      playerMissileLockReady = true;
    }
  } else {
    playerMissileLockTimer = 0;
    playerMissileLockReady = false;
  }
  
  }
  

// ====================
// [7] Update Functions
// ====================
function update() {
  updatePlayer();
  updateBullets();
  updateOpponentBullets();
  updateMissiles();
  updateOpponent();
  updateFlares();
  updateParticles();
  updateFloatingTexts();
  updateWingTrails();
  updateExplosions();
  updatePlayerMissileLock();
}

function updatePlayer() {
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

  moveForward(player);

  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);

  updateCamera();

  createAfterburnerParticle();
createWingTrails();
}

function createAfterburnerParticle() {
    if (player.thrust / 5 < 0.7) return; // thrust < 70% of max speed
  
    const backOffset = 32;
    const sideOffset = 5;
  
    particles.push({
      x: player.x - Math.cos(player.angle) * backOffset + Math.cos(player.angle + Math.PI / 2) * sideOffset,
      y: player.y - Math.sin(player.angle) * backOffset + Math.sin(player.angle + Math.PI / 2) * sideOffset,
      alpha: 1,
      radius: 3 + Math.random() * 2,
      angle: player.angle + (Math.random() * 0.3 - 0.15),
      color: "lightgray"
    });
  
    particles.push({
      x: player.x - Math.cos(player.angle) * backOffset + Math.cos(player.angle - Math.PI / 2) * sideOffset,
      y: player.y - Math.sin(player.angle) * backOffset + Math.sin(player.angle - Math.PI / 2) * sideOffset,
      alpha: 1,
      radius: 3 + Math.random() * 2,
      angle: player.angle + (Math.random() * 0.3 - 0.15),
      color: "lightgray"
    });
  }
  
  function createWingTrails() {
    if (player.thrust < 0.5 * 5) return; // only create when fast
  
    const offset = 20;
    wingTrails.push({
      x: player.x + Math.cos(player.angle + Math.PI / 2) * offset,
      y: player.y + Math.sin(player.angle + Math.PI / 2) * offset,
      alpha: 0.6
    });
  
    wingTrails.push({
      x: player.x + Math.cos(player.angle - Math.PI / 2) * offset,
      y: player.y + Math.sin(player.angle - Math.PI / 2) * offset,
      alpha: 0.6
    });
  
    if (wingTrails.length > 60) wingTrails.splice(0, wingTrails.length - 60);
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
  camera.y = clamp(player.y - camera.height / 2, 0, WORLD_HEIGHT - camera.height);
}

function moveForward(entity) {
    entity.x += Math.cos(entity.angle) * entity.thrust;
    entity.y += Math.sin(entity.angle) * entity.thrust;
  }  

  function rotateToward(entity, targetAngle, speed, wiggle = 0) {
    let angleDiff = ((targetAngle - entity.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    
    // === Add random wiggle (optional)
    angleDiff += (Math.random() - 0.5) * wiggle;
  
    entity.angle += Math.max(-speed, Math.min(speed, angleDiff));
  }
  

function updateBullets() {
  for (let i = machineGunBullets.length - 1; i >= 0; i--) {
    const b = machineGunBullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;

    // Check collision with opponent
    const dx = opponent.x - b.x;
    const dy = opponent.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) {
      opponent.health -= 10;
      createExplosion(opponent.x, opponent.y);
      machineGunBullets.splice(i, 1);
      continue;
    }

    if (b.life <= 0) {
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
        createFloatingText("🚨 MISSILE LOCKED!", player.x, player.y - 60, "red", 22, true, true);
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
      const dx = opponent.x - m.x;
      const dy = opponent.y - m.y;
      const targetAngle = Math.atan2(dy, dx);
  
      rotateToward(m, targetAngle, 0.05);
  
      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.life--;

      // === Create player missile trail ===
particles.push({
    x: m.x,
    y: m.y,
    alpha: 0.5,
    radius: 2 + Math.random() * 2,
    angle: m.angle + (Math.random() * 0.2 - 0.1), // slight random angle
    color: "white"
  });
  
  
      if (Math.hypot(dx, dy) < 40) {
        opponent.health -= 25;
        createExplosion(opponent.x, opponent.y);
        missiles.splice(i, 1);
        continue;
      }
  
      if (m.life <= 0) {
        missiles.splice(i, 1);
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
      
        rotateToward(m, targetAngle, 0.05);
      
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
          color: "white"
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
            createExplosion(player.x, player.y);
            opponentMissiles.splice(i, 1);
            continue;
          }
        }
      
        if (m.life <= 0) {
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

function createExplosion(x, y) {
  explosions.push({ x, y, life: 30 });
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
  drawPlayer();
  drawOpponent();
  drawProjectiles();
  drawParticles();
  drawExplosions();
  drawUI();
}

function drawBackground() {
  ctx.drawImage(images.sky, -camera.x, -camera.y, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawPlayer() {
  drawEntity(player, images.player);
}

function drawOpponent() {
  drawEntity(opponent, images.opponent);
}

function drawEntity(entity, img) {
  ctx.save();
  ctx.translate(entity.x - camera.x, entity.y - camera.y);
  ctx.rotate(entity.angle + Math.PI / 4);
  ctx.drawImage(img, -entity.width / 2, -entity.height / 2, entity.width, entity.height);
  ctx.restore();
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

function drawWingTrails() {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1.5;
    for (const t of wingTrails) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.beginPath();
      ctx.moveTo(t.x - camera.x, t.y - camera.y);
      ctx.lineTo(t.x - camera.x, t.y - camera.y + 1); // tiny trail
      ctx.stroke();
      ctx.restore();
    }
  }
  

function drawExplosions() {
  for (const exp of explosions) {
    ctx.save();
    ctx.globalAlpha = exp.life / 30; // fade out over 30 frames
    ctx.drawImage(images.explosion, exp.x - 40 - camera.x, exp.y - 40 - camera.y, 80, 80);
    ctx.restore();
  }
}

function drawHealthBars() {
  // Player Health Bar (fixed position)
  const barWidth = 100;
  const barHeight = 10;
  const healthPercent = player.health / player.maxHealth;

  ctx.fillStyle = "red";
  ctx.fillRect(20, 20, barWidth, barHeight);
  ctx.fillStyle = "lime";
  ctx.fillRect(20, 20, barWidth * healthPercent, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(20, 20, barWidth, barHeight);

  // Opponent Health Bar (above opponent)
  const oppHealthPercent = opponent.health / opponent.maxHealth;
  ctx.fillStyle = "red";
  ctx.fillRect(opponent.x - 30 - camera.x, opponent.y - 50 - camera.y, 60, 6);
  ctx.fillStyle = "lime";
  ctx.fillRect(opponent.x - 30 - camera.x, opponent.y - 50 - camera.y, 60 * oppHealthPercent, 6);
  ctx.strokeStyle = "white";
  ctx.strokeRect(opponent.x - 30 - camera.x, opponent.y - 50 - camera.y, 60, 6);
}

function drawSpeedometer() {
  const barX = 20;
  const barY = canvas.height - 30;
  const barWidth = 200;
  const barHeight = 15;
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
  ctx.textAlign = "left";
  ctx.fillText(`Speed: ${player.thrust.toFixed(1)} / 5`, barX, barY - 5);
}

function drawUI() {
  drawHealthBars();
  drawSpeedometer();
  drawFloatingTexts();
  drawWingTrails();
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
