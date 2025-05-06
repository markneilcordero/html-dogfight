// ==================== CONSTANTS & CONFIG ====================
const WORLD_WIDTH             = 4000;
const WORLD_HEIGHT            = 4000;
const MISSILE_LOCK_CONE_ANGLE = Math.PI / 6;
const MISSILE_LOCK_RANGE      = 900;
const PLAYER_LOCK_TIME        = 10;
const OPPONENT_LOCK_TIME      = 10;

// ==================== CANVAS & CAMERA SETUP ====================
const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");

const camera = { x: 0, y: 0, width: 0, height: 0 };

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.width  = canvas.width;
  camera.height = canvas.height;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ==================== INPUT HANDLING ====================
const keys = {};
window.addEventListener("keydown", e => { keys[e.key] = true; });
window.addEventListener("keyup",   e => { keys[e.key] = false;  });

// ==================== ENTITY DEFINITIONS ====================
const player     = { x: WORLD_WIDTH/2, y: WORLD_HEIGHT/2, angle: 0, vx: 0, vy: 0, health: 100 };
const opponents  = [];
const allies     = [];
const bullets    = [];
const missiles   = [];
const flares     = [];
const explosions = [];
const floatingTexts = [];

// Initialize or reset all entities
function initEntities() {
  opponents.length = allies.length = bullets.length = missiles.length = flares.length = explosions.length = floatingTexts.length = 0;
  player.x = WORLD_WIDTH/2;
  player.y = WORLD_HEIGHT/2;
  player.angle = 0;
  player.vx = player.vy = 0;
  player.health = 100;
  player.ammo = { bullets: 100, missiles: 5 };
  player.bulletCooldown = 0;
  player.missileCooldown = 0;
  player.flareCooldown = 0;

  // Opponents
  for (let i = 0; i < 5; i++) {
    opponents.push({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      angle: Math.random() * Math.PI * 2,
      vx:0, vy:0,
      health: 100,
      mode: i % 2 === 0 ? "aggressive" : "defensive",
      bulletCooldown: 0,
      missileCooldown: 0
    });
  }
  // Allies
  for (let i = 0; i < 3; i++) {
    allies.push({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      angle: Math.random() * Math.PI * 2,
      vx:0, vy:0,
      health: 100,
      mode: "balanced",
      bulletCooldown: 0,
      missileCooldown: 0
    });
  }
}

// ==================== UTILITY FUNCTIONS ====================
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function distance(a, b)       { return Math.hypot(b.x - a.x, b.y - a.y); }
function angleTo(a, b)        { return Math.atan2(b.y - a.y, b.x - a.x); }

function isInMissileCone(e, t) {
  const d = distance(e, t);
  if (d > MISSILE_LOCK_RANGE) return false;
  const at = angleTo(e, t);
  const diff = Math.abs(Math.atan2(Math.sin(e.angle - at), Math.cos(e.angle - at)));
  return diff < MISSILE_LOCK_CONE_ANGLE;
}

function isAngleAligned(a1, a2, tol = Math.PI/6) {
  const diff = Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2)));
  return diff < tol;
}

// ==================== UPDATE FUNCTIONS ====================
function updatePlayer() {
  const turnSpeed      = 0.05;
  const thrustPower    = 0.3;
  const maxSpeed       = 5;
  const friction       = 0.98;
  const bulletSpeed    = 10;
  const missileCDTime  = 60;

  // Rotate
  if (keys["a"] || keys["ArrowLeft"])  player.angle -= turnSpeed;
  if (keys["d"] || keys["ArrowRight"]) player.angle += turnSpeed;

  // Thrust
  if (keys["w"] || keys["ArrowUp"]) {
    player.vx += Math.cos(player.angle) * thrustPower;
    player.vy += Math.sin(player.angle) * thrustPower;
  }

  // Friction & move
  player.vx *= friction;
  player.vy *= friction;
  player.x += clamp(player.vx, -maxSpeed, maxSpeed);
  player.y += clamp(player.vy, -maxSpeed, maxSpeed);

  // Bounds
  player.x = clamp(player.x, 0, WORLD_WIDTH);
  player.y = clamp(player.y, 0, WORLD_HEIGHT);

  // Fire bullets
  if (keys["f"] && player.ammo.bullets > 0 && player.bulletCooldown === 0) {
    bullets.push({
      x: player.x + Math.cos(player.angle)*20,
      y: player.y + Math.sin(player.angle)*20,
      vx: Math.cos(player.angle)*bulletSpeed + player.vx,
      vy: Math.sin(player.angle)*bulletSpeed + player.vy,
      owner: "player",
      life: 60
    });
    player.ammo.bullets--;
    player.bulletCooldown = 10;
  }
  if (player.bulletCooldown > 0) player.bulletCooldown--;

  // Deploy flares
  if (keys["h"] && player.flareCooldown === 0) {
    flares.push({
      x: player.x,
      y: player.y,
      vx: -Math.cos(player.angle)*2,
      vy: -Math.sin(player.angle)*2,
      life: 120,
      trailCooldown: 0
    });
    player.flareCooldown = 120;
  }
  if (player.flareCooldown > 0) player.flareCooldown--;

  // Fire missiles
  if (keys["g"] && player.ammo.missiles > 0 && player.missileCooldown === 0) {
    let bestTarget = null, bestDist = MISSILE_LOCK_RANGE;
    for (const t of opponents) {
      if (isInMissileCone(player, t)) {
        const d = distance(player, t);
        if (d < bestDist) { bestDist = d; bestTarget = t; }
      }
    }
    if (bestTarget) {
      missiles.push({
        x: player.x, y: player.y,
        speed: 6,
        vx: Math.cos(player.angle)*2 + player.vx,
        vy: Math.sin(player.angle)*2 + player.vy,
        target: bestTarget,
        owner: "player",
        life: 300
      });
      player.ammo.missiles--;
      player.missileCooldown = missileCDTime;
    }
  }
  if (player.missileCooldown > 0) player.missileCooldown--;

  // Respawn if dead
  if (player.health <= 0) {
    createExplosion(player.x, player.y, 100);
    createFloatingText("YOU DIED", player.x, player.y, "red", 24);
    initEntities();
  }
}

