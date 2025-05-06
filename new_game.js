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
  return img;
}
const playerImage = loadImage("images/player.png");

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

const bullets = [];
const BULLET_SPEED = 10;
const BULLET_LIFESPAN = 60; // ~1 second @ 60fps
const BULLET_SIZE = 6;
let shootCooldown = 0;

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

const enemyBullets = [];
const ENEMY_FIRE_COOLDOWN = 60;
const ENEMY_BULLET_SPEED = 6;

const allies = [];
const ALLY_COUNT = 3;
const ALLY_SIZE = 50;
const ALLY_HEALTH = 100;
const allyBullets = [];
const ALLY_BULLET_SPEED = 7;
const ALLY_FIRE_COOLDOWN = 40;


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
    });
  }
  
  

// ======================
// [5] Input
// ======================
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);

document.getElementById("fireBtn").addEventListener("touchstart", () => keys[" "]=true);
document.getElementById("fireBtn").addEventListener("touchend",   () => keys[" "]=false);
document.getElementById("missileBtn").addEventListener("touchstart", () => keys["m"]=true);
document.getElementById("missileBtn").addEventListener("touchend",   () => keys["m"]=false);


// ======================
// [6] Update Logic
// ======================
function updatePlayer() {
  if (keys["a"] || keys["arrowleft"]) player.angle -= player.rotationSpeed;
  if (keys["d"] || keys["arrowright"]) player.angle += player.rotationSpeed;
  if (keys["w"] || keys["arrowup"]) {
    player.speed = Math.min(player.speed + player.acceleration, player.maxSpeed);
  } else {
    player.speed *= 0.98;
  }
  

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);

  // Shooting
  if ((keys[" "] || keys["space"]) && shootCooldown <= 0) {
    bullets.push({
      x: player.x + Math.cos(player.angle) * 30,
      y: player.y + Math.sin(player.angle) * 30,
      vx: Math.cos(player.angle) * BULLET_SPEED,
      vy: Math.sin(player.angle) * BULLET_SPEED,
      life: BULLET_LIFESPAN,
    });
    shootCooldown = 10; // cooldown frames
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
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
  
      // Remove bullets out of bounds or expired
      if (
        b.life <= 0 ||
        b.x < 0 || b.x > WORLD_WIDTH ||
        b.y < 0 || b.y > WORLD_HEIGHT
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
      b.x += b.vx;
      b.y += b.vy;
  
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      const dist = Math.hypot(dx, dy);
  
      if (dist < 20) {
        player.health -= 5;
        enemyBullets.splice(i, 1);
        continue;
      }
  
      if (
        b.x < 0 || b.x > WORLD_WIDTH ||
        b.y < 0 || b.y > WORLD_HEIGHT
      ) {
        enemyBullets.splice(i, 1);
      }
    }
  }

  function updateAllyBullets() {
    for (let i = allyBullets.length - 1; i >= 0; i--) {
      const b = allyBullets[i];
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
  
      if (b.x < 0 || b.x > WORLD_WIDTH || b.y < 0 || b.y > WORLD_HEIGHT) {
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
  camera.y = clamp(player.y - camera.height / 2, 0, WORLD_HEIGHT - camera.height);
}

function updateEnemies() {
    enemies.forEach(enemy => {
      // === Missile Dodge Check ===
      const incoming = missiles.find(m => m.target === enemy);
      if (incoming) {
        // Dodge by turning away
        const dodgeDir = (Math.random() > 0.5 ? 1 : -1);
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
          enemyBullets.push({
            x: enemy.x + Math.cos(enemy.angle) * 30,
            y: enemy.y + Math.sin(enemy.angle) * 30,
            vx: Math.cos(enemy.angle) * ENEMY_BULLET_SPEED,
            vy: Math.sin(enemy.angle) * ENEMY_BULLET_SPEED,
          });
          enemy.cooldown = ENEMY_FIRE_COOLDOWN;
        }
      }
    });
  }  
  
  function updateAllies() {
    allies.forEach(ally => {
      // === Lock onto closest opponent ===
      let closest = null;
      let closestDist = Infinity;
      opponentsLoop:
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
          allyBullets.push({
            x: ally.x + Math.cos(ally.angle) * 30,
            y: ally.y + Math.sin(ally.angle) * 30,
            vx: Math.cos(ally.angle) * ALLY_BULLET_SPEED,
            vy: Math.sin(ally.angle) * ALLY_BULLET_SPEED,
          });
          ally.cooldown = ALLY_FIRE_COOLDOWN;
        }
      }
  
      // Move forward
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
  ctx.rotate(player.angle);
  ctx.drawImage(player.image, -player.width / 2, -player.height / 2, player.width, player.height);
  ctx.restore();
}

function renderBullets() {
    ctx.fillStyle = "yellow";
    ctx.shadowColor = "yellow";
    ctx.shadowBlur = 8;
    bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x - camera.x, b.y - camera.y, BULLET_SIZE, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function renderEnemies() {
    enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x - camera.x, e.y - camera.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.moveTo(0, -ENEMY_SIZE / 2);
      ctx.lineTo(ENEMY_SIZE / 2, ENEMY_SIZE / 2);
      ctx.lineTo(-ENEMY_SIZE / 2, ENEMY_SIZE / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
  
      // Health bar
      ctx.fillStyle = "black";
      ctx.fillRect(e.x - 25 - camera.x, e.y - ENEMY_SIZE / 2 - 20 - camera.y, 50, 6);
      ctx.fillStyle = "lime";
      ctx.fillRect(e.x - 25 - camera.x, e.y - ENEMY_SIZE / 2 - 20 - camera.y, (e.health / ENEMY_HEALTH) * 50, 6);

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
    allies.forEach(a => {
      ctx.save();
      ctx.translate(a.x - camera.x, a.y - camera.y);
      ctx.rotate(a.angle);
      ctx.fillStyle = "#00aaff";
      ctx.beginPath();
      ctx.moveTo(0, -ALLY_SIZE / 2);
      ctx.lineTo(ALLY_SIZE / 2, ALLY_SIZE / 2);
      ctx.lineTo(-ALLY_SIZE / 2, ALLY_SIZE / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
  
      // Health bar
      ctx.fillStyle = "black";
      ctx.fillRect(a.x - 25 - camera.x, a.y - ALLY_SIZE / 2 - 20 - camera.y, 50, 6);
      ctx.fillStyle = "cyan";
      ctx.fillRect(a.x - 25 - camera.x, a.y - ALLY_SIZE / 2 - 20 - camera.y, (a.health / ALLY_HEALTH) * 50, 6);
    });
  }
  
  function renderAllyBullets() {
    ctx.fillStyle = "cyan";
    allyBullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x - camera.x, b.y - camera.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  

  function renderMissiles() {
    ctx.fillStyle = "orange";
    ctx.shadowColor = "orange";
    ctx.shadowBlur = 10;
    missiles.forEach(m => {
      ctx.beginPath();
      ctx.arc(m.x - camera.x, m.y - camera.y, MISSILE_SIZE, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }
  
  function renderFlares() {
    ctx.fillStyle = "orange";
    flares.forEach(f => {
      ctx.beginPath();
      ctx.arc(f.x - camera.x, f.y - camera.y, 12, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  function renderEnemyBullets() {
    ctx.fillStyle = "red";
    enemyBullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x - camera.x, b.y - camera.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
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
    explosions.forEach(e => {
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
  ctx.fillText(`Throttle: ${(player.speed / player.maxSpeed * 100).toFixed(0)}%`, 20, 30);
  ctx.fillText(`Health: ${player.health}%`, 20, 55);

  // Optional: FPS counter
  const now = performance.now();
  const fps = Math.round(1000 / (now - lastFrameTime));
  lastFrameTime = now;
  ctx.fillStyle = "#aaa";
  ctx.fillText(`FPS: ${fps}`, 20, 80);

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
  }
  
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderWorld();
    renderAllies();
    renderEnemies();
    renderFlares();
    renderExplosions();     // BOOM
    renderAllyBullets();
    renderBullets();
    renderMissiles();
    renderEnemyBullets();
    renderHUD();
  }
  
  

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}
gameLoop();
