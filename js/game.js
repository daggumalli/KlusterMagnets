"use strict";

const Game = (function () {
  const S = CONFIG.STATES;

  let state = S.MENU;
  let currentLevel = null;
  let levelConfig = null;
  let magnets = [];
  let playerMagnets = 0;
  let aiMagnets = 0;
  let currentTurn = "player";
  let unlockedLevels = 1;
  let time = 0;

  let dragActive = false;
  let dragX = 0, dragY = 0;
  let ghostMagnet = null;
  let dangerLevel = 0;

  let settleTimer = 0;
  let settleSlowMo = true;

  let clusterGroup = null;
  let clusterAnimStart = 0;
  let clusterOwner = null;

  let aiDecision = null;
  let aiThinkStart = 0;
  let aiCandidates = [];
  let aiHesitating = false;
  let aiPlaceStart = 0;

  let gameOverButtons = null;
  let gameWon = false;

  let message = "";
  let messageColor = "#F0D78C";

  let nextMagnetId = 0;

  function loadProgress() {
    var saved = localStorage.getItem("kluster_progress");
    if (saved) {
      try {
        var data = JSON.parse(saved);
        unlockedLevels = data.unlockedLevels || 1;
      } catch (e) {}
    }
  }

  function saveProgress() {
    localStorage.setItem("kluster_progress", JSON.stringify({
      unlockedLevels: unlockedLevels,
    }));
  }

  function init() {
    loadProgress();
    Audio.init();
    Haptics.init();

    var canvas = window.KLUSTER.canvas;

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    canvas.addEventListener("touchstart", Audio.unlock, { once: true });
    canvas.addEventListener("click", Audio.unlock, { once: true });

    Physics.initPerlin(Date.now());
  }

  function screenToArena(px, py) {
    var W = KLUSTER.getW(), H = KLUSTER.getH(), sc = KLUSTER.getSc();
    var layout = UI.getLayout(W, H, sc);
    return {
      x: (px - layout.arena.cx) / sc,
      y: (py - layout.arena.cy) / sc,
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    var px = e.clientX, py = e.clientY;
    var W = KLUSTER.getW(), H = KLUSTER.getH(), sc = KLUSTER.getSc();

    if (state === S.MENU || state === S.LEVEL_SELECT) {
      var levelIdx = UI.hitTestLevelCard(px, py, W, H, unlockedLevels);
      if (levelIdx >= 0) {
        Audio.levelSelect();
        startLevel(levelIdx);
      }
      return;
    }

    if (state === S.GAME_OVER) {
      var btnId = UI.hitTestGameOverButton(px, py, gameOverButtons);
      if (btnId === "retry") {
        Audio.levelSelect();
        startLevel(CONFIG.LEVELS.indexOf(levelConfig));
      } else if (btnId === "next") {
        Audio.levelSelect();
        var nextIdx = CONFIG.LEVELS.indexOf(levelConfig) + 1;
        if (nextIdx < CONFIG.LEVELS.length) startLevel(nextIdx);
        else { state = S.MENU; }
      } else if (btnId === "menu") {
        Audio.levelSelect();
        state = S.MENU;
      }
      return;
    }

    if (UI.hitTestBackButton(px, py, W)) {
      Audio.levelSelect();
      Audio.ambientStop();
      state = S.MENU;
      return;
    }

    if (state === S.PLAYER_TURN && currentTurn === "player") {
      var arena = screenToArena(px, py);
      if (Physics.isInsideArena(arena.x, arena.y, { x: 0, y: 0 }, levelConfig.arenaRadius)) {
        dragActive = true;
        dragX = arena.x;
        dragY = arena.y;
        var theta = levelConfig.polarityRandomization > 0
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
    var arena = screenToArena(e.clientX, e.clientY);

    var dist = Math.sqrt(arena.x * arena.x + arena.y * arena.y);
    var maxDist = levelConfig.arenaRadius - CONFIG.MAGNET_RADIUS;
    if (dist > maxDist) {
      arena.x = (arena.x / dist) * maxDist;
      arena.y = (arena.y / dist) * maxDist;
    }

    dragX = arena.x;
    dragY = arena.y;
    ghostMagnet.x = arena.x;
    ghostMagnet.y = arena.y;

    var clusterThreshold = CONFIG.MAGNET_RADIUS * CONFIG.CLUSTER_THRESHOLD_FACTOR;
    var minDist = Infinity;
    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    for (var i = 0; i < placed.length; i++) {
      var dx = arena.x - placed[i].x;
      var dy = arena.y - placed[i].y;
      var d = Math.sqrt(dx * dx + dy * dy);
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

    var id = nextMagnetId++;
    var strength = 1.0 + (Math.random() - 0.5) * 2 * levelConfig.magnetMassVariance;
    var magnet = Physics.createMagnet(id, "player", dragX, dragY, ghostMagnet.theta, strength);
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

  function startAITurn() {
    currentTurn = "ai";
    state = S.AI_THINKING;
    aiThinkStart = time;
    aiHesitating = false;
    message = "AI is thinking...";
    messageColor = CONFIG.AI_COLOR.light;
    Audio.thinkingStart();

    setTimeout(function() {
      aiDecision = AI.choosePosition(magnets, levelConfig);
      aiCandidates = aiDecision.candidates || [];
    }, 50);
  }

  function finishTurn() {
    if (currentTurn === "player") {
      playerMagnets--;
      if (playerMagnets <= 0) {
        gameWon = true;
        state = S.GAME_OVER;
        message = "";
        Audio.ambientStop();
        Audio.victory();
        var nextLevel = currentLevel + 2;
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

  function update(dt) {
    time += dt;

    if (state === S.SETTLING) {
      var simDt = settleSlowMo ? CONFIG.PHYSICS_DT * CONFIG.SLOW_MOTION_FACTOR : CONFIG.PHYSICS_DT;
      var maxVel = Physics.step(magnets, levelConfig, { x: 0, y: 0 }, simDt);

      Audio.slideUpdate(maxVel);

      settleTimer += dt * 1000;

      if (maxVel < CONFIG.SETTLE_VELOCITY_THRESHOLD || settleTimer > CONFIG.SETTLE_TIMEOUT_MS) {
        Audio.slideStop();
        state = S.CLUSTER_CHECK;
      }
    }

    if (state === S.CLUSTER_CHECK) {
      var clusters = Physics.findClusters(magnets, levelConfig);
      if (clusters.length > 0) {
        clusterGroup = clusters[0];
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
        var placed = magnets.filter(function(m) { return m.state === "placed"; });
        var closestDist = Infinity;
        for (var i = 0; i < placed.length; i++) {
          for (var j = i + 1; j < placed.length; j++) {
            var dx = placed[j].x - placed[i].x;
            var dy = placed[j].y - placed[i].y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < closestDist) closestDist = d;
          }
        }
        var threshold = CONFIG.MAGNET_RADIUS * CONFIG.CLUSTER_THRESHOLD_FACTOR;
        if (closestDist < threshold * 1.5 && closestDist >= threshold) {
          Audio.nearMiss(1 - (closestDist - threshold) / (threshold * 0.5));
        }

        finishTurn();
      }
    }

    if (state === S.CLUSTER_ANIM) {
      var elapsed = time - clusterAnimStart;
      if (elapsed > CONFIG.CLUSTER_FLASH_DURATION / 1000) {
        var clusterCount = clusterGroup.length;
        for (var ci = 0; ci < clusterGroup.length; ci++) {
          clusterGroup[ci].state = "clustered";
        }
        magnets = magnets.filter(function(m) { return m.state !== "clustered"; });

        if (clusterOwner === "player") {
          playerMagnets += clusterCount;
        } else {
          aiMagnets += clusterCount;
        }

        clusterGroup = null;
        state = S.CLUSTER_CHECK;
      }
    }

    if (state === S.AI_THINKING) {
      var aiElapsed = time - aiThinkStart;

      if (aiDecision && aiElapsed > levelConfig.aiThinkTime / 1000 * 0.3) {
        if (!aiHesitating && levelConfig.id >= 2 && Math.random() < 0.3) {
          aiHesitating = true;
        }
      }

      if (aiDecision && aiElapsed > levelConfig.aiThinkTime / 1000) {
        Audio.thinkingStop();
        state = S.AI_PLACING;
        aiPlaceStart = time;
      }
    }

    if (state === S.AI_PLACING) {
      var placeElapsed = time - aiPlaceStart;
      var placeDuration = 0.4;

      if (placeElapsed >= placeDuration) {
        var aid = nextMagnetId++;
        var aStrength = 1.0 + (Math.random() - 0.5) * 2 * levelConfig.magnetMassVariance;
        var aMagnet = Physics.createMagnet(aid, "ai", aiDecision.x, aiDecision.y, aiDecision.theta, aStrength);
        aMagnet.state = "placed";
        aMagnet.prevX = aMagnet.x;
        aMagnet.prevY = aMagnet.y;
        magnets.push(aMagnet);

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

  function render(ctx, W, H, sc) {
    var layout = UI.getLayout(W, H, sc);

    if (state === S.MENU || state === S.LEVEL_SELECT) {
      UI.drawMenu(ctx, W, H, sc, unlockedLevels);
      return;
    }

    var shake = Renderer.getShakeOffset(time * 1000);
    ctx.save();
    ctx.translate(shake.x, shake.y);

    Renderer.drawTable(ctx, W, H);
    Renderer.drawRope(ctx, layout.arena.cx, layout.arena.cy, levelConfig.arenaRadius, sc);
    Renderer.drawFieldLines(ctx, magnets, layout.arena.cx, layout.arena.cy, sc, time);

    var placed = magnets.filter(function(m) { return m.state === "placed"; });
    for (var pi = 0; pi < placed.length; pi++) {
      Renderer.drawMagnet(ctx, placed[pi], layout.arena.cx, layout.arena.cy, sc, time, false, 0);
    }

    if (ghostMagnet && state === S.PLACING) {
      Renderer.drawMagnet(ctx, ghostMagnet, layout.arena.cx, layout.arena.cy, sc, time, true, dangerLevel);
    }

    if (state === S.AI_THINKING && aiCandidates.length > 0) {
      var aiProgress = (time - aiThinkStart) / (levelConfig.aiThinkTime / 1000);
      Renderer.drawAIThinkingDots(ctx, aiCandidates, layout.arena.cx, layout.arena.cy, sc, aiProgress);
    }

    if (state === S.AI_PLACING && aiDecision) {
      var apElapsed = time - aiPlaceStart;
      var apProgress = Math.min(apElapsed / 0.4, 1);
      var startY = aiDecision.y - 50 * (1 - apProgress);
      var animMagnet = { x: aiDecision.x, y: startY, team: "ai", theta: aiDecision.theta };
      var apAlpha = 0.3 + apProgress * 0.7;
      ctx.globalAlpha = apAlpha;
      Renderer.drawMagnet(ctx, animMagnet, layout.arena.cx, layout.arena.cy, sc, time, false, 0);
      ctx.globalAlpha = 1;
    }

    if (state === S.CLUSTER_ANIM && clusterGroup) {
      var caElapsed = time - clusterAnimStart;
      var caProgress = caElapsed / (CONFIG.CLUSTER_FLASH_DURATION / 1000);
      Renderer.drawClusterEffect(ctx, clusterGroup, layout.arena.cx, layout.arena.cy, sc, Math.min(caProgress, 1));
    }

    if (state === S.PLACING) {
      Renderer.drawDangerMeter(ctx, dangerLevel, layout.arena.cx, layout.arena.cy, levelConfig.arenaRadius, sc, time);
    }

    ctx.restore();

    UI.drawHUD(ctx, layout, {
      levelName: "Level " + levelConfig.id + ": " + levelConfig.name,
      playerMagnets: playerMagnets,
      aiMagnets: aiMagnets,
      currentTurn: currentTurn,
      message: message,
      messageColor: messageColor,
    });

    UI.drawInventory(ctx, layout, playerMagnets, aiMagnets);

    if (state === S.GAME_OVER) {
      gameOverButtons = UI.drawGameOver(ctx, W, H, gameWon, time);
    }
  }

  return { init: init, update: update, render: render };
})();
