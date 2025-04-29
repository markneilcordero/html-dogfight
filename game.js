const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// === World Size & Camera ===
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

const camera = {
  x: 0,
  y: 0,
  width: window.innerWidth,
  height: window.innerHeight,
};

// === Resize Canvas to Full Screen ===
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.width = canvas.width;
  camera.height = canvas.height;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Initial call

// === [Load Player Image] ===
const playerImg = new Image();
playerImg.src = "images/player.png"; // Your uploaded fighter plane

const player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  width: 60, // Adjust size if needed
  height: 60,
  speed: 3,
  angle: 0, // New: For rotation
};

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

function update() {
  // Rotate player
  if (keys["ArrowLeft"] || keys["a"]) player.angle -= 0.05;
  if (keys["ArrowRight"] || keys["d"]) player.angle += 0.05;

  // Move forward
  if (keys["ArrowUp"] || keys["w"]) {
    player.x += Math.cos(player.angle) * player.speed;
    player.y += Math.sin(player.angle) * player.speed;
  }

  // Move backward (optional)
  if (keys["ArrowDown"] || keys["s"]) {
    player.x -= Math.cos(player.angle) * player.speed * 0.5;
    player.y -= Math.sin(player.angle) * player.speed * 0.5;
  }

  // Clamp player inside world
  player.x = Math.max(0, Math.min(WORLD_WIDTH, player.x));
  player.y = Math.max(0, Math.min(WORLD_HEIGHT, player.y));

  // Camera follows player
  camera.x = player.x - camera.width / 2;
  camera.y = player.y - camera.height / 2;

  camera.x = Math.max(0, Math.min(WORLD_WIDTH - camera.width, camera.x));
  camera.y = Math.max(0, Math.min(WORLD_HEIGHT - camera.height, camera.y));
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = "#d0e7f9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid (optional)
  ctx.strokeStyle = "#ccc";
  for (let x = -camera.x % 100; x < canvas.width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -camera.y % 100; y < canvas.height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // === Draw Player Plane ===
  const IMAGE_ROTATION_OFFSET = Math.PI / 4; // -45 degrees

  ctx.save();
  ctx.translate(player.x - camera.x, player.y - camera.y);
  ctx.rotate(player.angle + IMAGE_ROTATION_OFFSET); // adjust here
  ctx.drawImage(
    playerImg,
    -player.width / 2,
    -player.height / 2,
    player.width,
    player.height
  );
  ctx.restore();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
