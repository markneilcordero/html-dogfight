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

const opponentImg = new Image();
opponentImg.src = "images/opponent.png"; // Save your uploaded image with this name

const machineGunBulletImg = new Image();
machineGunBulletImg.src = "images/bullet.png"; // Save the uploaded image as this name

const missileImg = new Image();
missileImg.src = "images/missile.png"; // Replace with correct path if needed

const minSpeed = 1.0; // ✅ Declare this first
let thrust = minSpeed; // ✅ Now this is valid

const maxSpeed = 5;
const acceleration = 0.1;
const deceleration = 0.05;
const friction = 0.02;

let joystickAngle = 0;
let joystickActive = false;

const joystick = document.getElementById("joystick");
const container = document.getElementById("joystickContainer");

const missiles = [];
let lastMissileSide = "right"; // Start with right, so the first missile is from the left
function fireMissile() {
  const sideOffset = 10; // Distance from center to wing
  const forwardOffset = 30; // In front of the ship

  // Determine which side to fire from
  const angleOffset = lastMissileSide === "left" ? Math.PI / 2 : -Math.PI / 2;

  missiles.push({
    x:
      player.x +
      Math.cos(player.angle) * forwardOffset +
      Math.cos(player.angle + angleOffset) * sideOffset,
    y:
      player.y +
      Math.sin(player.angle) * forwardOffset +
      Math.sin(player.angle + angleOffset) * sideOffset,
    angle: player.angle,
    speed: 1,
    life: 180,
  });

  // Toggle for next shot
  lastMissileSide = lastMissileSide === "left" ? "right" : "left";
}

const machineGunBullets = [];

function fireMachineGun() {
  machineGunBullets.push({
    x: player.x + Math.cos(player.angle) * 30,
    y: player.y + Math.sin(player.angle) * 30,
    angle: player.angle,
    speed: 16,
    life: 60, // frames
  });
}

let machineGunInterval = null;

// === Mobile Button
const btnMachineGun = document.getElementById("btnMachineGun");

