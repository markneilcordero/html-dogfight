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
const bulletImage = loadImage("images/bullet.png"); // path to your uploaded image

// ======================
// [3.1] Load Sounds
// ======================
const sounds = {
  shoot: new Audio("sounds/shoot.wav"),
  explosion: new Audio("sounds/explosion.wav"),
  missile: new Audio("sounds/missile.wav"),
};

function playSound(name) {
  const sfx = sounds[name].cloneNode(); // allow overlapping
  sfx.volume = 0.5;
  sfx.play();
}

// ======================
// [4] Player
// ======================
const player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  angle: 0,
  speed: 0,
  maxSpeed: 5,
  rotationSpeed: 0.05,
  acceleration: 0.1,
  image: playerImage,
  width: 60,
  height: 60,
  health: 100,
};

let lives = 3;
let isGameOver = false;
let score = 0;
let isPaused = false;

const MIN_PLANE_SPEED = 5;

const bullets = [];
const BULLET_SPEED = 10;
const BULLET_LIFESPAN = 60; // ~1 second @ 60fps
const BULLET_SIZE = 10;
let shootCooldown = 0;

const trails = [];

const missiles = [];
const MISSILE_SPEED = 6;
const MISSILE_TURN_RATE = 0.08;
const MISSILE_SIZE = 10;
const MISSILE_RANGE = 900;
const MISSILE_CONE = Math.PI / 6; // ~30°
const MISSILE_DAMAGE = 50;
let missileCooldown = 0;

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

for (let i = 0; i < ENEMY_COUNT; i++) {
  enemies.push({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    angle: Math.random() * Math.PI * 2,
    speed: 2,
    health: ENEMY_HEALTH,
    turnTimer: Math.floor(Math.random() * 60),
    image: enemyImage,
  });
}

for (let i = 0; i < ALLY_COUNT; i++) {
  allies.push({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    angle: Math.random() * Math.PI * 2,
    speed: 2.5,
    health: ALLY_HEALTH,
    cooldown: 0,
    image: allyImage,
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

function updatePlayer() {
  if (typeof updatePlayerJoystick === "function") updatePlayerJoystick();
  if (keys["a"] || keys["arrowleft"]) player.angle -= player.rotationSpeed;
  if (keys["d"] || keys["arrowright"]) player.angle += player.rotationSpeed;
  if (keys["w"] || keys["arrowup"]) {
    player.speed = Math.min(
      player.speed + player.acceleration,
      player.maxSpeed
    );
  } else {
    player.speed *= 0.98;
    player.speed = Math.max(player.speed, MIN_PLANE_SPEED);
  }

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);

  // Shooting
  if ((keys[" "] || keys["space"]) && shootCooldown <= 0) {
    fireBullet({
      origin: player,
      angle: player.angle,
      speed: BULLET_SPEED,
      life: BULLET_LIFESPAN,
      targetArray: bullets,
      spread: 0.2, // optional
      offset: 30, // optional
    });
    shootCooldown = 10;
  }
  if (shootCooldown > 0) shootCooldown--;

  // Lock-on and fire missile
  if ((keys["m"] || keys["M"]) && missileCooldown <= 0) {
    const target = getLockedTarget(player, enemies);
    if (target) {
      missiles.push({
        x: player.x,
        y: player.y,
        angle: player.angle,
        target: target,
      });
      missileCooldown = 60; // cooldown: 1 second
    }
  }
  if (missileCooldown > 0) missileCooldown--;
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
        e.health -= 25;
        bullets.splice(bi, 1); // remove bullet
      }
    });
  });

  // Remove dead enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].health <= 0) {
      enemies.splice(i, 1);
      enemiesRemaining--;
      score += 100;
    }
  }
}

function updateMissiles() {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    const target = m.target;

    // Track target if still alive
    if (target && enemies.includes(target)) {
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const desiredAngle = Math.atan2(dy, dx);
      let diff = desiredAngle - m.angle;

      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      m.angle += clamp(diff, -MISSILE_TURN_RATE, MISSILE_TURN_RATE);

      // Move forward
      m.x += Math.cos(m.angle) * MISSILE_SPEED;
      m.y += Math.sin(m.angle) * MISSILE_SPEED;

      // Check collision
      const dist = Math.hypot(m.x - target.x, m.y - target.y);
      if (dist < ENEMY_SIZE / 2) {
        target.health -= MISSILE_DAMAGE;
        spawnExplosion(m.x, m.y);
        missiles.splice(i, 1); // explode
      }
    } else {
      // No target or already dead
      missiles.splice(i, 1);
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
      player.health -= 5;
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
        e.health -= 20;
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
}

function updateFlares() {
  for (let i = flares.length - 1; i >= 0; i--) {
    flares[i].timer--;
    if (flares[i].timer <= 0) {
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
    // === Missile Dodge Check ===
    const incoming = missiles.find((m) => m.target === enemy);
    if (incoming) {
      // Dodge by turning away
      const dodgeDir = Math.random() > 0.5 ? 1 : -1;
      enemy.angle += 0.1 * dodgeDir;

      // Drop flare occasionally
      if (Math.random() < 0.02) {
        flares.push({
          x: enemy.x,
          y: enemy.y,
          timer: FLARE_DURATION,
        });
      }
    } else {
      // === Chase player ===
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const desiredAngle = Math.atan2(dy, dx);
      let diff = desiredAngle - enemy.angle;

      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      enemy.angle += clamp(diff, -0.05, 0.05);
    }

    // === Move Forward ===
    enemy.speed = Math.max(enemy.speed, MIN_PLANE_SPEED);

    enemy.x += Math.cos(enemy.angle) * enemy.speed;
    enemy.y += Math.sin(enemy.angle) * enemy.speed;

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
          spread: 0.3, // slightly more inaccurate
          offset: 30,
        });
        enemy.cooldown = ENEMY_FIRE_COOLDOWN;
      }
    }
  });
}

