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

const skyImg = new Image();
skyImg.src = "images/sky.jpeg"; // your uploaded image

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

function drawSpeedometer() {
  const speedText = `Speed: ${thrust.toFixed(1)} / ${maxSpeed}`;
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText(speedText, 20, canvas.height - 40);

  const barX = 20;
  const barY = canvas.height - 30;
  const barWidth = 200;
  const barHeight = 15;

  // === Background ===
  ctx.fillStyle = "#555";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // === Dynamic Color Based on Speed ===
  const speedPercent = thrust / maxSpeed;
  let barColor = "lime"; // Default green

  if (speedPercent > 0.7) {
    barColor = "red";
  } else if (speedPercent > 0.4) {
    barColor = "yellow";
  }

  // === Fill Speed Bar ===
  ctx.fillStyle = barColor;
  ctx.fillRect(barX, barY, barWidth * speedPercent, barHeight);

  // === Border ===
  ctx.strokeStyle = "white";
  ctx.strokeRect(barX, barY, barWidth, barHeight);
}

const particles = [];
function createAfterburnerParticle() {
  if (thrust / maxSpeed < 0.7) return;

  const colors = ["white", "lightgray"];
  const color1 = colors[Math.floor(Math.random() * colors.length)];
  const color2 = colors[Math.floor(Math.random() * colors.length)];

  const backOffset = 32; // How far backward from the center
  const sideOffset = 5; // How far left/right from center (adjust to your plane width)

  // === Left Engine ===
  particles.push({
    x:
      player.x -
      Math.cos(player.angle) * backOffset +
      Math.cos(player.angle + Math.PI / 2) * sideOffset,
    y:
      player.y -
      Math.sin(player.angle) * backOffset +
      Math.sin(player.angle + Math.PI / 2) * sideOffset,
    alpha: 1,
    radius: 3 + Math.random() * 2,
    angle: player.angle + (Math.random() * 0.3 - 0.15),
    color: color1,
  });

  // === Right Engine ===
  particles.push({
    x:
      player.x -
      Math.cos(player.angle) * backOffset +
      Math.cos(player.angle - Math.PI / 2) * sideOffset,
    y:
      player.y -
      Math.sin(player.angle) * backOffset +
      Math.sin(player.angle - Math.PI / 2) * sideOffset,
    alpha: 1,
    radius: 3 + Math.random() * 2,
    angle: player.angle + (Math.random() * 0.3 - 0.15),
    color: color2,
  });
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

const wingTrails = [];
function createWingTrails() {
  if (thrust < 0.5 * maxSpeed) return; // only show when flying fast

  const offset = 20; // distance from center to wing
  const leftWing = {
    x: player.x + Math.cos(player.angle + Math.PI / 2) * offset,
    y: player.y + Math.sin(player.angle + Math.PI / 2) * offset,
    alpha: 0.6,
  };
  const rightWing = {
    x: player.x + Math.cos(player.angle - Math.PI / 2) * offset,
    y: player.y + Math.sin(player.angle - Math.PI / 2) * offset,
    alpha: 0.6,
  };
  wingTrails.push(leftWing, rightWing);

  // Limit to recent 30 segments
  if (wingTrails.length > 60) wingTrails.splice(0, wingTrails.length - 60);
}

function updateWingTrails() {
  for (let i = wingTrails.length - 1; i >= 0; i--) {
    wingTrails[i].alpha -= 0.01;
    if (wingTrails[i].alpha <= 0) {
      wingTrails.splice(i, 1);
    }
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
    ctx.lineTo(t.x - camera.x, t.y - camera.y + 1); // tiny line
    ctx.stroke();
    ctx.restore();
  }
}

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

let thrust = 0; // New: current thrust/speed
const maxSpeed = 5;
const acceleration = 0.1;
const deceleration = 0.05;
const friction = 0.02; // Passive slow down if no key pressed

function update() {
  // Rotate left/right
  if (keys["ArrowLeft"] || keys["a"]) player.angle -= 0.05;
  if (keys["ArrowRight"] || keys["d"]) player.angle += 0.05;

  const minSpeed = 1.0;
  // === Throttle-based controls ===
  if (keys["ArrowUp"] || keys["w"]) {
    thrust += acceleration;
    if (thrust > maxSpeed) thrust = maxSpeed;
  }

  if (keys["ArrowDown"] || keys["s"]) {
    thrust -= deceleration;
    if (thrust < minSpeed) thrust = minSpeed; // ✈️ cannot go below minimum speed
  }

  // === Move player based on current thrust ===
  player.x += Math.cos(player.angle) * thrust;
  player.y += Math.sin(player.angle) * thrust;

  // Clamp player inside world
  player.x = Math.max(0, Math.min(WORLD_WIDTH, player.x));
  player.y = Math.max(0, Math.min(WORLD_HEIGHT, player.y));

  // Camera follows player
  camera.x = player.x - camera.width / 2;
  camera.y = player.y - camera.height / 2;
  camera.x = Math.max(0, Math.min(WORLD_WIDTH - camera.width, camera.x));
  camera.y = Math.max(0, Math.min(WORLD_HEIGHT - camera.height, camera.y));

  createAfterburnerParticle();
  updateParticles();

  createWingTrails();
  updateWingTrails();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  // === Sky Background (repeating image) ===
  const skyPatternSize = 1024; // adjust based on image size

  for (
    let x = (-camera.x % skyPatternSize) - skyPatternSize;
    x < canvas.width;
    x += skyPatternSize
  ) {
    for (
      let y = (-camera.y % skyPatternSize) - skyPatternSize;
      y < canvas.height;
      y += skyPatternSize
    ) {
      // === Draw full sky image background (non-repeating) ===
      ctx.drawImage(skyImg, -camera.x, -camera.y, WORLD_WIDTH, WORLD_HEIGHT);
    }
  }

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

  // === Draw Speedometer ===
  drawSpeedometer();
  drawParticles();
  drawWingTrails();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