function updateOpponents() {
  const turnSpeed      = 0.03;
  const thrustPower    = 0.25;
  const maxSpeed       = 4;
  const bulletSpeed    = 8;
  const missileCDTime  = 100;

  for (const o of opponents) {
    // Turn toward player
    let da = angleTo(o, player) - o.angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    o.angle += clamp(da, -turnSpeed, turnSpeed);

    // Thrust & move
    o.vx += Math.cos(o.angle)*thrustPower;
    o.vy += Math.sin(o.angle)*thrustPower;
    o.vx *= 0.98; o.vy *= 0.98;
    o.x += clamp(o.vx, -maxSpeed, maxSpeed);
    o.y += clamp(o.vy, -maxSpeed, maxSpeed);
    o.x = clamp(o.x, 0, WORLD_WIDTH);
    o.y = clamp(o.y, 0, WORLD_HEIGHT);

    // Shoot bullets
    if (o.bulletCooldown <= 0 && distance(o, player) < 600 &&
        isAngleAligned(o.angle, angleTo(o, player), Math.PI/12)) {
      bullets.push({
        x: o.x + Math.cos(o.angle)*20,
        y: o.y + Math.sin(o.angle)*20,
        vx: Math.cos(o.angle)*bulletSpeed + o.vx,
        vy: Math.sin(o.angle)*bulletSpeed + o.vy,
        owner: "opponent",
        life: 60
      });
      o.bulletCooldown = 30;
    } else o.bulletCooldown--;

    // Fire missiles
    if (o.missileCooldown <= 0 && distance(o, player) < MISSILE_LOCK_RANGE &&
        isInMissileCone(o, player)) {
      missiles.push({
        x: o.x, y: o.y,
        speed: 6,
        vx: Math.cos(o.angle)*2 + o.vx,
        vy: Math.sin(o.angle)*2 + o.vy,
        target: player,
        owner: "opponent",
        life: 300
      });
      o.missileCooldown = missileCDTime;
    } else o.missileCooldown--;

    // Respawn if dead
    if (o.health <= 0) {
      createExplosion(o.x, o.y, 80);
      createFloatingText("💥 KILLED", o.x, o.y, "orange", 20);
      o.x = Math.random()*WORLD_WIDTH;
      o.y = Math.random()*WORLD_HEIGHT;
      o.vx = o.vy = 0;
      o.health = 100;
    }
  }
}

