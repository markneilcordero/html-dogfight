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


// ======================
// [5] Input
// ======================
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);

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
  

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);
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
  }
  

function updateCamera() {
  camera.x = clamp(player.x - camera.width / 2, 0, WORLD_WIDTH - camera.width);
  camera.y = clamp(player.y - camera.height / 2, 0, WORLD_HEIGHT - camera.height);
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
    ctx.fillStyle = "#ffff00";
    bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x - camera.x, b.y - camera.y, BULLET_SIZE, 0, Math.PI * 2);
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
    updateCamera();
  }
  
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderWorld();
    renderBullets(); // <-- add this
    renderHUD();
  }
  

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}
gameLoop();