btnMachineGun.addEventListener(
  "touchstart",
  () => {
    if (machineGunInterval) return;
    machineGunInterval = setInterval(fireMachineGun, 100); // 10 bullets per second
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

// === Keyboard (F key)
window.addEventListener("keydown", (e) => {
  if (e.key === "f" && !machineGunInterval) {
    machineGunInterval = setInterval(fireMachineGun, 100);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "g") fireMissile();
});

const btnMissile = document.getElementById("btnMissile");
let missileTouchHandled = false;
btnMissile.addEventListener(
  "touchstart",
  (e) => {
    missileTouchHandled = true;
    fireMissile();
  },
  { passive: true }
);

btnMissile.addEventListener("click", (e) => {
  if (missileTouchHandled) {
    missileTouchHandled = false; // Reset flag
    return; // Skip the click after touch
  }
  fireMissile();
});

window.addEventListener("keyup", (e) => {
  if (e.key === "f") {
    clearInterval(machineGunInterval);
    machineGunInterval = null;
  }
});

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

  const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 40); // limit drag radius
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

document.getElementById("btnThrottleUp").addEventListener(
  "touchstart",
  () => {
    thrust += acceleration;
    if (thrust > maxSpeed) thrust = maxSpeed;
  },
  { passive: true }
);

document.getElementById("btnThrottleDown").addEventListener(
  "touchstart",
  () => {
    thrust -= deceleration;
    if (thrust < minSpeed) thrust = minSpeed;
  },
  { passive: true }
);

let throttleIntervalUp = null;
let throttleIntervalDown = null;

const btnThrottleUp = document.getElementById("btnThrottleUp");
const btnThrottleDown = document.getElementById("btnThrottleDown");

// === Throttle Up Button ===
btnThrottleUp.addEventListener(
  "touchstart",
  () => {
    if (throttleIntervalUp) return; // Prevent multiple intervals
    throttleIntervalUp = setInterval(() => {
      thrust += acceleration;
      if (thrust > maxSpeed) thrust = maxSpeed;
    }, 100); // Every 100ms while holding
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
      thrust -= deceleration;
      if (thrust < minSpeed) thrust = minSpeed;
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

const player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  width: 60, // Adjust size if needed
  height: 60,
  speed: 3,
  angle: 0, // New: For rotation
};

const opponent = {
    x: 500,
    y: 500,
    width: 60,
    height: 60,
    speed: 2,
    angle: 0,
    fireCooldown: 0,
    missileCooldown: 0,
  };

  const opponentBullets = [];
const opponentMissiles = [];

function updateOpponentAI() {
    // === Step 1: Calculate angle to player
    const dx = player.x - opponent.x;
    const dy = player.y - opponent.y;
    const targetAngle = Math.atan2(dy, dx);
  
    // === Step 2: Smoothly rotate toward the player (limited turning speed)
    const angleDiff = ((targetAngle - opponent.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const turnRate = 0.03; // Lower is slower turning
    opponent.angle += Math.max(-turnRate, Math.min(turnRate, angleDiff));
  
    // === Step 3: Move forward constantly like a real plane
    opponent.x += Math.cos(opponent.angle) * opponent.speed;
    opponent.y += Math.sin(opponent.angle) * opponent.speed;
  
    // === Step 4: Fire machine gun if in range
    const dist = Math.hypot(dx, dy);
    if (opponent.fireCooldown <= 0 && dist < 800) {
      opponentBullets.push({
        x: opponent.x + Math.cos(opponent.angle) * 30,
        y: opponent.y + Math.sin(opponent.angle) * 30,
        angle: opponent.angle,
        speed: 12,
        life: 60,
      });
      opponent.fireCooldown = 15;
    }
  
    // === Step 5: Fire missile if in range
    if (opponent.missileCooldown <= 0 && dist < 1000) {
      opponentMissiles.push({
        x: opponent.x + Math.cos(opponent.angle) * 40,
        y: opponent.y + Math.sin(opponent.angle) * 40,
        angle: opponent.angle,
        speed: 4,
        life: 180,
      });
      opponent.missileCooldown = 180;
    }
  
    opponent.fireCooldown--;
    opponent.missileCooldown--;
  }
  
  

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

const bulletTrails = [];
const missileTrails = [];
function update() {
  // Rotate left/right
  if (joystickActive) {
    player.angle = joystickAngle;

    // Auto-thrust while using joystick
    player.x += Math.cos(player.angle) * thrust;
    player.y += Math.sin(player.angle) * thrust;
  } else {
    if (keys["ArrowLeft"] || keys["a"]) player.angle -= 0.05;
    if (keys["ArrowRight"] || keys["d"]) player.angle += 0.05;

    player.x += Math.cos(player.angle) * thrust;
    player.y += Math.sin(player.angle) * thrust;
  }

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

  // === Update Machine Gun Bullets ===
  for (let i = machineGunBullets.length - 1; i >= 0; i--) {
    const b = machineGunBullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;
    if (b.life <= 0) machineGunBullets.splice(i, 1);
  }

  for (let i = machineGunBullets.length - 1; i >= 0; i--) {
    const b = machineGunBullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;

    // === 🔥 Add trail particle
    bulletTrails.push({
      x: b.x - Math.cos(b.angle) * 10, // behind the bullet
      y: b.y - Math.sin(b.angle) * 10,
      radius: 2 + Math.random() * 2,
      alpha: 1,
      color: "yellow",
    });

    if (b.life <= 0) machineGunBullets.splice(i, 1);
  }

  for (let i = bulletTrails.length - 1; i >= 0; i--) {
    const t = bulletTrails[i];
    t.alpha -= 0.05;
    if (t.alpha <= 0) bulletTrails.splice(i, 1);
  }

  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.x += Math.cos(m.angle) * m.speed;
    m.y += Math.sin(m.angle) * m.speed;
    m.life--;

    // === 🚀 Missile Trail Particle
    missileTrails.push({
      x: m.x - Math.cos(m.angle) * 35, // Behind the missile
      y: m.y - Math.sin(m.angle) * 35,
      radius: 3 + Math.random() * 2, // Random size
      alpha: 1,
      color: "lightgray", // Can be "gray", "white", "yellow", "red"
    });

    if (m.life <= 0) missiles.splice(i, 1);
  }

  for (let i = missileTrails.length - 1; i >= 0; i--) {
    const t = missileTrails[i];
    t.alpha -= 0.02; // Fade out slowly
    if (t.alpha <= 0) missileTrails.splice(i, 1);
  }

  // === Opponent Bullets
for (let i = opponentBullets.length - 1; i >= 0; i--) {
    const b = opponentBullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;
    if (b.life <= 0) opponentBullets.splice(i, 1);
  }
  
  // === Opponent Missiles
  for (let i = opponentMissiles.length - 1; i >= 0; i--) {
    const m = opponentMissiles[i];
    m.x += Math.cos(m.angle) * m.speed;
    m.y += Math.sin(m.angle) * m.speed;
    m.life--;
    if (m.life <= 0) opponentMissiles.splice(i, 1);
  }
  

  createAfterburnerParticle();
  updateParticles();

  createWingTrails();
  updateWingTrails();
  updateOpponentAI();
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

  // === 🔥 Draw Bullet Trails
  for (const t of bulletTrails) {
    ctx.save();
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(t.x - camera.x, t.y - camera.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // === Draw Machine Gun Bullets ===
  for (const b of machineGunBullets) {
    ctx.save();
    ctx.translate(b.x - camera.x, b.y - camera.y);
    ctx.rotate(b.angle);
    ctx.drawImage(machineGunBulletImg, -10, -5, 20, 10); // Adjust size if needed
    ctx.restore();
  }

  // === 🚀 Draw Missile Trails
  for (const t of missileTrails) {
    ctx.save();
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(t.x - camera.x, t.y - camera.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const m of missiles) {
    ctx.save();
    ctx.translate(m.x - camera.x, m.y - camera.y);
    ctx.rotate(m.angle);
    ctx.drawImage(missileImg, -40, -20, 40, 40); // Missile is now 60x24 pixels
    ctx.restore();
  }

  // === Draw Opponent
ctx.save();
ctx.translate(opponent.x - camera.x, opponent.y - camera.y);
ctx.rotate(opponent.angle + Math.PI / 4);
ctx.drawImage(opponentImg, -opponent.width / 2, -opponent.height / 2, opponent.width, opponent.height);
ctx.restore();

// === Draw Opponent Bullets
for (const b of opponentBullets) {
  ctx.save();
  ctx.translate(b.x - camera.x, b.y - camera.y);
  ctx.rotate(b.angle);
  ctx.drawImage(machineGunBulletImg, -10, -5, 20, 10);
  ctx.restore();
}

// === Draw Opponent Missiles
for (const m of opponentMissiles) {
  ctx.save();
  ctx.translate(m.x - camera.x, m.y - camera.y);
  ctx.rotate(m.angle);
  ctx.drawImage(missileImg, -40, -20, 40, 40);
  ctx.restore();
}


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