function updateAllies() {
  const turnSpeed      = 0.035;
  const thrustPower    = 0.25;
  const maxSpeed       = 4;
  const bulletSpeed    = 8;
  const missileCDTime  = 100;

  for (const a of allies) {
    // Chase or orbit player
    const dx = player.x - a.x, dy = player.y - a.y;
    let desired = Math.atan2(dy, dx);
    if (Math.hypot(dx,dy) < 250) desired += Math.PI/2;
    let da = desired - a.angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    a.angle += clamp(da, -turnSpeed, turnSpeed);

    // Thrust & move
    a.vx += Math.cos(a.angle)*thrustPower;
    a.vy += Math.sin(a.angle)*thrustPower;
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += clamp(a.vx, -maxSpeed, maxSpeed);
    a.y += clamp(a.vy, -maxSpeed, maxSpeed);
    a.x = clamp(a.x, 0, WORLD_WIDTH);
    a.y = clamp(a.y, 0, WORLD_HEIGHT);

    // Find target
    let tgt = null, minD = Infinity;
    for (const o of opponents) {
      const d = distance(a, o);
      if (d < 700 && d < minD && isInMissileCone(a, o)) {
        tgt = o; minD = d;
      }
    }

    // Shoot bullets
    if (tgt && a.bulletCooldown <= 0 &&
        isAngleAligned(a.angle, angleTo(a, tgt), Math.PI/10)) {
      bullets.push({
        x: a.x + Math.cos(a.angle)*20,
        y: a.y + Math.sin(a.angle)*20,
        vx: Math.cos(a.angle)*bulletSpeed + a.vx,
        vy: Math.sin(a.angle)*bulletSpeed + a.vy,
        owner: "ally",
        life: 60
      });
      a.bulletCooldown = 20;
    } else a.bulletCooldown--;

    // Fire missiles
    if (tgt && a.missileCooldown <= 0 && isInMissileCone(a, tgt)) {
      missiles.push({
        x: a.x, y: a.y,
        speed: 6,
        vx: Math.cos(a.angle)*2 + a.vx,
        vy: Math.sin(a.angle)*2 + a.vy,
        target: tgt,
        owner: "ally",
        life: 300
      });
      a.missileCooldown = missileCDTime;
    } else a.missileCooldown--;

    // Respawn if dead
    if (a.health <= 0) {
      createExplosion(a.x, a.y, 80);
      createFloatingText("💥 ALLY DOWN", a.x, a.y, "lightblue", 18);
      a.x = Math.random()*WORLD_WIDTH;
      a.y = Math.random()*WORLD_HEIGHT;
      a.vx = a.vy = 0;
      a.health = 100;
    }
  }
}

function updateBullets() {
  for (let i = bullets.length-1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || b.x<0||b.x>WORLD_WIDTH||b.y<0||b.y>WORLD_HEIGHT) {
      bullets.splice(i,1); continue;
    }
    const hr = 20;
    if (b.owner!=="opponent") {
      for (const o of opponents) {
        if (distance(b,o)<hr) {
          o.health -= 20;
          createExplosion(b.x,b.y,30);
          createFloatingText("-20",b.x,b.y,"red",16);
          bullets.splice(i,1);
          break;
        }
      }
    } else {
      if (distance(b,player)<hr) {
        player.health -=20;
        createExplosion(b.x,b.y,30);
        createFloatingText("-20",b.x,b.y,"white",16);
        bullets.splice(i,1);
      }
      for (const a of allies) {
        if (distance(b,a)<hr) {
          a.health -=20;
          createExplosion(b.x,b.y,30);
          createFloatingText("-20",b.x,b.y,"lightblue",16);
          bullets.splice(i,1);
          break;
        }
      }
    }
  }
}

function updateMissiles() {
  for (let i = missiles.length-1; i >= 0; i--) {
    const m = missiles[i];
    let tgt = m.target;
    // flare diversion
    for (const f of flares) {
      if (distance(m,f)<150 && Math.random()<0.2) { tgt = f; break; }
    }
    if (tgt) {
      const ang = angleTo(m,tgt);
      m.vx = Math.cos(ang)*m.speed; 
      m.vy = Math.sin(ang)*m.speed;
    }
    m.x += m.vx; m.y += m.vy; m.life--;
    if (m.life<=0||m.x<0||m.x>WORLD_WIDTH||m.y<0||m.y>WORLD_HEIGHT) {
      createExplosion(m.x,m.y,40);
      missiles.splice(i,1); continue;
    }
    const hr = 25;
    if (m.owner!=="opponent" && m.target && opponents.includes(m.target) && distance(m,m.target)<hr) {
      m.target.health -= 50;
      createExplosion(m.x,m.y,50);
      createFloatingText("-50",m.x,m.y,"red",18);
      missiles.splice(i,1); continue;
    }
    if (m.owner==="opponent" && distance(m,player)<hr) {
      player.health -=50;
      createExplosion(m.x,m.y,50);
      createFloatingText("-50",m.x,m.y,"white",18);
      missiles.splice(i,1); continue;
    }
  }
}

function updateFlares() {
  for (let i = flares.length-1; i >= 0; i--) {
    const f = flares[i];
    f.x += f.vx; f.y += f.vy; f.life--;
    if (f.trailCooldown===undefined) f.trailCooldown = 0;
    if (--f.trailCooldown <= 0) {
      createFloatingText("✦", f.x, f.y, "orange", 10);
      f.trailCooldown = 4;
    }
    if (f.life <= 0) flares.splice(i,1);
  }
}

