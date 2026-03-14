"use strict";

const Physics = (function () {
  // --- Perlin Noise (simplified 2D) ---
  const permutation = new Uint8Array(512);
  function initPerlin(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
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

  function createMagnet(id, team, x, y, theta, strength) {
    return {
      id, team, x, y, prevX: x, prevY: y,
      vx: 0, vy: 0, theta: theta || 0, omega: 0,
      strength: strength || 1.0, state: "in-hand", clusterGroup: -1,
    };
  }

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

    const fRadial = kAB * (3 * Math.cos(thetaA - alpha) * Math.cos(thetaB - alpha) - Math.cos(thetaA - thetaB)) / r3;
    const fTangential = kAB * Math.sin(thetaA - thetaB - 2 * alpha) / r3;

    const cosA = Math.cos(alpha);
    const sinA = Math.sin(alpha);
    const fx = fRadial * cosA - fTangential * sinA;
    const fy = fRadial * sinA + fTangential * cosA;

    const torqueA = kAB * Math.sin(thetaA - thetaB) / r3;
    const torqueB = -torqueA;

    return { fx, fy, torqueA, torqueB, dist };
  }

  function getSurfaceFriction(x, y, baseFriction, imperfection) {
    if (imperfection <= 0) return baseFriction;
    const noise = perlin2(x * 0.02, y * 0.02);
    return baseFriction + noise * imperfection * 0.05;
  }

  function step(magnets, levelConfig, arenaCenter, dt) {
    const placed = magnets.filter(m => m.state === "placed");
    const k = levelConfig.magneticK;
    const range = levelConfig.magneticRange;
    const baseFriction = levelConfig.surfaceFriction;
    const imperfection = levelConfig.surfaceImperfection;

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

    // dt factor for slow-motion (1.0 = normal, 0.5 = slow-mo)
    const dtScale = dt / CONFIG.PHYSICS_DT; // normalized to 1.0 at normal speed

    let maxVel = 0;
    for (let i = 0; i < placed.length; i++) {
      const m = placed[i];
      const friction = getSurfaceFriction(m.x, m.y, baseFriction, imperfection);

      // Apply forces directly as velocity changes (semi-implicit Euler)
      m.vx += forces[i].fx * dtScale;
      m.vy += forces[i].fy * dtScale;

      // Apply friction damping
      m.vx *= friction;
      m.vy *= friction;

      // Update position
      m.prevX = m.x;
      m.prevY = m.y;
      m.x += m.vx * dtScale;
      m.y += m.vy * dtScale;

      // Angular dynamics
      m.omega += forces[i].torque * dtScale;
      m.omega *= friction;
      m.theta += m.omega * dtScale;

      const dxC = m.x - arenaCenter.x;
      const dyC = m.y - arenaCenter.y;
      const distFromCenter = Math.sqrt(dxC * dxC + dyC * dyC);
      const maxDist = levelConfig.arenaRadius - CONFIG.MAGNET_RADIUS;

      if (distFromCenter > maxDist && maxDist > 0) {
        const nx = dxC / distFromCenter;
        const ny = dyC / distFromCenter;
        m.x = arenaCenter.x + nx * maxDist;
        m.y = arenaCenter.y + ny * maxDist;
        const dot = m.vx * nx + m.vy * ny;
        m.vx -= 2 * dot * nx * 0.5;
        m.vy -= 2 * dot * ny * 0.5;
        m.prevX = m.x - m.vx;
        m.prevY = m.y - m.vy;
      }

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

    const groups = new Map();
    for (const m of placed) {
      const root = find(m.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(m);
    }

    const clusters = [];
    for (const [, group] of groups) {
      if (group.length >= 2) clusters.push(group);
    }
    return clusters;
  }

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

  function isInsideArena(x, y, arenaCenter, arenaRadius) {
    const dx = x - arenaCenter.x;
    const dy = y - arenaCenter.y;
    return Math.sqrt(dx * dx + dy * dy) + CONFIG.MAGNET_RADIUS <= arenaRadius;
  }

  return {
    initPerlin, createMagnet, calculateDipoleForces, step,
    findClusters, applyPlacementImpulse, getForceAtPoint, isInsideArena, perlin2,
  };
})();
