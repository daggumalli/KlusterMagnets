# Kluster MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable 2-level magnetic dexterity game with dipole physics, photorealistic Canvas 2D visuals, procedural audio, haptics, and AI opponent.

**Architecture:** Modular vanilla JS with 9 files — config, physics, renderer, audio, haptics, AI, game logic, UI, and app bootstrap. Single HTML page with a full-screen Canvas. Responsive scaling for mobile/desktop/any orientation.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 Canvas 2D, Web Audio API, Capacitor (iOS/Android), no frameworks or build tools.

**Design Doc:** `docs/plans/2026-03-14-kluster-mvp-design.md`

**GDD:** `Kluster_Game_Design_Document.docx`

---

### Task 1: Project Scaffold & Config

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/config.js`
- Create: `js/app.js`

**Step 1: Create directory structure**

Run: `mkdir -p css js icons`

**Step 2: Create `js/config.js`**

All game constants, level parameters, and thresholds. This is the single source of truth for tuning.

```javascript
"use strict";

const CONFIG = {
  // Magnet physical properties
  MAGNET_RADIUS: 18,
  CLUSTER_THRESHOLD_FACTOR: 2.1, // cluster when distance < this * MAGNET_RADIUS
  SETTLE_VELOCITY_THRESHOLD: 0.1, // px/tick — settled when max vel below this
  SETTLE_TIMEOUT_MS: 8000, // max time to wait for settling

  // Physics timestep
  PHYSICS_DT: 1 / 60,
  SLOW_MOTION_FACTOR: 0.5, // post-placement settle speed

  // Placement
  PLACEMENT_VIBRATION_IMPULSE: 0.3, // radial impulse on placement "thud"

  // Visual
  ARENA_PADDING: 40, // px padding around arena
  FIELD_OPACITY_MIN: 0.03,
  FIELD_OPACITY_MAX: 0.05,
  FIELD_PULSE_SPEED: 0.002,

  // Danger meter
  DANGER_PULSE_MIN_HZ: 1,
  DANGER_PULSE_MAX_HZ: 12,

  // Cluster animation
  CLUSTER_FLASH_DURATION: 800, // ms
  SCREEN_SHAKE_AMPLITUDE: 2, // px
  SCREEN_SHAKE_DURATION: 200, // ms

  // Colors
  PLAYER_COLOR: { base: "#C0392B", light: "#E74C3C", dark: "#922B21" },
  AI_COLOR: { base: "#2471A3", light: "#3498DB", dark: "#1A5276" },
  ROPE_COLOR: { base: "#D4A84B", light: "#F0C75E", dark: "#B8860B" },
  TABLE_COLOR: { base: "#5D3A1A", light: "#8B6914", dark: "#3E2410" },
  FIELD_ATTRACT: "rgba(0, 200, 0, 0.04)",
  FIELD_REPEL: "rgba(200, 0, 0, 0.04)",
  CLUSTER_GLOW: "#FFD700",

  // Levels
  LEVELS: [
    {
      id: 1,
      name: "Rookie",
      description: "Learn the basics of magnetic placement",
      magnetsEach: 4,
      arenaRadius: 155,
      magneticK: 0.08,
      surfaceFriction: 0.92,
      magnetMassVariance: 0,
      surfaceImperfection: 0,
      polarityRandomization: 0,
      magneticRange: 70,
      simSteps: 120,
      aiCandidates: 52,
      aiNoise: 0.5,
      aiThinkTime: 1500,
      isTutorial: true,
    },
    {
      id: 2,
      name: "Novice",
      description: "Stronger pull, smarter opponent",
      magnetsEach: 5,
      arenaRadius: 145,
      magneticK: 0.12,
      surfaceFriction: 0.90,
      magnetMassVariance: 0.05,
      surfaceImperfection: 0.2,
      polarityRandomization: 0.15, // radians — slight tilt
      magneticRange: 78,
      simSteps: 140,
      aiCandidates: 58,
      aiNoise: 0.4,
      aiThinkTime: 1200,
      isTutorial: false,
    },
  ],

  // Game states
  STATES: {
    MENU: "MENU",
    LEVEL_SELECT: "LEVEL_SELECT",
    GAME_INIT: "GAME_INIT",
    PLAYER_TURN: "PLAYER_TURN",
    PLACING: "PLACING",
    SETTLING: "SETTLING",
    CLUSTER_CHECK: "CLUSTER_CHECK",
    CLUSTER_ANIM: "CLUSTER_ANIM",
    AI_TURN: "AI_TURN",
    AI_THINKING: "AI_THINKING",
    AI_PLACING: "AI_PLACING",
    WIN: "WIN",
    LOSE: "LOSE",
    GAME_OVER: "GAME_OVER",
  },
};
```

**Step 3: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#3E2410">
  <title>KLUSTER</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="manifest" href="manifest.json">
</head>
<body>
  <canvas id="gameCanvas"></canvas>

  <script src="js/config.js"></script>
  <script src="js/physics.js"></script>
  <script src="js/renderer.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/haptics.js"></script>
  <script src="js/ai.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/game.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

**Step 4: Create `css/style.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #3E2410;
  touch-action: none;
}

#gameCanvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

**Step 5: Create `js/app.js`**

```javascript
"use strict";

(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Responsive canvas sizing
  let W, H, sc, centerX, centerY;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    centerX = W / 2;
    centerY = H / 2;
    // Scale factor: arena should fit comfortably
    sc = Math.min(W, H) / 420;
  }

  window.addEventListener("resize", resize);
  resize();

  // Expose globals for other modules
  window.KLUSTER = {
    canvas, ctx, getW: () => W, getH: () => H, getSc: () => sc,
    getCenterX: () => centerX, getCenterY: () => centerY,
  };

  // Game loop
  let lastTime = 0;
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (window.Game) {
      Game.update(dt);
      Game.render(ctx, W, H, sc);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
```

**Step 6: Verify scaffold loads**

Run: Open `index.html` in browser (or `npx serve .`) — should show dark brown screen with no errors in console.

**Step 7: Commit**

```bash
git init
git add index.html css/style.css js/config.js js/app.js
git commit -m "feat: project scaffold with config and responsive canvas bootstrap"
```

---

### Task 2: Physics Engine — Dipole Force Calculations

**Files:**
- Create: `js/physics.js`

**Step 1: Create `js/physics.js` with Perlin noise and dipole model**

