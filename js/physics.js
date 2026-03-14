"use strict";

const Physics = (function () {
  // ================================================================
  // MAGNETIC DIPOLE PHYSICS ENGINE
  // ================================================================
  //
  // DERIVATION FROM FIRST PRINCIPLES:
  //
  // The potential energy of two magnetic dipoles μ₁ and μ₂ separated
  // by displacement vector r is (in 2D):
  //
  //   U = (k/r³) · [μ̂₁·μ̂₂ − 3(μ̂₁·r̂)(μ̂₂·r̂)]
  //
  // where μ̂ are unit vectors along each dipole's axis (angle θ),
  //       r̂ is the unit vector from dipole A to dipole B (angle α),
  //       k = μ₀·|μ₁|·|μ₂| / (4π)
  //
  // Substituting angles:
  //   U = (k/r³) · [cos(θA−θB) − 3·cos(θA−α)·cos(θB−α)]
  //
  // FORCES (F = −∇U):
  //   Radial:      F_r = (3k/r⁴) · [cos(θA−θB) − 3·cos(θA−α)·cos(θB−α)]
  //   Tangential:  F_α = (3k/r⁴) · sin(θA + θB − 2α)
  //
  //   Note: F_r > 0 = repulsion (pushes B away from A)
  //         F_r < 0 = attraction (pulls B toward A)
  //
  // TORQUES (τ = −∂U/∂θ):
  //   τ_A = (k/r³) · [sin(θA−θB) − 3·sin(θA−α)·cos(θB−α)]
  //   τ_B = (k/r³) · [sin(θB−θA) − 3·sin(θB−α)·cos(θA−α)]
  //
  // VERIFICATION:
  //   • θA=θB=0, α=0 (head-to-tail, N→S): F_r = 3k/r⁴·[1−3] = −6k/r⁴ → ATTRACT ✓
  //   • θA=0, θB=π, α=0 (head-to-head, N→N): F_r = 3k/r⁴·[−1+3] = +6k/r⁴ → REPEL ✓
  //   • θA=θB=0, α=π/2 (side-by-side, parallel): F_r = 3k/r⁴·[1−0] = +3k/r⁴ → REPEL ✓
  //
  // INTEGRATION: Semi-implicit Euler (symplectic, energy-conserving)
  //   v(t+dt) = v(t) + a·dt
  //   x(t+dt) = x(t) + v(t+dt)·dt
  //
  // FRICTION: Coulomb model (constant force opposing motion)
  //   F_kinetic = μ_k · m · g  (opposing velocity direction)
  //   F_static  = μ_s · m · g  (must be exceeded to start moving)
  //
  // ================================================================

  // --- Perlin Noise (simplified 2D, for surface imperfections) ---
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

  // ================================================================
  // PHYSICAL CONSTANTS (tuned for pixel-space simulation)
  // ================================================================
  // Scale: 1 pixel ≈ 1 mm. Arena radius ≈ 155px ≈ 15.5cm.
  // Real Kluster magnets: ~3cm long, ~12g, neodymium.

  const MASS = 12;                    // magnet mass (grams, arbitrary units)
  const MOMENT_OF_INERTIA = 10;      // I = (1/12) · m · L² for a rod

  // Effective gravity for Coulomb friction on a flat surface.
  // Real: g=9.8 m/s². In our units, we tune this so that:
  //   Static friction threshold ≈ 80-100 force units
  //   → magnets within ~50px start drifting, within ~30px snap hard
  const GRAVITY = 18;
  const MU_KINETIC = 0.28;           // kinetic friction (wood/cloth surface)
  const MU_STATIC  = 0.35;           // static friction (higher, prevents jitter)
  const MU_ANGULAR = 0.12;           // angular friction coefficient

  const MAX_FORCE = 500;             // cap to prevent numerical explosion at r→0
  const MAX_TORQUE = 250;            // torque cap
  const MAX_VELOCITY = 180;          // px/s safety cap
  const MAX_OMEGA = 15;              // rad/s angular velocity cap
  const VELOCITY_EPSILON = 0.2;      // below this, magnet is "stopped"
  const OMEGA_EPSILON = 0.02;        // below this, rotation is "stopped"

  // Derived thresholds
  // Static friction force: μ_s · m · g = 0.35 · 12 · 18 = 75.6 force units
  // Kinetic friction decel: μ_k · g = 0.28 · 18 = 5.04 px/s²
  // At r=50px with k=120M: F_max = 6·120M/50⁴ = 6·120M/6.25M = 115 > 75.6 → slides ✓
  // At r=70px with k=120M: F_max = 6·120M/70⁴ = 6·120M/24.01M = 30 < 75.6 → stays ✓
  // At r=35px with k=120M: F_max = 6·120M/35⁴ = 6·120M/1.5M = 480 → strong snap ✓

  // Physics sub-stepping for stability
  const SUB_STEPS = 3;

  function createMagnet(id, team, x, y, theta, strength) {
    return {
      id: id,
      team: team,
      x: x, y: y,
      prevX: x, prevY: y,
      vx: 0, vy: 0,
      theta: theta || 0,
      omega: 0,
      strength: strength || 1.0,
      state: "in-hand",
      clusterGroup: -1,
      mass: MASS,
    };
  }

  // ================================================================
  // CORRECT MAGNETIC DIPOLE-DIPOLE INTERACTION
  // Derived from U = (k/r³)[cos(θA−θB) − 3cos(θA−α)cos(θB−α)]
  // ================================================================
  function calculateDipoleForces(magnetA, magnetB, k) {
    var dx = magnetB.x - magnetA.x;
    var dy = magnetB.y - magnetA.y;
    var distSq = dx * dx + dy * dy;
    var dist = Math.sqrt(distSq);

    // Minimum distance to prevent singularity (2px ≈ contact)
    if (dist < 2) return { fx: 0, fy: 0, torqueA: 0, torqueB: 0, dist: dist };

    var alpha = Math.atan2(dy, dx);  // angle of line from A to B
    var r4 = distSq * distSq;        // r⁴ for force (correct power law!)
    var r3 = dist * distSq;          // r³ for torque
    var kAB = k * magnetA.strength * magnetB.strength;

    var thetaA = magnetA.theta;
    var thetaB = magnetB.theta;

    // Pre-compute trig (used multiple times)
    var cosAB = Math.cos(thetaA - thetaB);
    var sinAB = Math.sin(thetaA - thetaB);
    var cosAa = Math.cos(thetaA - alpha);
    var cosBa = Math.cos(thetaB - alpha);
    var sinAa = Math.sin(thetaA - alpha);
    var sinBa = Math.sin(thetaB - alpha);

    // ---- RADIAL FORCE (along r̂) ----
    // F_r = (3k/r⁴) · [cos(θA−θB) − 3·cos(θA−α)·cos(θB−α)]
    // Positive = repulsion, Negative = attraction
    var fRadial = (3 * kAB / r4) * (cosAB - 3 * cosAa * cosBa);

    // ---- TANGENTIAL FORCE (perpendicular to r̂) ----
    // F_α = (3k/r⁴) · sin(θA + θB − 2α)
    var fTangential = (3 * kAB / r4) * Math.sin(thetaA + thetaB - 2 * alpha);

    // Convert radial/tangential to Cartesian
    // F = F_r · r̂ + F_α · α̂  where r̂=(cosα,sinα), α̂=(−sinα,cosα)
    var cosAlpha = Math.cos(alpha);
    var sinAlpha = Math.sin(alpha);
    var fx = fRadial * cosAlpha - fTangential * sinAlpha;
    var fy = fRadial * sinAlpha + fTangential * cosAlpha;

    // Cap force magnitude for numerical stability
    var forceMag = Math.sqrt(fx * fx + fy * fy);
    if (forceMag > MAX_FORCE) {
      var fScale = MAX_FORCE / forceMag;
      fx *= fScale;
      fy *= fScale;
    }

    // ---- TORQUES (from −∂U/∂θ) ----
    // τ_A = (k/r³) · [sin(θA−θB) − 3·sin(θA−α)·cos(θB−α)]
    // τ_B = (k/r³) · [sin(θB−θA) − 3·sin(θB−α)·cos(θA−α)]
    var torqueA = (kAB / r3) * (sinAB - 3 * sinAa * cosBa);
    var torqueB = (kAB / r3) * (-sinAB - 3 * sinBa * cosAa);

    // Cap torques
    torqueA = Math.max(-MAX_TORQUE, Math.min(MAX_TORQUE, torqueA));
    torqueB = Math.max(-MAX_TORQUE, Math.min(MAX_TORQUE, torqueB));

    return { fx: fx, fy: fy, torqueA: torqueA, torqueB: torqueB, dist: dist };
  }

  function getSurfaceFriction(x, y, baseMu, imperfection) {
    if (imperfection <= 0) return baseMu;
    var noise = perlin2(x * 0.02, y * 0.02);
    return baseMu + noise * imperfection * 0.05;
  }

  // ================================================================
  // PHYSICS STEP — Newton's laws + Coulomb friction
  // Uses sub-stepping for stability
  // ================================================================
  function step(magnets, levelConfig, arenaCenter, dt) {
    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    if (placed.length === 0) return 0;

    var k = levelConfig.magneticK;
    var range = levelConfig.magneticRange;
    var baseFriction = levelConfig.surfaceFriction;
    var imperfection = levelConfig.surfaceImperfection;

    var subDt = dt / SUB_STEPS;
    var maxVel = 0;

    for (var step = 0; step < SUB_STEPS; step++) {

      // --- Accumulate forces from all pairwise interactions ---
      var forces = [];
      for (var fi = 0; fi < placed.length; fi++) {
        forces.push({ fx: 0, fy: 0, torque: 0 });
      }

      for (var i = 0; i < placed.length; i++) {
        for (var j = i + 1; j < placed.length; j++) {
          var dx = placed[j].x - placed[i].x;
          var dy = placed[j].y - placed[i].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > range) continue;

          var result = calculateDipoleForces(placed[i], placed[j], k);

          // Newton's 3rd law: equal and opposite
          forces[i].fx += result.fx;
          forces[i].fy += result.fy;
          forces[i].torque += result.torqueA;
          forces[j].fx -= result.fx;
          forces[j].fy -= result.fy;
          forces[j].torque += result.torqueB;
        }
      }

      // --- Integrate each magnet ---
      for (var mi = 0; mi < placed.length; mi++) {
        var m = placed[mi];
        var mass = m.mass || MASS;
        var mu = getSurfaceFriction(m.x, m.y, baseFriction, imperfection);

        // Total magnetic force magnitude
        var fMag = Math.sqrt(forces[mi].fx * forces[mi].fx + forces[mi].fy * forces[mi].fy);
        var speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);

        // --- STATIC FRICTION CHECK ---
        // Object at rest stays at rest unless magnetic force > μ_s · m · g
        var staticThreshold = mu * 1.2 * mass * GRAVITY; // μ_static ≈ 1.2 × μ_kinetic
        if (speed < VELOCITY_EPSILON && fMag < staticThreshold) {
          m.vx = 0;
          m.vy = 0;
        } else {
          // --- Newton's 2nd Law: a = F/m ---
          var ax = forces[mi].fx / mass;
          var ay = forces[mi].fy / mass;

          // --- KINETIC FRICTION: constant deceleration opposing velocity ---
          if (speed > VELOCITY_EPSILON) {
            var frictionDecel = mu * GRAVITY;
            // Limit friction so it doesn't reverse velocity in one step
            var maxFricSpeed = frictionDecel * subDt;
            if (maxFricSpeed > speed) {
              // Friction would stop the magnet this substep
              ax -= (m.vx / speed) * (speed / subDt);
              ay -= (m.vy / speed) * (speed / subDt);
            } else {
              ax -= (m.vx / speed) * frictionDecel;
              ay -= (m.vy / speed) * frictionDecel;
            }
          }

          // Semi-implicit Euler: update velocity, then position
          m.vx += ax * subDt;
          m.vy += ay * subDt;

          // Velocity cap
          var newSpeed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
          if (newSpeed > MAX_VELOCITY) {
            m.vx = (m.vx / newSpeed) * MAX_VELOCITY;
            m.vy = (m.vy / newSpeed) * MAX_VELOCITY;
          }

          // Dead zone: stop jittering
          if (newSpeed < VELOCITY_EPSILON && fMag < staticThreshold * 0.5) {
            m.vx = 0;
            m.vy = 0;
          }
        }

        // Update position
        m.prevX = m.x;
        m.prevY = m.y;
        m.x += m.vx * subDt;
        m.y += m.vy * subDt;

        // --- ANGULAR DYNAMICS ---
        // τ = I·α → α = τ/I
        var angAccel = forces[mi].torque / MOMENT_OF_INERTIA;
        var absOmega = Math.abs(m.omega);
        var torqueMag = Math.abs(forces[mi].torque);

        // Static angular friction
        var angStaticThreshold = mu * 1.2 * mass * GRAVITY * 0.05;
        if (absOmega < OMEGA_EPSILON && torqueMag < angStaticThreshold) {
          m.omega = 0;
        } else {
          m.omega += angAccel * subDt;

          // Angular kinetic friction
          if (absOmega > OMEGA_EPSILON) {
            var angFriction = MU_ANGULAR * GRAVITY;
            var maxAngFric = angFriction * subDt;
            if (maxAngFric > absOmega) {
              m.omega = 0;
            } else {
              m.omega -= Math.sign(m.omega) * maxAngFric;
            }
          }

          // Angular velocity cap
          if (Math.abs(m.omega) > MAX_OMEGA) {
            m.omega = Math.sign(m.omega) * MAX_OMEGA;
          }
        }

        m.theta += m.omega * subDt;

        // --- ARENA BOUNDARY (rope wall) ---
        var dxC = m.x - arenaCenter.x;
        var dyC = m.y - arenaCenter.y;
        var distFromCenter = Math.sqrt(dxC * dxC + dyC * dyC);
        var maxDist = levelConfig.arenaRadius - CONFIG.MAGNET_RADIUS;

        if (distFromCenter > maxDist && maxDist > 0) {
          var nx = dxC / distFromCenter;
          var ny = dyC / distFromCenter;
          m.x = arenaCenter.x + nx * maxDist;
          m.y = arenaCenter.y + ny * maxDist;

          // Reflect with energy loss (rope is soft, e ≈ 0.2)
          var vDotN = m.vx * nx + m.vy * ny;
          if (vDotN > 0) {
            m.vx -= (1 + 0.2) * vDotN * nx;
            m.vy -= (1 + 0.2) * vDotN * ny;
          }
        }

        // --- MAGNET-MAGNET COLLISION ---
        for (var cj = mi + 1; cj < placed.length; cj++) {
          var other = placed[cj];
          var cdx = other.x - m.x;
          var cdy = other.y - m.y;
          var cDist = Math.sqrt(cdx * cdx + cdy * cdy);
          var minDist = CONFIG.MAGNET_RADIUS * 2;

          if (cDist < minDist && cDist > 0.1) {
            // Push apart (resolve overlap)
            var overlap = (minDist - cDist) / 2;
            var cnx = cdx / cDist;
            var cny = cdy / cDist;
            m.x -= cnx * overlap;
            m.y -= cny * overlap;
            other.x += cnx * overlap;
            other.y += cny * overlap;

            // Inelastic collision response (e = 0.15, magnets don't bounce much)
            var dvx = m.vx - other.vx;
            var dvy = m.vy - other.vy;
            var relVn = dvx * cnx + dvy * cny;
            if (relVn < 0) {
              var impulse = -(1 + 0.15) * relVn / 2;
              m.vx += impulse * cnx;
              m.vy += impulse * cny;
              other.vx -= impulse * cnx;
              other.vy -= impulse * cny;
            }
          }
        }

        var finalSpeed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
        if (finalSpeed > maxVel) maxVel = finalSpeed;
      }
    }

    return maxVel;
  }

  // ================================================================
  // CLUSTER DETECTION (Union-Find)
  // ================================================================
  function findClusters(magnets, levelConfig) {
    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    var threshold = CONFIG.MAGNET_RADIUS * CONFIG.CLUSTER_THRESHOLD_FACTOR;
    var parent = new Map();
    var rank = new Map();

    function find(id) {
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)));
      return parent.get(id);
    }

    function union(a, b) {
      var ra = find(a), rb = find(b);
      if (ra === rb) return;
      if (rank.get(ra) < rank.get(rb)) parent.set(ra, rb);
      else if (rank.get(ra) > rank.get(rb)) parent.set(rb, ra);
      else { parent.set(rb, ra); rank.set(ra, rank.get(ra) + 1); }
    }

    for (var ci = 0; ci < placed.length; ci++) {
      parent.set(placed[ci].id, placed[ci].id);
      rank.set(placed[ci].id, 0);
    }

    for (var i = 0; i < placed.length; i++) {
      for (var j = i + 1; j < placed.length; j++) {
        var dx = placed[j].x - placed[i].x;
        var dy = placed[j].y - placed[i].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < threshold) {
          union(placed[i].id, placed[j].id);
        }
      }
    }

    var groups = new Map();
    for (var gi = 0; gi < placed.length; gi++) {
      var root = find(placed[gi].id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(placed[gi]);
    }

    var clusters = [];
    groups.forEach(function(group) {
      if (group.length >= 2) clusters.push(group);
    });
    return clusters;
  }

  // Small vibration impulse when a magnet is placed on the surface
  function applyPlacementImpulse(magnets, placedX, placedY, levelConfig) {
    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    for (var i = 0; i < placed.length; i++) {
      var m = placed[i];
      if (m.x === placedX && m.y === placedY) continue;
      var dx = m.x - placedX;
      var dy = m.y - placedY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0 && dist < levelConfig.magneticRange) {
        // Tiny vibration (placing a magnet shakes the surface slightly)
        var impulse = CONFIG.PLACEMENT_VIBRATION_IMPULSE / (dist * 0.05 + 1);
        var nx = dx / dist;
        var ny = dy / dist;
        m.vx += nx * impulse;
        m.vy += ny * impulse;
      }
    }
  }

  function getForceAtPoint(x, y, magnets, levelConfig) {
    var totalForce = 0;
    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    var k = levelConfig.magneticK;
    for (var i = 0; i < placed.length; i++) {
      var dx = x - placed[i].x;
      var dy = y - placed[i].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) { totalForce = Infinity; break; }
      // Use r⁴ (correct dipole force falloff)
      totalForce += 3 * k * placed[i].strength / (dist * dist * dist * dist);
    }
    return totalForce;
  }

  function isInsideArena(x, y, arenaCenter, arenaRadius) {
    var dx = x - arenaCenter.x;
    var dy = y - arenaCenter.y;
    return Math.sqrt(dx * dx + dy * dy) + CONFIG.MAGNET_RADIUS <= arenaRadius;
  }

  return {
    initPerlin: initPerlin,
    createMagnet: createMagnet,
    calculateDipoleForces: calculateDipoleForces,
    step: step,
    findClusters: findClusters,
    applyPlacementImpulse: applyPlacementImpulse,
    getForceAtPoint: getForceAtPoint,
    isInsideArena: isInsideArena,
    perlin2: perlin2,
  };
})();