function updateExplosions() {
  for (let i = explosions.length-1; i >= 0; i--) {
    const e = explosions[i];
    e.frame = (e.frame||0) + 1;
    e.size *= 0.95;
    if (e.frame > 30 || e.size < 5) explosions.splice(i,1);
  }
}

function updateFloatingTexts() {
  for (let i = floatingTexts.length-1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y += t.dy;
    if (--t.life <= 0) floatingTexts.splice(i,1);
  }
}

// ==================== EFFECTS & FEEDBACK ====================
function createExplosion(x, y, size=50) {
  explosions.push({ x, y, size, frame:0 });
}

function createFloatingText(text, x, y, color="white", size=16) {
  floatingTexts.push({ text, x, y, color, size, life:60, dy:-0.5 });
}

// ==================== RENDERING ====================
function renderScene() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawMap();
    drawEntities();
    drawEffects();
  ctx.restore();
  drawUI();
}

// ==================== DRAW HELPERS ====================
function drawMap() {
  ctx.fillStyle = "#001d3d";
  ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  ctx.strokeStyle = "#0a2a43"; ctx.lineWidth=1;
  const gs = 200;
  for (let x=0; x<=WORLD_WIDTH; x+=gs) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD_HEIGHT); ctx.stroke();
  }
  for (let y=0; y<=WORLD_HEIGHT; y+=gs) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD_WIDTH,y); ctx.stroke();
  }
}

function drawEntities() {
  // planes
  drawPlane(player,"cyan");
  allies.forEach(a=>drawPlane(a,"green"));
  opponents.forEach(o=>drawPlane(o,"red"));
  // bullets
  ctx.fillStyle="white";
  bullets.forEach(b=>{
    ctx.beginPath(); ctx.arc(b.x,b.y,2,0,2*Math.PI); ctx.fill();
  });
  // missiles
  ctx.fillStyle="orange";
  missiles.forEach(m=>{
    ctx.beginPath(); ctx.arc(m.x,m.y,4,0,2*Math.PI); ctx.fill();
  });
  // flares
  ctx.fillStyle="yellow";
  flares.forEach(f=>{
    ctx.beginPath(); ctx.arc(f.x,f.y,3,0,2*Math.PI); ctx.fill();
  });
}

function drawPlane(p, color) {
  ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = color;
    ctx.beginPath();
      ctx.moveTo(10,0);
      ctx.lineTo(-10,-6);
      ctx.lineTo(-8,0);
      ctx.lineTo(-10,6);
    ctx.closePath();
    ctx.fill();
  ctx.restore();
}

function drawEffects() {
  // explosions
  explosions.forEach(e=>{
    const alpha = Math.max(0,1 - e.frame/30);
    ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(e.x,e.y,e.size,0,2*Math.PI);
      ctx.fill();
    ctx.restore();
  });
  // floating text
  floatingTexts.forEach(t=>{
    const alpha = t.life/60;
    ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `${t.size}px Arial`;
      ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  });
}

function drawUI() {
  ctx.save();
    ctx.fillStyle="white"; ctx.font="16px Arial";
    // health bar
    const bw=200, bh=20;
    const hp = clamp(player.health/100,0,1);
    ctx.fillStyle="gray"; ctx.fillRect(20,20,bw,bh);
    ctx.fillStyle = hp>0.5 ? "limegreen" : hp>0.25 ? "orange" : "red";
    ctx.fillRect(20,20,bw*hp,bh);
    ctx.strokeStyle="white"; ctx.strokeRect(20,20,bw,bh);
    ctx.fillText(`Health: ${Math.round(player.health)}`, 20, 55);
    // speed
    const sp = Math.round(Math.hypot(player.vx,player.vy));
    ctx.fillText(`Speed: ${sp} px/s`, 20, 80);
    // ammo
    ctx.fillText(`Bullets: ${player.ammo.bullets}`, 20, 105);
    ctx.fillText(`Missiles: ${player.ammo.missiles}`, 20, 130);
    ctx.fillText(`Score: ${player.score}`, 20, 155);
  ctx.restore();
}

// ==================== GAME LOOP & INIT ====================
function gameLoop() {
  updatePlayer();
  updateOpponents();
  updateAllies();
  updateBullets();
  updateMissiles();
  updateFlares();
  updateExplosions();
  updateFloatingTexts();

  camera.x = clamp(player.x - camera.width/2, 0, WORLD_WIDTH - camera.width);
  camera.y = clamp(player.y - camera.height/2,0, WORLD_HEIGHT - camera.height);

  renderScene();
  requestAnimationFrame(gameLoop);
}

function init() {
  initEntities();
  gameLoop();
}

init();