```javascript
"use strict";

const Physics = (function () {
  // --- Perlin Noise (simplified 2D) ---
  const permutation = new Uint8Array(512);
  function initPerlin(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with seed
    let s = seed || 0;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) permutation[i] = p[i & 255];
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }

  const grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  function dot2(gi, x, y) { const g = grad2[gi % 8]; return g[0] * x + g[1] * y; }

  function perlin2(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = permutation[permutation[xi] + yi];
    const ab = permutation[permutation[xi] + yi + 1];
    const ba = permutation[permutation[xi + 1] + yi];
    const bb = permutation[permutation[xi + 1] + yi + 1];
    return lerp(
      lerp(dot2(aa, xf, yf), dot2(ba, xf - 1, yf), u),
      lerp(dot2(ab, xf, yf - 1), dot2(bb, xf - 1, yf - 1), u),
      v
    );
  }

  // --- Magnet Factory ---
  function createMagnet(id, team, x, y, theta, strength) {
    return {
      id, team,
      x, y,
      prevX: x, prevY: y, // Verlet previous positions
      vx: 0, vy: 0,
      theta: theta || 0, // orientation angle
      omega: 0, // angular velocity
      strength: strength || 1.0,
      state: "in-hand", // in-hand | placed | clustered
      clusterGroup: -1,
    };
  }

  // --- Dipole Force Calculations ---
  function calculateDipoleForces(magnetA, magnetB, k) {
    const dx = magnetB.x - magnetA.x;
    const dy = magnetB.y - magnetA.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 1) return { fx: 0, fy: 0, torqueA: 0, torqueB: 0 };

    const alpha = Math.atan2(dy, dx);
    const r3 = dist * dist * dist;
    const kAB = k * magnetA.strength * magnetB.strength;

    const thetaA = magnetA.theta;
    const thetaB = magnetB.theta;

    // GDD force equations
    const fRadial = kAB * (3 * Math.cos(thetaA - alpha) * Math.cos(thetaB - alpha) - Math.cos(thetaA - thetaB)) / r3;
    const fTangential = kAB * Math.sin(thetaA - thetaB - 2 * alpha) / r3;

    // Convert radial/tangential to cartesian
    const cosA = Math.cos(alpha);
    const sinA = Math.sin(alpha);
    const fx = fRadial * cosA - fTangential * sinA;
    const fy = fRadial * sinA + fTangential * cosA;

    // Torque on each magnet
    const torqueA = kAB * Math.sin(thetaA - thetaB) / r3;
    const torqueB = -torqueA; // equal and opposite

    return { fx, fy, torqueA, torqueB, dist };
  }

  // --- Friction from Perlin noise surface ---
  function getSurfaceFriction(x, y, baseFriction, imperfection) {
    if (imperfection <= 0) return baseFriction;
    const noise = perlin2(x * 0.02, y * 0.02); // -1 to 1
    return baseFriction + noise * imperfection * 0.05;
  }

  // --- Physics Step (Verlet Integration) ---
  function step(magnets, levelConfig, arenaCenter, dt) {
    const placed = magnets.filter(m => m.state === "placed");
    const k = levelConfig.magneticK;
    const range = levelConfig.magneticRange;
    const baseFriction = levelConfig.surfaceFriction;
    const imperfection = levelConfig.surfaceImperfection;

    // Accumulate forces
    const forces = placed.map(() => ({ fx: 0, fy: 0, torque: 0 }));

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dx = placed[j].x - placed[i].x;
        const dy = placed[j].y - placed[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > range) continue;

        const result = calculateDipoleForces(placed[i], placed[j], k);
        forces[i].fx += result.fx;
        forces[i].fy += result.fy;
        forces[i].torque += result.torqueA;
        forces[j].fx -= result.fx;
        forces[j].fy -= result.fy;
        forces[j].torque += result.torqueB;
      }
    }

    // Integrate (Verlet)
    let maxVel = 0;
    for (let i = 0; i < placed.length; i++) {
      const m = placed[i];
      const friction = getSurfaceFriction(m.x, m.y, baseFriction, imperfection);

      // Verlet position integration
      const newX = 2 * m.x - m.prevX + forces[i].fx * dt * dt;
      const newY = 2 * m.y - m.prevY + forces[i].fy * dt * dt;

      m.vx = (newX - m.x) * friction;
      m.vy = (newY - m.y) * friction;

      m.prevX = m.x;
      m.prevY = m.y;
      m.x = m.x + m.vx;
      m.y = m.y + m.vy;

      // Angular integration
      m.omega = (m.omega + forces[i].torque * dt) * friction;
      m.theta += m.omega;

      // Arena boundary collision
      const dxC = m.x - arenaCenter.x;
      const dyC = m.y - arenaCenter.y;
      const distFromCenter = Math.sqrt(dxC * dxC + dyC * dyC);
      const maxDist = levelConfig.arenaRadius - CONFIG.MAGNET_RADIUS;

      if (distFromCenter > maxDist && maxDist > 0) {
        const nx = dxC / distFromCenter;
        const ny = dyC / distFromCenter;
        m.x = arenaCenter.x + nx * maxDist;
        m.y = arenaCenter.y + ny * maxDist;
        // Reflect velocity
        const dot = m.vx * nx + m.vy * ny;
        m.vx -= 2 * dot * nx * 0.5; // damping
        m.vy -= 2 * dot * ny * 0.5;
        m.prevX = m.x - m.vx;
        m.prevY = m.y - m.vy;
      }

      // Magnet-magnet overlap resolution
      for (let j = i + 1; j < placed.length; j++) {
        const other = placed[j];
        const odx = other.x - m.x;
        const ody = other.y - m.y;
        const oDist = Math.sqrt(odx * odx + ody * ody);
        const minDist = CONFIG.MAGNET_RADIUS * 2;
        if (oDist < minDist && oDist > 0) {
          const overlap = (minDist - oDist) / 2;
          const onx = odx / oDist;
          const ony = ody / oDist;
          m.x -= onx * overlap;
          m.y -= ony * overlap;
          other.x += onx * overlap;
          other.y += ony * overlap;
          m.prevX = m.x - m.vx;
          m.prevY = m.y - m.vy;
          other.prevX = other.x - other.vx;
          other.prevY = other.y - other.vy;
        }
      }

      const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (speed > maxVel) maxVel = speed;
    }

    return maxVel;
  }

  // --- Cluster Detection (Union-Find) ---
  function findClusters(magnets, levelConfig) {
    const placed = magnets.filter(m => m.state === "placed");
    const threshold = CONFIG.MAGNET_RADIUS * CONFIG.CLUSTER_THRESHOLD_FACTOR;
    const parent = new Map();
    const rank = new Map();

    function find(id) {
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)));
      return parent.get(id);
    }

    function union(a, b) {
      const ra = find(a), rb = find(b);
      if (ra === rb) return;
      if (rank.get(ra) < rank.get(rb)) parent.set(ra, rb);
      else if (rank.get(ra) > rank.get(rb)) parent.set(rb, ra);
      else { parent.set(rb, ra); rank.set(ra, rank.get(ra) + 1); }
    }

    for (const m of placed) {
      parent.set(m.id, m.id);
      rank.set(m.id, 0);
    }

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dx = placed[j].x - placed[i].x;
        const dy = placed[j].y - placed[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < threshold) {
          union(placed[i].id, placed[j].id);
        }
      }
    }

    // Group by root
    const groups = new Map();
    for (const m of placed) {
      const root = find(m.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(m);
    }

    // Return only groups with 2+ magnets (actual clusters)
    const clusters = [];
    for (const [, group] of groups) {
      if (group.length >= 2) clusters.push(group);
    }
    return clusters;
  }

  // --- Table Vibration Impulse ---
  function applyPlacementImpulse(magnets, placedX, placedY, levelConfig) {
    const placed = magnets.filter(m => m.state === "placed");
    for (const m of placed) {
      if (m.x === placedX && m.y === placedY) continue;
      const dx = m.x - placedX;
      const dy = m.y - placedY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0 && dist < levelConfig.arenaRadius) {
        const impulse = CONFIG.PLACEMENT_VIBRATION_IMPULSE / (dist * 0.1 + 1);
        const nx = dx / dist;
        const ny = dy / dist;
        m.vx += nx * impulse;
        m.vy += ny * impulse;
        m.prevX = m.x - m.vx;
        m.prevY = m.y - m.vy;
      }
    }
  }

  // --- Get force at a point (for haptics/danger meter) ---
  function getForceAtPoint(x, y, magnets, levelConfig) {
    let totalForce = 0;
    const placed = magnets.filter(m => m.state === "placed");
    const k = levelConfig.magneticK;

    for (const m of placed) {
      const dx = x - m.x;
      const dy = y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) { totalForce = Infinity; break; }
      totalForce += k * m.strength / (dist * dist * dist);
    }
    return totalForce;
  }

  // --- Check if position is inside arena ---
  function isInsideArena(x, y, arenaCenter, arenaRadius) {
    const dx = x - arenaCenter.x;
    const dy = y - arenaCenter.y;
    return Math.sqrt(dx * dx + dy * dy) + CONFIG.MAGNET_RADIUS <= arenaRadius;
  }

  // Public API
  return {
    initPerlin,
    createMagnet,
    calculateDipoleForces,
    step,
    findClusters,
    applyPlacementImpulse,
    getForceAtPoint,
    isInsideArena,
    perlin2,
  };
})();
```

**Step 2: Verify physics loads without errors**

Open in browser, check console for no syntax errors.

**Step 3: Commit**

```bash
git add js/physics.js
git commit -m "feat: magnetic dipole physics engine with Verlet integration, Perlin friction, cluster detection"
```

---

### Task 3: Photorealistic Renderer

**Files:**
- Create: `js/renderer.js`

**Step 1: Create `js/renderer.js`**

