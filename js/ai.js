"use strict";

const AI = (function () {
  function randomArenaPosition(arenaRadius) {
    // Uniform distribution within circle
    var angle = Math.random() * Math.PI * 2;
    var r = Math.sqrt(Math.random()) * (arenaRadius - CONFIG.MAGNET_RADIUS * 1.5);
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }

  function simulatePlacement(testX, testY, testTheta, magnets, levelConfig) {
    var testMagnet = Physics.createMagnet(-1, "ai", testX, testY, testTheta, 1.0);
    testMagnet.state = "placed";

    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    var simMagnets = placed.map(function(m) {
      return {
        id: m.id, team: m.team, x: m.x, y: m.y, prevX: m.x, prevY: m.y,
        vx: m.vx, vy: m.vy, theta: m.theta, omega: m.omega,
        strength: m.strength, state: "placed", clusterGroup: -1, mass: m.mass,
      };
    });
    simMagnets.push({
      id: -1, team: "ai", x: testX, y: testY, prevX: testX, prevY: testY,
      vx: 0, vy: 0, theta: testTheta, omega: 0,
      strength: 1.0, state: "placed", clusterGroup: -1, mass: 12,
    });

    // Simulate for a short time to see if cluster forms
    var steps = Math.floor(levelConfig.simSteps / 3);
    var arenaCenter = { x: 0, y: 0 };
    for (var i = 0; i < steps; i++) {
      Physics.step(simMagnets, levelConfig, arenaCenter, CONFIG.PHYSICS_DT);
    }

    var clusters = Physics.findClusters(simMagnets, levelConfig);
    return { causedCluster: clusters.length > 0, simMagnets: simMagnets };
  }

  function scorePosition(x, y, magnets, levelConfig) {
    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    var score = 0;

    // PRIMARY: Maximize minimum distance from ALL existing magnets
    // This is the key strategy — stay as far away as possible
    var minDist = Infinity;
    for (var i = 0; i < placed.length; i++) {
      var dx = x - placed[i].x;
      var dy = y - placed[i].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }
    // Strong weight on staying far from others
    score += minDist * 2.0;

    // SECONDARY: Prefer staying inside the arena (not too close to edge)
    var centerDist = Math.sqrt(x * x + y * y);
    var edgeDist = levelConfig.arenaRadius - centerDist - CONFIG.MAGNET_RADIUS;
    if (edgeDist < 20) {
      // Penalize being too close to edge (hard to play from there)
      score -= (20 - edgeDist) * 0.5;
    }

    // BONUS: Extra points for being far from player magnets specifically
    // (creates traps where player must place near AI magnets)
    for (var j = 0; j < placed.length; j++) {
      if (placed[j].team === "player") {
        var pdx = x - placed[j].x;
        var pdy = y - placed[j].y;
        var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        // Reward being at medium range from player magnets (creates danger zone)
        if (pdist > 60 && pdist < levelConfig.magneticRange * 0.7) {
          score += 10;
        }
      }
    }

    return score;
  }

  function choosePosition(magnets, levelConfig) {
    var numCandidates = levelConfig.aiCandidates;
    var noise = levelConfig.aiNoise;
    var candidates = [];

    for (var i = 0; i < numCandidates; i++) {
      var pos = randomArenaPosition(levelConfig.arenaRadius);
      var theta = Math.random() * Math.PI * 2;

      var result = simulatePlacement(pos.x, pos.y, theta, magnets, levelConfig);

      if (!result.causedCluster) {
        var score = scorePosition(pos.x, pos.y, magnets, levelConfig);
        var noisyScore = score * (1 + (Math.random() - 0.5) * 2 * noise);
        candidates.push({ x: pos.x, y: pos.y, theta: theta, score: noisyScore });
      }
    }

    // Fallback: if all placements cause clusters, find the farthest spot
    if (candidates.length === 0) {
      var bestPos = randomArenaPosition(levelConfig.arenaRadius);
      var bestDist = 0;
      for (var fi = 0; fi < 30; fi++) {
        var fpos = randomArenaPosition(levelConfig.arenaRadius);
        var fminDist = Infinity;
        var fplaced = magnets.filter(function(m) { return m.state === "placed"; });
        for (var fj = 0; fj < fplaced.length; fj++) {
          var fdx = fpos.x - fplaced[fj].x;
          var fdy = fpos.y - fplaced[fj].y;
          var fdist = Math.sqrt(fdx * fdx + fdy * fdy);
          if (fdist < fminDist) fminDist = fdist;
        }
        if (fminDist > bestDist) {
          bestDist = fminDist;
          bestPos = fpos;
        }
      }
      return { x: bestPos.x, y: bestPos.y, theta: Math.random() * Math.PI * 2, candidates: [] };
    }

    candidates.sort(function(a, b) { return b.score - a.score; });

    return {
      x: candidates[0].x,
      y: candidates[0].y,
      theta: candidates[0].theta,
      candidates: candidates.slice(0, 5),
    };
  }

  return { choosePosition: choosePosition, randomArenaPosition: randomArenaPosition };
})();