function updateAllies() {
  allies.forEach((ally) => {
    // === Lock onto closest opponent ===
    let closest = null;
    let closestDist = Infinity;
    opponentsLoop: for (const opp of enemies) {
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
      const dx = closest.x - ally.x;
      const dy = closest.y - ally.y;
      const angleToTarget = Math.atan2(dy, dx);
      let diff = angleToTarget - ally.angle;

      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      ally.angle += clamp(diff, -0.05, 0.05);

      // Fire bullets
      ally.cooldown--;
      if (ally.cooldown <= 0 && closestDist < 800) {
        fireBullet({
          origin: ally,
          angle: ally.angle,
          speed: ALLY_BULLET_SPEED,
          life: BULLET_LIFESPAN,
          targetArray: allyBullets,
          spread: 0.2,
          offset: 30,
        });
        ally.cooldown = ALLY_FIRE_COOLDOWN;
      }
    }

    // Move forward
    ally.speed = Math.max(ally.speed, MIN_PLANE_SPEED);

    ally.x += Math.cos(ally.angle) * ally.speed;
    ally.y += Math.sin(ally.angle) * ally.speed;

    ally.x = clamp(ally.x, 0, WORLD_WIDTH);
    ally.y = clamp(ally.y, 0, WORLD_HEIGHT);
  });
}

// ======================
// [7] Render World
// ======================
function renderWorld() {
  // Sky background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Optional: grid lines
  ctx.strokeStyle = "#222";
  for (let x = 0; x < WORLD_WIDTH; x += 200) {
    ctx.beginPath();
    ctx.moveTo(x - camera.x, 0 - camera.y);
    ctx.lineTo(x - camera.x, WORLD_HEIGHT - camera.y);
    ctx.stroke();
  }
  for (let y = 0; y < WORLD_HEIGHT; y += 200) {
    ctx.beginPath();
    ctx.moveTo(0 - camera.x, y - camera.y);
    ctx.lineTo(WORLD_WIDTH - camera.x, y - camera.y);
    ctx.stroke();
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
    ctx.strokeStyle = `rgba(255, 255, 255, ${p1.alpha})`;
    ctx.lineWidth = 0.05;
    ctx.moveTo(p1.x - camera.x, p1.y - camera.y);
    ctx.lineTo(p2.x - camera.x, p2.y - camera.y);
    ctx.stroke();
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

    // Draw lock-on ring if player is locking
    if (getLockedTarget(player, [e]) === e) {
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x - camera.x, e.y - camera.y, ENEMY_SIZE, 0, Math.PI * 2);
      ctx.stroke();
    }
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
  ctx.fillStyle = "orange";
  ctx.shadowColor = "orange";
  ctx.shadowBlur = 10;
  missiles.forEach((m) => {
    ctx.beginPath();
    ctx.arc(m.x - camera.x, m.y - camera.y, MISSILE_SIZE, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function renderFlares() {
  ctx.fillStyle = "orange";
  flares.forEach((f) => {
    ctx.beginPath();
    ctx.arc(f.x - camera.x, f.y - camera.y, 12, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderEnemyBullets() {
  enemyBullets.forEach(renderBulletImage);
}

function spawnExplosion(x, y) {
  explosions.push({ x, y, timer: EXPLOSION_DURATION });
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
    ctx.fillStyle = `rgba(255,150,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(e.x - camera.x, e.y - camera.y, 30 * alpha, 0, Math.PI * 2);
    ctx.fill();
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
  ctx.fillText(
    `Throttle: ${((player.speed / player.maxSpeed) * 100).toFixed(0)}%`,
    20,
    30
  );
  ctx.fillText(`Health: ${player.health}%`, 20, 55);
  ctx.fillText(`Score: ${score}`, 20, 130);

  // Optional: FPS counter
  const now = performance.now();
  const fps = Math.round(1000 / (now - lastFrameTime));
  lastFrameTime = now;
  ctx.fillStyle = "#aaa";
  ctx.fillText(`FPS: ${fps}`, 20, 80);
  ctx.fillText(`Lives: ${lives}`, 20, 105);

  ctx.fillStyle = "#00ffcc";
  ctx.fillText(`Level: ${level}`, 20, 155);

  if (isGameOver) {
    ctx.fillStyle = "red";
    ctx.font = "48px sans-serif";
    ctx.fillText("GAME OVER", canvas.width / 2 - 120, canvas.height / 2);
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
      });
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderWorld();
  renderAllies();
  renderEnemies();
  renderFlares();
  renderExplosions(); // BOOM
  renderAllyBullets();
  renderBullets();
  renderMissiles();
  renderEnemyBullets();
  renderHUD();
}

function gameLoop() {
  if (!isPaused && !isGameOver) {
    update();
  }
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