```javascript
"use strict";

const Renderer = (function () {
  // Pre-generated wood grain pattern (cached as offscreen canvas)
  let woodPattern = null;
  let woodPatternSize = 0;

  function generateWoodGrain(size) {
    if (woodPattern && woodPatternSize === size) return woodPattern;
    woodPatternSize = size;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");

    // Base walnut color
    ctx.fillStyle = "#5D3A1A";
    ctx.fillRect(0, 0, size, size);

    // Wood grain lines
    for (let i = 0; i < 80; i++) {
      const y = Math.random() * size;
      const thickness = 0.5 + Math.random() * 2;
      const alpha = 0.03 + Math.random() * 0.08;
      const dark = Math.random() > 0.5;
      ctx.strokeStyle = dark ? `rgba(30,15,5,${alpha})` : `rgba(120,80,30,${alpha})`;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(0, y);
      // Wavy grain
      for (let x = 0; x < size; x += 10) {
        const yOff = Math.sin(x * 0.01 + i) * 3 + Math.sin(x * 0.03 + i * 2) * 1.5;
        ctx.lineTo(x, y + yOff);
      }
      ctx.stroke();
    }

    // Knots (subtle dark ellipses)
    for (let i = 0; i < 3; i++) {
      const kx = Math.random() * size;
      const ky = Math.random() * size;
      const rx = 8 + Math.random() * 15;
      const ry = 4 + Math.random() * 8;
      const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, rx);
      grad.addColorStop(0, "rgba(40,20,5,0.15)");
      grad.addColorStop(1, "rgba(40,20,5,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    woodPattern = c;
    return c;
  }

  // --- Draw Table ---
  function drawTable(ctx, W, H) {
    // Wood grain tiled background
    const wood = generateWoodGrain(512);
    const pat = ctx.createPattern(wood, "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);

    // Radial lighting — bright center, dark edges
    const cx = W / 2, cy = H / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    const lightGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    lightGrad.addColorStop(0, "rgba(255,220,160,0.12)");
    lightGrad.addColorStop(0.4, "rgba(255,200,120,0.05)");
    lightGrad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Draw Rope ---
  function drawRope(ctx, cx, cy, radius, sc) {
    const ropeWidth = 6 * sc;

    // Shadow
    ctx.beginPath();
    ctx.arc(cx, cy, radius * sc + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = ropeWidth + 4;
    ctx.stroke();

    // Rope body — golden cord
    ctx.beginPath();
    ctx.arc(cx, cy, radius * sc, 0, Math.PI * 2);

    // 3D braided shading
    const ropeGrad = ctx.createLinearGradient(cx - radius * sc, cy - radius * sc, cx + radius * sc, cy + radius * sc);
    ropeGrad.addColorStop(0, CONFIG.ROPE_COLOR.light);
    ropeGrad.addColorStop(0.3, CONFIG.ROPE_COLOR.base);
    ropeGrad.addColorStop(0.7, CONFIG.ROPE_COLOR.dark);
    ropeGrad.addColorStop(1, CONFIG.ROPE_COLOR.light);
    ctx.strokeStyle = ropeGrad;
    ctx.lineWidth = ropeWidth;
    ctx.stroke();

    // Highlight line on top edge
    ctx.beginPath();
    ctx.arc(cx, cy, radius * sc - ropeWidth * 0.2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,240,200,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // --- Draw Magnet ---
  function drawMagnet(ctx, magnet, cx, cy, sc, time, isGhost, dangerLevel) {
    const x = cx + magnet.x * sc;
    const y = cy + magnet.y * sc;
    const r = CONFIG.MAGNET_RADIUS * sc;
    const colors = magnet.team === "player" ? CONFIG.PLAYER_COLOR : CONFIG.AI_COLOR;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(magnet.theta);

    const alpha = isGhost ? 0.4 : 1.0;
    ctx.globalAlpha = alpha;

    // Drop shadow
    if (!isGhost) {
      ctx.beginPath();
      ctx.arc(2 * sc, 3 * sc, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
    }

    // Base — metallic radial gradient
    const baseGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    baseGrad.addColorStop(0, colors.light);
    baseGrad.addColorStop(0.6, colors.base);
    baseGrad.addColorStop(1, colors.dark);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = baseGrad;
    ctx.fill();

    // Inner ring bevel
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,0.08)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Specular highlight — white ellipse top-left
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();

    // 3D depth edge (bottom-right darker arc)
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0.3, Math.PI * 1.2);
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 2 * sc;
    ctx.stroke();

    // Polarity indicator — subtle N/S dots
    const poleR = r * 0.12;
    // North (lighter dot at top of orientation)
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, poleR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
    // South (darker dot at bottom)
    ctx.beginPath();
    ctx.arc(0, r * 0.5, poleR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.restore();

    // Danger glow when ghost is in danger zone
    if (isGhost && dangerLevel > 0) {
      ctx.save();
      const pulseAlpha = 0.1 + dangerLevel * 0.3 * (0.5 + 0.5 * Math.sin(time * dangerLevel * 20));
      ctx.beginPath();
      ctx.arc(x, y, r + 5 * sc, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,50,50,${pulseAlpha})`;
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Draw Magnetic Field Lines ---
  function drawFieldLines(ctx, magnets, cx, cy, sc, time) {
    const placed = magnets.filter(m => m.state === "placed");
    for (const m of placed) {
      const x = cx + m.x * sc;
      const y = cy + m.y * sc;
      const r = CONFIG.MAGNET_RADIUS * sc;
      const fieldR = r * 4;
      const pulse = CONFIG.FIELD_OPACITY_MIN +
        (CONFIG.FIELD_OPACITY_MAX - CONFIG.FIELD_OPACITY_MIN) *
        (0.5 + 0.5 * Math.sin(time * CONFIG.FIELD_PULSE_SPEED * 1000 + m.id));

      const grad = ctx.createRadialGradient(x, y, r, x, y, fieldR);
      grad.addColorStop(0, `rgba(100,180,255,${pulse})`);
      grad.addColorStop(1, `rgba(100,180,255,0)`);
      ctx.beginPath();
      ctx.arc(x, y, fieldR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // --- Draw Cluster Effect ---
  function drawClusterEffect(ctx, cluster, cx, cy, sc, progress) {
    for (const m of cluster) {
      const x = cx + m.x * sc;
      const y = cy + m.y * sc;
      const r = CONFIG.MAGNET_RADIUS * sc;

      // Yellow warning glow
      const glowAlpha = 0.6 * (1 - progress);
      ctx.beginPath();
      ctx.arc(x, y, r + 8 * sc, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,215,0,${glowAlpha})`;
      ctx.fill();

      // Spark particles
      const numSparks = 8;
      for (let i = 0; i < numSparks; i++) {
        const angle = (i / numSparks) * Math.PI * 2 + progress * 2;
        const dist = r + progress * 40 * sc;
        const sparkX = x + Math.cos(angle) * dist;
        const sparkY = y + Math.sin(angle) * dist;
        const sparkR = (2 + Math.random() * 2) * sc * (1 - progress);
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,50,${1 - progress})`;
        ctx.fill();
      }
    }
  }

  // --- Draw Danger Meter ---
  function drawDangerMeter(ctx, dangerLevel, cx, cy, arenaRadius, sc, time) {
    if (dangerLevel <= 0) return;
    const meterW = 120 * sc;
    const meterH = 8 * sc;
    const meterX = cx - meterW / 2;
    const meterY = cy + arenaRadius * sc + 20 * sc;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(meterX, meterY, meterW, meterH, 4 * sc);
    ctx.fill();

    // Danger fill
    const fillW = meterW * Math.min(dangerLevel, 1);
    const pulse = 0.7 + 0.3 * Math.sin(time * dangerLevel * 15);
    const r = Math.floor(255 * pulse);
    const g = Math.floor(100 * (1 - dangerLevel));
    ctx.fillStyle = `rgb(${r},${g},0)`;
    ctx.beginPath();
    ctx.roundRect(meterX, meterY, fillW, meterH, 4 * sc);
    ctx.fill();
  }

  // --- Draw AI Thinking Dots ---
  function drawAIThinkingDots(ctx, candidates, cx, cy, sc, progress) {
    if (!candidates || candidates.length === 0) return;
    // Show a few "consideration" dots that fade in/out
    const showCount = Math.min(5, Math.floor(progress * candidates.length));
    for (let i = 0; i < showCount; i++) {
      const c = candidates[i];
      const x = cx + c.x * sc;
      const y = cy + c.y * sc;
      const alpha = 0.3 * (1 - i / showCount) * (0.5 + 0.5 * Math.sin(progress * 10 + i));
      ctx.beginPath();
      ctx.arc(x, y, 4 * sc, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(52,152,219,${alpha})`;
      ctx.fill();
    }
  }

  // --- Screen Shake ---
  let shakeX = 0, shakeY = 0, shakeEnd = 0;

  function triggerShake(time) {
    shakeEnd = time + CONFIG.SCREEN_SHAKE_DURATION;
  }

  function getShakeOffset(time) {
    if (time < shakeEnd) {
      const intensity = (shakeEnd - time) / CONFIG.SCREEN_SHAKE_DURATION;
      shakeX = (Math.random() - 0.5) * CONFIG.SCREEN_SHAKE_AMPLITUDE * 2 * intensity;
      shakeY = (Math.random() - 0.5) * CONFIG.SCREEN_SHAKE_AMPLITUDE * 2 * intensity;
    } else {
      shakeX = 0;
      shakeY = 0;
    }
    return { x: shakeX, y: shakeY };
  }

  return {
    generateWoodGrain,
    drawTable,
    drawRope,
    drawMagnet,
    drawFieldLines,
    drawClusterEffect,
    drawDangerMeter,
    drawAIThinkingDots,
    triggerShake,
    getShakeOffset,
  };
})();
```

**Step 2: Verify renderer loads without errors**

Open in browser, check console.

**Step 3: Commit**

```bash
git add js/renderer.js
git commit -m "feat: photorealistic Canvas 2D renderer with wood grain, rope, magnets, fields, particles"
```

---

### Task 4: Audio System

**Files:**
- Create: `js/audio.js`

**Step 1: Create `js/audio.js`**

```javascript
"use strict";

const Audio = (function () {
  let actx = null;
  let unlocked = false;

  function init() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Unlock audio on iOS (must be called from user gesture)
  function unlock() {
    if (unlocked || !actx) return;
    const buf = actx.createBuffer(1, 1, 22050);
    const src = actx.createBufferSource();
    src.buffer = buf;
    src.connect(actx.destination);
    src.start(0);
    if (actx.state === "suspended") actx.resume();
    unlocked = true;
  }

  function now() { return actx ? actx.currentTime : 0; }

  // --- Noise buffer (cached) ---
  let noiseBuffer = null;
  function getNoiseBuffer(duration) {
    if (noiseBuffer) return noiseBuffer;
    const len = Math.floor(actx.sampleRate * (duration || 2));
    noiseBuffer = actx.createBuffer(1, len, actx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // --- Helper: play a tone ---
  function playTone(freq, type, duration, volume, startTime) {
    const t = startTime || now();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  // --- Helper: play noise burst ---
  function playNoise(duration, filterFreq, volume, startTime) {
    const t = startTime || now();
    const src = actx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filter = actx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq || 800, t);
    filter.Q.setValueAtTime(1.5, t);
    const gain = actx.createGain();
    gain.gain.setValueAtTime(volume || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(actx.destination);
    src.start(t);
    src.stop(t + duration);
  }

  // --- Sound Events (per GDD) ---

  // Magnet Placement: Soft wooden "tock" — 200ms
  function placement() {
    if (!actx) return;
    playNoise(0.2, 600, 0.25);
    playTone(180, "sine", 0.08, 0.1);
  }

  // Magnet Sliding: Gentle scraping hiss — variable
  let slideSrc = null;
  let slideGain = null;
  function slideStart() {
    if (!actx) return;
    slideSrc = actx.createBufferSource();
    slideSrc.buffer = getNoiseBuffer();
    slideSrc.loop = true;
    const filter = actx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2000, now());
    slideGain = actx.createGain();
    slideGain.gain.setValueAtTime(0, now());
    slideSrc.connect(filter);
    filter.connect(slideGain);
    slideGain.connect(actx.destination);
    slideSrc.start();
  }
  function slideUpdate(speed) {
    if (!slideGain) return;
    const vol = Math.min(speed * 0.5, 0.15);
    slideGain.gain.setTargetAtTime(vol, now(), 0.05);
  }
  function slideStop() {
    if (slideSrc) { try { slideSrc.stop(); } catch(e) {} slideSrc = null; }
    slideGain = null;
  }

  // Near-Miss Drift: Low resonant hum, rising pitch — variable
  function nearMiss(intensity) {
    if (!actx) return;
    const freq = 80 + intensity * 300;
    playTone(freq, "sine", 0.3, 0.08 + intensity * 0.1);
  }

  // CLUSTER!: Sharp metallic "CLACK" + glass shatter accent — 400ms
  function cluster() {
    if (!actx) return;
    playNoise(0.15, 3000, 0.4);
    playNoise(0.4, 8000, 0.15);
    playTone(800, "square", 0.05, 0.2);
    playTone(1200, "sine", 0.1, 0.15, now() + 0.05);
  }

  // Chain Reaction: Rapid succession of clicks, ascending pitch — 600ms
  function chainReaction(count) {
    if (!actx) return;
    for (let i = 0; i < Math.min(count, 6); i++) {
      const t = now() + i * 0.08;
      playTone(400 + i * 150, "sine", 0.06, 0.15, t);
      playNoise(0.04, 2000 + i * 500, 0.1, t);
    }
  }

  // Victory: Warm chime progression (C-E-G-C') — 1.2s
  function victory() {
    if (!actx) return;
    const notes = [261.6, 329.6, 392.0, 523.3]; // C4 E4 G4 C5
    notes.forEach((freq, i) => {
      playTone(freq, "sine", 0.4, 0.2, now() + i * 0.25);
      playTone(freq * 2, "sine", 0.3, 0.05, now() + i * 0.25); // harmonic
    });
  }

  // Defeat: Descending minor tones — 1.0s
  function defeat() {
    if (!actx) return;
    const notes = [392.0, 349.2, 311.1, 261.6]; // G4 F4 Eb4 C4
    notes.forEach((freq, i) => {
      playTone(freq, "sine", 0.35, 0.15, now() + i * 0.22);
    });
  }

  // AI Thinking: Subtle ticking — variable
  let thinkingInterval = null;
  function thinkingStart() {
    if (!actx) return;
    thinkingInterval = setInterval(() => {
      playTone(600 + Math.random() * 200, "sine", 0.02, 0.04);
    }, 200 + Math.random() * 100);
  }
  function thinkingStop() {
    if (thinkingInterval) { clearInterval(thinkingInterval); thinkingInterval = null; }
  }

  // Rope Ambient: Faint room tone — loop
  let ambientSrc = null;
  function ambientStart() {
    if (!actx) return;
    ambientSrc = actx.createBufferSource();
    ambientSrc.buffer = getNoiseBuffer();
    ambientSrc.loop = true;
    const filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, now());
    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.02, now());
    ambientSrc.connect(filter);
    filter.connect(gain);
    gain.connect(actx.destination);
    ambientSrc.start();
  }
  function ambientStop() {
    if (ambientSrc) { try { ambientSrc.stop(); } catch(e) {} ambientSrc = null; }
  }

  // Level Select: Satisfying mechanical "chunk" — 150ms
  function levelSelect() {
    if (!actx) return;
    playNoise(0.15, 400, 0.2);
    playTone(250, "square", 0.04, 0.15);
  }

  return {
    init, unlock,
    placement, slideStart, slideUpdate, slideStop,
    nearMiss, cluster, chainReaction,
    victory, defeat,
    thinkingStart, thinkingStop,
    ambientStart, ambientStop,
    levelSelect,
  };
})();
```

**Step 2: Commit**

```bash
git add js/audio.js
git commit -m "feat: procedural Web Audio system with all 10 GDD sound events"
```

---

### Task 5: Haptics System

**Files:**
- Create: `js/haptics.js`

**Step 1: Create `js/haptics.js`**

```javascript
"use strict";

const Haptics = (function () {
  let capacitorHaptics = null;
  let useWebVibration = false;
  let enabled = true;
  let pulseTimer = null;

  function init() {
    // Check for Capacitor Haptics plugin
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
      capacitorHaptics = window.Capacitor.Plugins.Haptics;
    } else if (navigator.vibrate) {
      useWebVibration = true;
    }
  }

  function setEnabled(val) { enabled = val; }

  function impact(style) {
    if (!enabled) return;
    if (capacitorHaptics) {
      capacitorHaptics.impact({ style: style || "Heavy" });
    } else if (useWebVibration) {
      navigator.vibrate(style === "Light" ? 10 : style === "Medium" ? 25 : 50);
    }
  }

  function vibrate(duration) {
    if (!enabled) return;
    if (capacitorHaptics) {
      capacitorHaptics.vibrate({ duration: duration || 30 });
    } else if (useWebVibration) {
      navigator.vibrate(duration || 30);
    }
  }

  // Stop any ongoing pulse
  function stopPulse() {
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
  }

  // Escalating haptic feedback based on danger zone (per GDD)
  // dangerLevel: 0 = idle, 0-0.33 = approaching, 0.33-0.66 = danger, 0.66-1.0 = critical
  function updateDragFeedback(dangerLevel) {
    if (!enabled) return;
    stopPulse();

    if (dangerLevel <= 0) {
      // Idle — no vibration
      return;
    }

    if (dangerLevel < 0.33) {
      // Approaching — gentle pulse at 2Hz, 20% amplitude
      pulseTimer = setInterval(() => vibrate(10), 500);
    } else if (dangerLevel < 0.66) {
      // Danger zone — faster pulse at 8Hz, 60% amplitude
      pulseTimer = setInterval(() => vibrate(20), 125);
    } else {
      // Critical — continuous vibration, 90% amplitude
      pulseTimer = setInterval(() => vibrate(40), 50);
    }
  }

  // CLUSTER event — single sharp heavy impact
  function clusterImpact() {
    stopPulse();
    impact("Heavy");
  }

  return {
    init,
    setEnabled,
    impact,
    vibrate,
    updateDragFeedback,
    stopPulse,
    clusterImpact,
  };
})();
```

**Step 2: Commit**

```bash
git add js/haptics.js
git commit -m "feat: haptics system with Capacitor native + Web Vibration fallback"
```

---

### Task 6: AI Opponent

**Files:**
- Create: `js/ai.js`

**Step 1: Create `js/ai.js`**

```javascript
"use strict";

const AI = (function () {
  // Generate random position inside arena
  function randomArenaPosition(arenaRadius) {
    // Uniform distribution inside circle
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (arenaRadius - CONFIG.MAGNET_RADIUS);
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }

  // Simulate placing a magnet at position and check if it causes a cluster
  function simulatePlacement(testX, testY, testTheta, magnets, levelConfig) {
    // Create a temporary magnet
    const testMagnet = Physics.createMagnet(-1, "ai", testX, testY, testTheta, 1.0);
    testMagnet.state = "placed";

    // Create a copy of placed magnets + test magnet
    const simMagnets = magnets
      .filter(m => m.state === "placed")
      .map(m => ({
        ...m,
        prevX: m.x,
        prevY: m.y,
      }));
    simMagnets.push({
      ...testMagnet,
      prevX: testX,
      prevY: testY,
    });

    // Run physics for a subset of steps to predict outcome
    const steps = Math.floor(levelConfig.simSteps / 3); // fewer steps for performance
    const arenaCenter = { x: 0, y: 0 };
    for (let i = 0; i < steps; i++) {
      Physics.step(simMagnets, levelConfig, arenaCenter, CONFIG.PHYSICS_DT);
    }

    // Check for clusters
    const clusters = Physics.findClusters(simMagnets, levelConfig);
    const causedCluster = clusters.length > 0;

    return { causedCluster, simMagnets };
  }

  // Score a safe position
  function scorePosition(x, y, magnets, levelConfig) {
    const placed = magnets.filter(m => m.state === "placed");
    let score = 0;

    // Distance from nearest magnet (higher = safer for AI)
    let minDist = Infinity;
    for (const m of placed) {
      const dx = x - m.x;
      const dy = y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }
    score += minDist * 0.5; // Safety component

    // Distance from center (closer = blocks more space for player)
    const centerDist = Math.sqrt(x * x + y * y);
    score += (levelConfig.arenaRadius - centerDist) * 0.3; // Blocking component

    // Trap potential — check if placing here creates a tight zone
    // where player's future placements are likely to cluster
    let trapScore = 0;
    for (const m of placed) {
      if (m.team === "player") continue;
      const dx = x - m.x;
      const dy = y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Magnets moderately close create trap zones between them
      if (dist > CONFIG.MAGNET_RADIUS * 3 && dist < levelConfig.magneticRange * 0.8) {
        trapScore += 1.0;
      }
    }
    score += trapScore * 0.2;

    return score;
  }

  // Main AI decision function
  function choosePosition(magnets, levelConfig) {
    const numCandidates = levelConfig.aiCandidates;
    const noise = levelConfig.aiNoise;
    const candidates = [];

    // Phase 1: Generate and test candidates
    for (let i = 0; i < numCandidates; i++) {
      const pos = randomArenaPosition(levelConfig.arenaRadius);
      const theta = levelConfig.polarityRandomization > 0
        ? (Math.random() - 0.5) * 2 * levelConfig.polarityRandomization
        : 0;

      const result = simulatePlacement(pos.x, pos.y, theta, magnets, levelConfig);

      if (!result.causedCluster) {
        const score = scorePosition(pos.x, pos.y, magnets, levelConfig);
        // Inject noise
        const noisyScore = score * (1 + (Math.random() - 0.5) * 2 * noise);
        candidates.push({ x: pos.x, y: pos.y, theta, score: noisyScore });
      }
    }

    // If all candidates cause clusters, pick the one furthest from magnets
    if (candidates.length === 0) {
      let bestPos = randomArenaPosition(levelConfig.arenaRadius);
      let bestDist = 0;
      for (let i = 0; i < 20; i++) {
        const pos = randomArenaPosition(levelConfig.arenaRadius);
        let minDist = Infinity;
        for (const m of magnets.filter(m => m.state === "placed")) {
          const dx = pos.x - m.x;
          const dy = pos.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) minDist = dist;
        }
        if (minDist > bestDist) {
          bestDist = minDist;
          bestPos = pos;
        }
      }
      return { x: bestPos.x, y: bestPos.y, theta: 0, candidates: [] };
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Return best candidate + top 5 for visualization (AI thinking dots)
    return {
      x: candidates[0].x,
      y: candidates[0].y,
      theta: candidates[0].theta,
      candidates: candidates.slice(0, 5),
    };
  }

  return {
    choosePosition,
    randomArenaPosition,
  };
})();
```

**Step 2: Commit**

```bash
git add js/ai.js
git commit -m "feat: AI opponent with Monte Carlo sampling, scoring, and noise injection"
```

---

### Task 7: UI System

**Files:**
- Create: `js/ui.js`

**Step 1: Create `js/ui.js`**

```javascript
"use strict";

const UI = (function () {
  // Layout calculations — responsive to any screen
  function getLayout(W, H, sc) {
    const isLandscape = W > H;
    const topBarH = 40;
    const scorePanelH = 60;
    const inventoryH = 30;
    const messageH = 36;
    const padding = 15;

    // Arena takes available space
    const availableH = H - topBarH - scorePanelH - inventoryH - messageH - padding * 4;
    const availableW = W - padding * 2;
    const arenaSize = Math.min(availableH, availableW) * 0.9;

    return {
      topBar: { x: 0, y: 0, w: W, h: topBarH },
      scorePanel: {
        x: W / 2 - 140, y: topBarH + padding,
        w: 280, h: scorePanelH,
      },
      message: {
        x: 0, y: topBarH + scorePanelH + padding * 2,
        w: W, h: messageH,
      },
      arena: {
        cx: W / 2,
        cy: topBarH + scorePanelH + messageH + padding * 3 + arenaSize / 2,
        size: arenaSize,
      },
      inventory: {
        x: 0, y: H - inventoryH - padding,
        w: W, h: inventoryH,
      },
      isLandscape,
    };
  }

  // --- Draw Menu Screen ---
  function drawMenu(ctx, W, H, sc, unlockedLevels) {
    // Dark walnut background
    Renderer.drawTable(ctx, W, H);

    // Darken overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);

    // Title: "KLUSTER"
    const titleSize = Math.min(W * 0.12, 64);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Gold metallic text
    const titleY = H * 0.18;
    ctx.font = `bold ${titleSize}px Georgia, serif`;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText("KLUSTER", W / 2 + 2, titleY + 2);
    // Gold gradient
    const tGrad = ctx.createLinearGradient(W / 2 - 120, titleY - 30, W / 2 + 120, titleY + 30);
    tGrad.addColorStop(0, "#D4A84B");
    tGrad.addColorStop(0.5, "#F0D78C");
    tGrad.addColorStop(1, "#B8860B");
    ctx.fillStyle = tGrad;
    ctx.fillText("KLUSTER", W / 2, titleY);

    // Gold underline
    ctx.strokeStyle = "#D4A84B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 80, titleY + titleSize * 0.6);
    ctx.lineTo(W / 2 + 80, titleY + titleSize * 0.6);
    ctx.stroke();

    // Subtitle
    ctx.font = `${Math.min(W * 0.035, 16)}px Georgia, serif`;
    ctx.fillStyle = "rgba(212,168,75,0.7)";
    ctx.fillText("MAGNETIC DEXTERITY", W / 2, titleY + titleSize * 0.6 + 20);

    // Level cards
    const cardW = Math.min(W * 0.8, 320);
    const cardH = 70;
    const cardStartY = H * 0.38;

    for (let i = 0; i < CONFIG.LEVELS.length; i++) {
      const level = CONFIG.LEVELS[i];
      const unlocked = i < unlockedLevels;
      const cy = cardStartY + i * (cardH + 12);
      const cx = W / 2 - cardW / 2;

      // Card background
      ctx.fillStyle = unlocked ? "rgba(93,58,26,0.8)" : "rgba(40,25,10,0.6)";
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 10);
      ctx.fill();

      // Border
      ctx.strokeStyle = unlocked ? "rgba(212,168,75,0.5)" : "rgba(100,70,30,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (unlocked) {
        // Gold number badge
        const badgeR = 18;
        const badgeX = cx + 30;
        const badgeY = cy + cardH / 2;
        const bGrad = ctx.createRadialGradient(badgeX, badgeY, 0, badgeX, badgeY, badgeR);
        bGrad.addColorStop(0, "#F0D78C");
        bGrad.addColorStop(1, "#B8860B");
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `bold 16px Georgia, serif`;
        ctx.fillStyle = "#3E2410";
        ctx.textAlign = "center";
        ctx.fillText(level.id, badgeX, badgeY + 1);

        // Level name and description
        ctx.textAlign = "left";
        ctx.font = `bold 18px Georgia, serif`;
        ctx.fillStyle = "#F0D78C";
        ctx.fillText(level.name, cx + 60, cy + 28);

        ctx.font = `13px Georgia, serif`;
        ctx.fillStyle = "rgba(240,215,140,0.6)";
        ctx.fillText(level.description, cx + 60, cy + 48);

        // Magnet count
        ctx.textAlign = "right";
        ctx.font = `12px Georgia, serif`;
        ctx.fillStyle = "rgba(240,215,140,0.5)";
        ctx.fillText(`${level.magnetsEach}v${level.magnetsEach}`, cx + cardW - 15, cy + 40);
      } else {
        // Locked — dimmed with lock
        ctx.textAlign = "center";
        ctx.font = `24px Georgia, serif`;
        ctx.fillStyle = "rgba(150,120,70,0.4)";
        ctx.fillText("🔒", W / 2, cy + cardH / 2 + 2);
      }
    }

    // How to Play
    ctx.textAlign = "center";
    const rulesY = H * 0.75;
    ctx.font = `bold 14px Georgia, serif`;
    ctx.fillStyle = "rgba(212,168,75,0.6)";
    ctx.fillText("HOW TO PLAY", W / 2, rulesY);

    ctx.font = `12px Georgia, serif`;
    ctx.fillStyle = "rgba(200,180,140,0.5)";
    const rules = [
      "Take turns placing magnets inside the rope.",
      "If magnets snap together on your turn, you collect them.",
      "First to place all magnets wins.",
    ];
    rules.forEach((r, i) => {
      ctx.fillText(r, W / 2, rulesY + 22 + i * 18);
    });
  }

  // --- Draw HUD (during gameplay) ---
  function drawHUD(ctx, layout, state) {
    const { topBar, scorePanel, message } = layout;

    // Top bar
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(topBar.x, topBar.y, topBar.w, topBar.h);

    ctx.textAlign = "left";
    ctx.font = "bold 16px Georgia, serif";
    ctx.fillStyle = "#D4A84B";
    ctx.fillText(state.levelName, 15, topBar.h / 2 + 1);

    // Back button
    ctx.textAlign = "right";
    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "rgba(212,168,75,0.7)";
    ctx.fillText("✕ MENU", topBar.w - 15, topBar.h / 2 + 1);

    // Score panel — two cards
    const cardW = 120;
    const gap = 20;
    const pCard = { x: scorePanel.x + scorePanel.w / 2 - cardW - gap / 2, y: scorePanel.y, w: cardW, h: scorePanel.h };
    const aCard = { x: scorePanel.x + scorePanel.w / 2 + gap / 2, y: scorePanel.y, w: cardW, h: scorePanel.h };

    // Player card
    const playerActive = state.currentTurn === "player";
    drawScoreCard(ctx, pCard, "YOU", state.playerMagnets, CONFIG.PLAYER_COLOR, playerActive);

    // AI card
    const aiActive = state.currentTurn === "ai";
    drawScoreCard(ctx, aCard, "AI", state.aiMagnets, CONFIG.AI_COLOR, aiActive);

    // Message bar
    if (state.message) {
      ctx.textAlign = "center";
      ctx.font = "bold 14px Georgia, serif";
      ctx.fillStyle = state.messageColor || "#F0D78C";
      ctx.fillText(state.message, message.w / 2, message.y + message.h / 2 + 1);
    }
  }

  function drawScoreCard(ctx, rect, label, magnets, colors, active) {
    ctx.fillStyle = active ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();

    if (active) {
      ctx.strokeStyle = colors.light;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.font = "11px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + 18);

    ctx.font = "bold 24px Georgia, serif";
    ctx.fillStyle = colors.light;
    ctx.fillText(magnets, rect.x + rect.w / 2, rect.y + 44);
  }

  // --- Draw Magnet Inventory ---
  function drawInventory(ctx, layout, playerRemaining, aiRemaining) {
    const { inventory } = layout;
    const dotR = 5;
    const gap = 14;

    // Player dots (left side)
    const pStartX = inventory.w / 2 - 10 - (playerRemaining - 1) * gap / 2;
    const dotY = inventory.y + inventory.h / 2;
    for (let i = 0; i < playerRemaining; i++) {
      ctx.beginPath();
      ctx.arc(pStartX - i * gap, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.PLAYER_COLOR.base;
      ctx.fill();
    }

    // AI dots (right side)
    const aStartX = inventory.w / 2 + 10 + (aiRemaining - 1) * gap / 2;
    for (let i = 0; i < aiRemaining; i++) {
      ctx.beginPath();
      ctx.arc(aStartX + i * gap, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.AI_COLOR.base;
      ctx.fill();
    }
  }

  // --- Draw Game Over ---
  function drawGameOver(ctx, W, H, won, time) {
    // Overlay
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, W, H);

    // Animated text
    const scale = 1 + 0.05 * Math.sin(time * 3);
    ctx.save();
    ctx.translate(W / 2, H * 0.35);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 48px Georgia, serif`;

    if (won) {
      // Green glow
      ctx.shadowColor = "#27AE60";
      ctx.shadowBlur = 30;
      ctx.fillStyle = "#2ECC71";
      ctx.fillText("YOU WIN!", 0, 0);
    } else {
      ctx.shadowColor = "#C0392B";
      ctx.shadowBlur = 30;
      ctx.fillStyle = "#E74C3C";
      ctx.fillText("AI WINS", 0, 0);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Flavor text
    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "center";
    const flavor = won ? "Next level unlocked!" : "The magnets got the best of you...";
    ctx.fillText(flavor, W / 2, H * 0.45);

    // Buttons
    const btnW = 140;
    const btnH = 44;
    const btnY = H * 0.55;
    const btnGap = 15;

    const buttons = [];

    // Retry (gold) — always shown
    buttons.push({
      id: "retry",
      x: W / 2 - (won ? btnW + btnGap / 2 : btnW / 2),
      y: btnY,
      w: btnW, h: btnH,
      label: "RETRY",
      fill: "#B8860B",
      text: "#FFF",
    });

    if (won) {
      // Next Level (green)
      buttons.push({
        id: "next",
        x: W / 2 + btnGap / 2,
        y: btnY,
        w: btnW, h: btnH,
        label: "NEXT LEVEL",
        fill: "#27AE60",
        text: "#FFF",
      });
    }

    // Menu (outlined)
    buttons.push({
      id: "menu",
      x: W / 2 - btnW / 2,
      y: btnY + btnH + 12,
      w: btnW, h: btnH,
      label: "MENU",
      fill: null,
      text: "rgba(255,255,255,0.7)",
      stroke: "rgba(255,255,255,0.3)",
    });

    for (const btn of buttons) {
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
      if (btn.fill) {
        ctx.fillStyle = btn.fill;
        ctx.fill();
      }
      if (btn.stroke) {
        ctx.strokeStyle = btn.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.font = "bold 14px Georgia, serif";
      ctx.fillStyle = btn.text;
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
    }

    return buttons; // Return for hit testing
  }

  // --- Hit test for level selection ---
  function hitTestLevelCard(x, y, W, H, unlockedLevels) {
    const cardW = Math.min(W * 0.8, 320);
    const cardH = 70;
    const cardStartY = H * 0.38;

    for (let i = 0; i < CONFIG.LEVELS.length; i++) {
      if (i >= unlockedLevels) continue;
      const cy = cardStartY + i * (cardH + 12);
      const cx = W / 2 - cardW / 2;
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
        return i;
      }
    }
    return -1;
  }

  // --- Hit test for back button ---
  function hitTestBackButton(x, y, W) {
    return x > W - 80 && y < 40;
  }

  // --- Hit test for game over buttons ---
  function hitTestGameOverButton(x, y, buttons) {
    if (!buttons) return null;
    for (const btn of buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        return btn.id;
      }
    }
    return null;
  }

  return {
    getLayout,
    drawMenu,
    drawHUD,
    drawInventory,
    drawGameOver,
    hitTestLevelCard,
    hitTestBackButton,
    hitTestGameOverButton,
  };
})();
```

**Step 2: Commit**

```bash
git add js/ui.js
git commit -m "feat: responsive UI system with menu, HUD, inventory, and game over screens"
```

---

### Task 8: Game Logic (State Machine & Turn System)

**Files:**
- Create: `js/game.js`

**Step 1: Create `js/game.js`**

This is the central controller that wires everything together — state machine, input handling, turn logic, and render orchestration.

```javascript
"use strict";

const Game = (function () {
  const S = CONFIG.STATES;

  // --- Game State ---
  let state = S.MENU;
  let currentLevel = null;
  let levelConfig = null;
  let magnets = [];
  let playerMagnets = 0;
  let aiMagnets = 0;
  let currentTurn = "player"; // "player" | "ai"
  let unlockedLevels = 1;
  let time = 0;

  // Placing state
  let dragActive = false;
  let dragX = 0, dragY = 0;
  let ghostMagnet = null;
  let dangerLevel = 0;

  // Settling state
  let settleTimer = 0;
  let settleSlowMo = true;

  // Cluster animation
  let clusterGroup = null;
  let clusterAnimStart = 0;
  let clusterOwner = null;

  // AI state
  let aiDecision = null;
  let aiThinkStart = 0;
  let aiCandidates = [];
  let aiHesitating = false;

  // Game over
  let gameOverButtons = null;
  let gameWon = false;

  // Message
  let message = "";
  let messageColor = "#F0D78C";

  // ID counter
  let nextMagnetId = 0;

  // --- Load from localStorage ---
  function loadProgress() {
    const saved = localStorage.getItem("kluster_progress");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        unlockedLevels = data.unlockedLevels || 1;
      } catch (e) { /* ignore */ }
    }
  }

  function saveProgress() {
    localStorage.setItem("kluster_progress", JSON.stringify({
      unlockedLevels,
    }));
  }

  // --- Initialize ---
  function init() {
    loadProgress();
    Audio.init();
    Haptics.init();

    // Input events
    const canvas = window.KLUSTER.canvas;

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Unlock audio on first interaction
    canvas.addEventListener("touchstart", Audio.unlock, { once: true });
    canvas.addEventListener("click", Audio.unlock, { once: true });

    Physics.initPerlin(Date.now());
  }

  // --- Coordinate conversion ---
  function screenToArena(px, py) {
    const W = KLUSTER.getW(), H = KLUSTER.getH(), sc = KLUSTER.getSc();
    const layout = UI.getLayout(W, H, sc);
    return {
      x: (px - layout.arena.cx) / sc,
      y: (py - layout.arena.cy) / sc,
    };
  }

  // --- Input Handlers ---
  function onPointerDown(e) {
    e.preventDefault();
    const px = e.clientX, py = e.clientY;
    const W = KLUSTER.getW(), H = KLUSTER.getH(), sc = KLUSTER.getSc();

    if (state === S.MENU || state === S.LEVEL_SELECT) {
      const levelIdx = UI.hitTestLevelCard(px, py, W, H, unlockedLevels);
      if (levelIdx >= 0) {
        Audio.levelSelect();
        startLevel(levelIdx);
      }
      return;
    }

    if (state === S.GAME_OVER) {
      const btnId = UI.hitTestGameOverButton(px, py, gameOverButtons);
      if (btnId === "retry") {
        Audio.levelSelect();
        startLevel(CONFIG.LEVELS.indexOf(levelConfig));
      } else if (btnId === "next") {
        Audio.levelSelect();
        const nextIdx = CONFIG.LEVELS.indexOf(levelConfig) + 1;
        if (nextIdx < CONFIG.LEVELS.length) startLevel(nextIdx);
        else { state = S.MENU; }
      } else if (btnId === "menu") {
        Audio.levelSelect();
        state = S.MENU;
      }
      return;
    }

    // Back button
    if (UI.hitTestBackButton(px, py, W)) {
      Audio.levelSelect();
      Audio.ambientStop();
      state = S.MENU;
      return;
    }

    // Player placing
    if (state === S.PLAYER_TURN && currentTurn === "player") {
      const arena = screenToArena(px, py);
      if (Physics.isInsideArena(arena.x, arena.y, { x: 0, y: 0 }, levelConfig.arenaRadius)) {
        dragActive = true;
        dragX = arena.x;
        dragY = arena.y;
        const theta = levelConfig.polarityRandomization > 0
          ? (Math.random() - 0.5) * 2 * levelConfig.polarityRandomization
          : 0;
        ghostMagnet = Physics.createMagnet(-1, "player", arena.x, arena.y, theta, 1.0);
        state = S.PLACING;
      }
    }
  }

  function onPointerMove(e) {
    if (!dragActive || state !== S.PLACING) return;
    e.preventDefault();
    const arena = screenToArena(e.clientX, e.clientY);

    // Clamp to arena
    const dist = Math.sqrt(arena.x * arena.x + arena.y * arena.y);
    const maxDist = levelConfig.arenaRadius - CONFIG.MAGNET_RADIUS;
    if (dist > maxDist) {
      arena.x = (arena.x / dist) * maxDist;
      arena.y = (arena.y / dist) * maxDist;
    }

    dragX = arena.x;
    dragY = arena.y;
    ghostMagnet.x = arena.x;
    ghostMagnet.y = arena.y;

    // Calculate danger level for haptics and visual feedback
    const force = Physics.getForceAtPoint(arena.x, arena.y, magnets, levelConfig);
    const clusterThreshold = CONFIG.MAGNET_RADIUS * CONFIG.CLUSTER_THRESHOLD_FACTOR;
    let minDist = Infinity;
    for (const m of magnets.filter(m => m.state === "placed")) {
      const dx = arena.x - m.x;
      const dy = arena.y - m.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) minDist = d;
    }

    if (minDist <= clusterThreshold) dangerLevel = 1.0;
    else if (minDist <= clusterThreshold * 1.5) dangerLevel = 0.66;
    else if (minDist <= levelConfig.magneticRange) dangerLevel = 0.33 * (1 - (minDist - clusterThreshold * 1.5) / (levelConfig.magneticRange - clusterThreshold * 1.5));
    else dangerLevel = 0;

    dangerLevel = Math.max(0, Math.min(1, dangerLevel));
    Haptics.updateDragFeedback(dangerLevel);
  }

  function onPointerUp(e) {
    if (!dragActive || state !== S.PLACING) return;
    e.preventDefault();
    dragActive = false;
    Haptics.stopPulse();

    // Place the magnet
    const id = nextMagnetId++;
    const strength = 1.0 + (Math.random() - 0.5) * 2 * levelConfig.magnetMassVariance;
    const magnet = Physics.createMagnet(id, "player", dragX, dragY, ghostMagnet.theta, strength);
    magnet.state = "placed";
    magnet.prevX = magnet.x;
    magnet.prevY = magnet.y;
    magnets.push(magnet);

    Audio.placement();
    Physics.applyPlacementImpulse(magnets, dragX, dragY, levelConfig);

    ghostMagnet = null;
    dangerLevel = 0;
    settleTimer = 0;
    settleSlowMo = true;
    clusterOwner = "player";
    state = S.SETTLING;
    Audio.slideStart();
  }

  // --- Start Level ---
  function startLevel(levelIdx) {
    levelConfig = CONFIG.LEVELS[levelIdx];
    currentLevel = levelIdx;
    magnets = [];
    nextMagnetId = 0;
    playerMagnets = levelConfig.magnetsEach;
    aiMagnets = levelConfig.magnetsEach;
    currentTurn = "player";
    message = levelConfig.isTutorial ? "Drag to place your magnet" : "Your turn!";
    messageColor = "#F0D78C";
    ghostMagnet = null;
    dangerLevel = 0;
    clusterGroup = null;
    aiDecision = null;
    gameOverButtons = null;
    state = S.PLAYER_TURN;
    Physics.initPerlin(Date.now());
    Audio.ambientStart();
  }

  // --- AI Turn ---
  function startAITurn() {
    currentTurn = "ai";
    state = S.AI_THINKING;
    aiThinkStart = time;
    aiHesitating = false;
    message = "AI is thinking...";
    messageColor = CONFIG.AI_COLOR.light;
    Audio.thinkingStart();

    // Compute decision asynchronously (via setTimeout to not block render)
    setTimeout(() => {
      aiDecision = AI.choosePosition(magnets, levelConfig);
      aiCandidates = aiDecision.candidates || [];
    }, 50);
  }

  // --- Update ---
  function update(dt) {
    time += dt;

    if (state === S.SETTLING) {
      const simDt = settleSlowMo ? CONFIG.PHYSICS_DT * CONFIG.SLOW_MOTION_FACTOR : CONFIG.PHYSICS_DT;
      const maxVel = Physics.step(magnets, levelConfig, { x: 0, y: 0 }, simDt);

      // Update slide sound
      Audio.slideUpdate(maxVel);

      settleTimer += dt * 1000;

      if (maxVel < CONFIG.SETTLE_VELOCITY_THRESHOLD || settleTimer > CONFIG.SETTLE_TIMEOUT_MS) {
        Audio.slideStop();
        state = S.CLUSTER_CHECK;
      }
    }

    if (state === S.CLUSTER_CHECK) {
      const clusters = Physics.findClusters(magnets, levelConfig);
      if (clusters.length > 0) {
        clusterGroup = clusters[0]; // Handle one cluster at a time
        clusterAnimStart = time;
        state = S.CLUSTER_ANIM;
        Audio.cluster();
        if (clusters[0].length > 2) Audio.chainReaction(clusters[0].length);
        Haptics.clusterImpact();
        Renderer.triggerShake(time * 1000);
        Audio.nearMiss(1.0);

        message = "KLUSTER!";
        messageColor = CONFIG.CLUSTER_GLOW;
      } else {
        // Check for near-miss (closest pair)
        const placed = magnets.filter(m => m.state === "placed");
        let closestDist = Infinity;
        for (let i = 0; i < placed.length; i++) {
          for (let j = i + 1; j < placed.length; j++) {
            const dx = placed[j].x - placed[i].x;
            const dy = placed[j].y - placed[i].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < closestDist) closestDist = d;
          }
        }
        const threshold = CONFIG.MAGNET_RADIUS * CONFIG.CLUSTER_THRESHOLD_FACTOR;
        if (closestDist < threshold * 1.5 && closestDist >= threshold) {
          Audio.nearMiss(1 - (closestDist - threshold) / (threshold * 0.5));
        }

        // No cluster — check win/lose, then switch turns
        finishTurn();
      }
    }

    if (state === S.CLUSTER_ANIM) {
      const elapsed = time - clusterAnimStart;
      if (elapsed > CONFIG.CLUSTER_FLASH_DURATION / 1000) {
        // Remove clustered magnets and add to current player's hand
        const clusterCount = clusterGroup.length;
        for (const m of clusterGroup) {
          m.state = "clustered";
        }
        magnets = magnets.filter(m => m.state !== "clustered");

        if (clusterOwner === "player") {
          playerMagnets += clusterCount;
        } else {
          aiMagnets += clusterCount;
        }

        clusterGroup = null;

        // Check for more clusters
        state = S.CLUSTER_CHECK;
      }
    }

    if (state === S.AI_THINKING) {
      const elapsed = time - aiThinkStart;

      // Show consideration dots
      if (aiDecision && elapsed > levelConfig.aiThinkTime / 1000 * 0.3) {
        // Hesitation behavior at higher levels
        if (!aiHesitating && levelConfig.id >= 2 && Math.random() < 0.3) {
          aiHesitating = true;
        }
      }

      if (aiDecision && elapsed > levelConfig.aiThinkTime / 1000) {
        Audio.thinkingStop();
        state = S.AI_PLACING;
        aiPlaceStart = time;
      }
    }

    if (state === S.AI_PLACING) {
      // Animate AI placement (move from edge toward target)
      const elapsed = time - aiPlaceStart;
      const placeDuration = 0.4; // seconds

      if (elapsed >= placeDuration) {
        // Place the magnet
        const id = nextMagnetId++;
        const strength = 1.0 + (Math.random() - 0.5) * 2 * levelConfig.magnetMassVariance;
        const magnet = Physics.createMagnet(id, "ai", aiDecision.x, aiDecision.y, aiDecision.theta, strength);
        magnet.state = "placed";
        magnet.prevX = magnet.x;
        magnet.prevY = magnet.y;
        magnets.push(magnet);

        Audio.placement();
        Physics.applyPlacementImpulse(magnets, aiDecision.x, aiDecision.y, levelConfig);

        aiDecision = null;
        aiCandidates = [];
        settleTimer = 0;
        settleSlowMo = true;
        clusterOwner = "ai";
        state = S.SETTLING;
        Audio.slideStart();
      }
    }
  }

  let aiPlaceStart = 0;

  function finishTurn() {
    if (currentTurn === "player") {
      playerMagnets--;
      if (playerMagnets <= 0) {
        gameWon = true;
        state = S.GAME_OVER;
        message = "";
        Audio.ambientStop();
        Audio.victory();
        // Unlock next level
        const nextLevel = currentLevel + 2; // 0-indexed + 1
        if (nextLevel > unlockedLevels) {
          unlockedLevels = nextLevel;
          saveProgress();
        }
        return;
      }
      startAITurn();
    } else {
      aiMagnets--;
      if (aiMagnets <= 0) {
        gameWon = false;
        state = S.GAME_OVER;
        message = "";
        Audio.ambientStop();
        Audio.defeat();
        return;
      }
      currentTurn = "player";
      state = S.PLAYER_TURN;
      message = "Your turn!";
      messageColor = "#F0D78C";
    }
  }

  // --- Render ---
  function render(ctx, W, H, sc) {
    const layout = UI.getLayout(W, H, sc);

    if (state === S.MENU || state === S.LEVEL_SELECT) {
      UI.drawMenu(ctx, W, H, sc, unlockedLevels);
      return;
    }

    // Screen shake
    const shake = Renderer.getShakeOffset(time * 1000);
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Table
    Renderer.drawTable(ctx, W, H);

    // Rope
    Renderer.drawRope(ctx, layout.arena.cx, layout.arena.cy, levelConfig.arenaRadius, sc);

    // Magnetic field lines
    Renderer.drawFieldLines(ctx, magnets, layout.arena.cx, layout.arena.cy, sc, time);

    // Placed magnets
    for (const m of magnets.filter(m => m.state === "placed")) {
      Renderer.drawMagnet(ctx, m, layout.arena.cx, layout.arena.cy, sc, time, false, 0);
    }

    // Ghost magnet (during drag)
    if (ghostMagnet && state === S.PLACING) {
      Renderer.drawMagnet(ctx, ghostMagnet, layout.arena.cx, layout.arena.cy, sc, time, true, dangerLevel);
    }

    // AI thinking dots
    if (state === S.AI_THINKING && aiCandidates.length > 0) {
      const progress = (time - aiThinkStart) / (levelConfig.aiThinkTime / 1000);
      Renderer.drawAIThinkingDots(ctx, aiCandidates, layout.arena.cx, layout.arena.cy, sc, progress);
    }

    // AI placing animation
    if (state === S.AI_PLACING && aiDecision) {
      const elapsed = time - aiPlaceStart;
      const progress = Math.min(elapsed / 0.4, 1);
      // Animate from above arena to target
      const startY = aiDecision.y - 50 * (1 - progress);
      const animMagnet = { ...aiDecision, y: startY, team: "ai", theta: aiDecision.theta };
      const alpha = 0.3 + progress * 0.7;
      ctx.globalAlpha = alpha;
      Renderer.drawMagnet(ctx, animMagnet, layout.arena.cx, layout.arena.cy, sc, time, false, 0);
      ctx.globalAlpha = 1;
    }

    // Cluster animation
    if (state === S.CLUSTER_ANIM && clusterGroup) {
      const elapsed = time - clusterAnimStart;
      const progress = elapsed / (CONFIG.CLUSTER_FLASH_DURATION / 1000);
      Renderer.drawClusterEffect(ctx, clusterGroup, layout.arena.cx, layout.arena.cy, sc, Math.min(progress, 1));
    }

    // Danger meter
    if (state === S.PLACING) {
      Renderer.drawDangerMeter(ctx, dangerLevel, layout.arena.cx, layout.arena.cy, levelConfig.arenaRadius, sc, time);
    }

    ctx.restore(); // End shake transform

    // HUD (not affected by shake)
    UI.drawHUD(ctx, layout, {
      levelName: `Level ${levelConfig.id}: ${levelConfig.name}`,
      playerMagnets,
      aiMagnets,
      currentTurn,
      message,
      messageColor,
    });

    UI.drawInventory(ctx, layout, playerMagnets, aiMagnets);

    // Game over overlay
    if (state === S.GAME_OVER) {
      gameOverButtons = UI.drawGameOver(ctx, W, H, gameWon, time);
    }
  }

  // Initialize on load
  init();

  return { update, render };
})();
```

**Step 2: Verify the full game loads and runs**

Run: `npx serve .` (or open `index.html` directly) — should see menu screen with Level 1 card. Clicking should start the game.

**Step 3: Commit**

```bash
git add js/game.js
git commit -m "feat: game state machine with turn logic, input handling, and render orchestration"
```

---

### Task 9: Service Worker & PWA Manifest

**Files:**
- Create: `manifest.json`
- Create: `sw.js`

**Step 1: Create `manifest.json`**

```json
{
  "name": "KLUSTER",
  "short_name": "Kluster",
  "description": "Magnetic dexterity game — Player vs AI",
  "start_url": "/index.html",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#3E2410",
  "theme_color": "#3E2410",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Create `sw.js`**

```javascript
const CACHE_NAME = "kluster-v1";
const ASSETS = [
  "/index.html",
  "/css/style.css",
  "/js/config.js",
  "/js/physics.js",
  "/js/renderer.js",
  "/js/audio.js",
  "/js/haptics.js",
  "/js/ai.js",
  "/js/ui.js",
  "/js/game.js",
  "/js/app.js",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
```

**Step 3: Register service worker in `app.js`**

Add to the bottom of `app.js` (inside the IIFE, after the game loop):

```javascript
  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
```

**Step 4: Commit**

```bash
git add manifest.json sw.js
git commit -m "feat: PWA manifest and service worker for offline support"
```

---

### Task 10: Integration Testing & Tuning

**Step 1: Test full game flow**

Open in browser. Verify:
- Menu renders with gold title, Level 1 card
- Clicking Level 1 starts game
- Dragging inside arena shows ghost magnet
- Releasing places magnet with "tock" sound
- Magnets interact via magnetic forces (drift, rotate)
- AI takes turn after player
- Cluster detection triggers when magnets snap together
- Cluster animation plays (sparks, glow, screen shake)
- Game over screen appears when a player wins/loses
- Retry/Menu buttons work

**Step 2: Mobile responsiveness test**

Open Chrome DevTools → device toolbar. Test on:
- iPhone SE (375x667)
- iPhone 14 Pro (393x852)
- iPad (768x1024)
- Galaxy S21 (360x800)
- Desktop (1920x1080)

Verify arena scales and UI elements remain readable.

**Step 3: Physics tuning**

Play Level 1 multiple times. Adjust in `config.js`:
- `magneticK` — if magnets barely interact, increase. If they snap from across the arena, decrease.
- `surfaceFriction` — if magnets slide forever, increase. If they stop instantly, decrease.
- `SETTLE_VELOCITY_THRESHOLD` — if settling takes too long, increase.

**Step 4: Commit final tuning**

```bash
git add -A
git commit -m "feat: complete Kluster MVP with 2 levels, physics, AI, audio, haptics"
```

---

## Task Dependency Graph

```
Task 1 (Scaffold) ──┬── Task 2 (Physics)
                     ├── Task 4 (Audio)
                     ├── Task 5 (Haptics)
                     │
Task 2 (Physics) ────┬── Task 3 (Renderer)
                     ├── Task 6 (AI)
                     │
Task 3 + 4 + 5 + 6 ─┬── Task 7 (UI)
                     │
Task 7 (UI) ─────────┬── Task 8 (Game Logic)
                     │
Task 8 ──────────────┬── Task 9 (PWA)
                     │
Task 9 ──────────────┬── Task 10 (Testing & Tuning)
```

**Parallelizable:** Tasks 2, 4, 5 can run in parallel after Task 1. Tasks 3 and 6 can run in parallel after Task 2.
