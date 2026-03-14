"use strict";

const AI = (function () {
  function randomArenaPosition(arenaRadius) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (arenaRadius - CONFIG.MAGNET_RADIUS);
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }

  function simulatePlacement(testX, testY, testTheta, magnets, levelConfig) {
    const testMagnet = Physics.createMagnet(-1, "ai", testX, testY, testTheta, 1.0);
    testMagnet.state = "placed";

    const simMagnets = magnets
      .filter(m => m.state === "placed")
      .map(m => ({ ...m, prevX: m.x, prevY: m.y }));
    simMagnets.push({ ...testMagnet, prevX: testX, prevY: testY });

    const steps = Math.floor(levelConfig.simSteps / 3);
    const arenaCenter = { x: 0, y: 0 };
    for (let i = 0; i < steps; i++) {
      Physics.step(simMagnets, levelConfig, arenaCenter, CONFIG.PHYSICS_DT);
    }

    const clusters = Physics.findClusters(simMagnets, levelConfig);
    const causedCluster = clusters.length > 0;

    return { causedCluster, simMagnets };
  }

  function scorePosition(x, y, magnets, levelConfig) {
    const placed = magnets.filter(m => m.state === "placed");
    let score = 0;

    let minDist = Infinity;
    for (const m of placed) {
      const dx = x - m.x;
      const dy = y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }
    score += minDist * 0.5;

    const centerDist = Math.sqrt(x * x + y * y);
    score += (levelConfig.arenaRadius - centerDist) * 0.3;

    let trapScore = 0;
    for (const m of placed) {
      if (m.team === "player") continue;
      const dx = x - m.x;
      const dy = y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > CONFIG.MAGNET_RADIUS * 3 && dist < levelConfig.magneticRange * 0.8) {
        trapScore += 1.0;
      }
    }
    score += trapScore * 0.2;

    return score;
  }

  function choosePosition(magnets, levelConfig) {
    const numCandidates = levelConfig.aiCandidates;
    const noise = levelConfig.aiNoise;
    const candidates = [];

    for (let i = 0; i < numCandidates; i++) {
      const pos = randomArenaPosition(levelConfig.arenaRadius);
      const theta = Math.random() * Math.PI * 2;

      const result = simulatePlacement(pos.x, pos.y, theta, magnets, levelConfig);

      if (!result.causedCluster) {
        const score = scorePosition(pos.x, pos.y, magnets, levelConfig);
        const noisyScore = score * (1 + (Math.random() - 0.5) * 2 * noise);
        candidates.push({ x: pos.x, y: pos.y, theta, score: noisyScore });
      }
    }

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

    candidates.sort((a, b) => b.score - a.score);

    return {
      x: candidates[0].x,
      y: candidates[0].y,
      theta: candidates[0].theta,
      candidates: candidates.slice(0, 5),
    };
  }

  return { choosePosition, randomArenaPosition };
})();
