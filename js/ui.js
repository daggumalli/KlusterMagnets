"use strict";

const UI = (function () {
  function getLayout(W, H, sc) {
    const isLandscape = W > H;
    const topBarH = 40;
    const scorePanelH = 60;
    const inventoryH = 30;
    const messageH = 36;
    const padding = 15;

    const availableH = H - topBarH - scorePanelH - inventoryH - messageH - padding * 4;
    const availableW = W - padding * 2;
    const arenaSize = Math.min(availableH, availableW) * 0.9;

    return {
      topBar: { x: 0, y: 0, w: W, h: topBarH },
      scorePanel: { x: W / 2 - 140, y: topBarH + padding, w: 280, h: scorePanelH },
      message: { x: 0, y: topBarH + scorePanelH + padding * 2, w: W, h: messageH },
      arena: {
        cx: W / 2,
        cy: topBarH + scorePanelH + messageH + padding * 3 + arenaSize / 2,
        size: arenaSize,
      },
      inventory: { x: 0, y: H - inventoryH - padding, w: W, h: inventoryH },
      isLandscape,
    };
  }

  function drawMenu(ctx, W, H, sc, unlockedLevels) {
    Renderer.drawTable(ctx, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);

    const titleSize = Math.min(W * 0.12, 64);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const titleY = H * 0.18;
    ctx.font = "bold " + titleSize + "px Georgia, serif";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText("KLUSTER", W / 2 + 2, titleY + 2);
    const tGrad = ctx.createLinearGradient(W / 2 - 120, titleY - 30, W / 2 + 120, titleY + 30);
    tGrad.addColorStop(0, "#D4A84B");
    tGrad.addColorStop(0.5, "#F0D78C");
    tGrad.addColorStop(1, "#B8860B");
    ctx.fillStyle = tGrad;
    ctx.fillText("KLUSTER", W / 2, titleY);

    ctx.strokeStyle = "#D4A84B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 80, titleY + titleSize * 0.6);
    ctx.lineTo(W / 2 + 80, titleY + titleSize * 0.6);
    ctx.stroke();

    ctx.font = Math.min(W * 0.035, 16) + "px Georgia, serif";
    ctx.fillStyle = "rgba(212,168,75,0.7)";
    ctx.fillText("MAGNETIC DEXTERITY", W / 2, titleY + titleSize * 0.6 + 20);

    const cardW = Math.min(W * 0.8, 320);
    const cardH = 70;
    const cardStartY = H * 0.38;

    for (let i = 0; i < CONFIG.LEVELS.length; i++) {
      const level = CONFIG.LEVELS[i];
      const unlocked = i < unlockedLevels;
      const cy = cardStartY + i * (cardH + 12);
      const cx = W / 2 - cardW / 2;

      ctx.fillStyle = unlocked ? "rgba(93,58,26,0.8)" : "rgba(40,25,10,0.6)";
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 10);
      ctx.fill();

      ctx.strokeStyle = unlocked ? "rgba(212,168,75,0.5)" : "rgba(100,70,30,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (unlocked) {
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

        ctx.font = "bold 16px Georgia, serif";
        ctx.fillStyle = "#3E2410";
        ctx.textAlign = "center";
        ctx.fillText(level.id, badgeX, badgeY + 1);

        ctx.textAlign = "left";
        ctx.font = "bold 18px Georgia, serif";
        ctx.fillStyle = "#F0D78C";
        ctx.fillText(level.name, cx + 60, cy + 28);

        ctx.font = "13px Georgia, serif";
        ctx.fillStyle = "rgba(240,215,140,0.6)";
        ctx.fillText(level.description, cx + 60, cy + 48);

        ctx.textAlign = "right";
        ctx.font = "12px Georgia, serif";
        ctx.fillStyle = "rgba(240,215,140,0.5)";
        ctx.fillText(level.magnetsEach + "v" + level.magnetsEach, cx + cardW - 15, cy + 40);
      } else {
        ctx.textAlign = "center";
        ctx.font = "24px Georgia, serif";
        ctx.fillStyle = "rgba(150,120,70,0.4)";
        ctx.fillText("\uD83D\uDD12", W / 2, cy + cardH / 2 + 2);
      }
    }

    ctx.textAlign = "center";
    const rulesY = H * 0.75;
    ctx.font = "bold 14px Georgia, serif";
    ctx.fillStyle = "rgba(212,168,75,0.6)";
    ctx.fillText("HOW TO PLAY", W / 2, rulesY);

    ctx.font = "12px Georgia, serif";
    ctx.fillStyle = "rgba(200,180,140,0.5)";
    var rules = [
      "Take turns placing magnets inside the rope.",
      "If magnets snap together on your turn, you collect them.",
      "First to place all magnets wins.",
    ];
    for (var ri = 0; ri < rules.length; ri++) {
      ctx.fillText(rules[ri], W / 2, rulesY + 22 + ri * 18);
    }
  }

  function drawHUD(ctx, layout, state) {
    var topBar = layout.topBar;
    var scorePanel = layout.scorePanel;
    var message = layout.message;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(topBar.x, topBar.y, topBar.w, topBar.h);

    ctx.textAlign = "left";
    ctx.font = "bold 16px Georgia, serif";
    ctx.fillStyle = "#D4A84B";
    ctx.fillText(state.levelName, 15, topBar.h / 2 + 1);

    ctx.textAlign = "right";
    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "rgba(212,168,75,0.7)";
    ctx.fillText("\u2715 MENU", topBar.w - 15, topBar.h / 2 + 1);

    var cardW = 120;
    var gap = 20;
    var pCard = { x: scorePanel.x + scorePanel.w / 2 - cardW - gap / 2, y: scorePanel.y, w: cardW, h: scorePanel.h };
    var aCard = { x: scorePanel.x + scorePanel.w / 2 + gap / 2, y: scorePanel.y, w: cardW, h: scorePanel.h };

    var playerActive = state.currentTurn === "player";
    drawScoreCard(ctx, pCard, "YOU", state.playerMagnets, CONFIG.PLAYER_COLOR, playerActive);

    var aiActive = state.currentTurn === "ai";
    drawScoreCard(ctx, aCard, "AI", state.aiMagnets, CONFIG.AI_COLOR, aiActive);

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

  function drawInventory(ctx, layout, playerRemaining, aiRemaining) {
    var inventory = layout.inventory;
    var dotR = 5;
    var gap = 14;

    var pStartX = inventory.w / 2 - 10 - (playerRemaining - 1) * gap / 2;
    var dotY = inventory.y + inventory.h / 2;
    for (var i = 0; i < playerRemaining; i++) {
      ctx.beginPath();
      ctx.arc(pStartX - i * gap, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.PLAYER_COLOR.base;
      ctx.fill();
    }

    var aStartX = inventory.w / 2 + 10 + (aiRemaining - 1) * gap / 2;
    for (var j = 0; j < aiRemaining; j++) {
      ctx.beginPath();
      ctx.arc(aStartX + j * gap, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.AI_COLOR.base;
      ctx.fill();
    }
  }

  function drawGameOver(ctx, W, H, won, time) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, W, H);

    var scale = 1 + 0.05 * Math.sin(time * 3);
    ctx.save();
    ctx.translate(W / 2, H * 0.35);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 48px Georgia, serif";

    if (won) {
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

    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "center";
    var flavor = won ? "Next level unlocked!" : "The magnets got the best of you...";
    ctx.fillText(flavor, W / 2, H * 0.45);

    var btnW = 140;
    var btnH = 44;
    var btnY = H * 0.55;
    var btnGap = 15;

    var buttons = [];

    buttons.push({
      id: "retry",
      x: W / 2 - (won ? btnW + btnGap / 2 : btnW / 2),
      y: btnY, w: btnW, h: btnH,
      label: "RETRY", fill: "#B8860B", text: "#FFF",
    });

    if (won) {
      buttons.push({
        id: "next",
        x: W / 2 + btnGap / 2,
        y: btnY, w: btnW, h: btnH,
        label: "NEXT LEVEL", fill: "#27AE60", text: "#FFF",
      });
    }

    buttons.push({
      id: "menu",
      x: W / 2 - btnW / 2,
      y: btnY + btnH + 12, w: btnW, h: btnH,
      label: "MENU", fill: null, text: "rgba(255,255,255,0.7)",
      stroke: "rgba(255,255,255,0.3)",
    });

    for (var bi = 0; bi < buttons.length; bi++) {
      var btn = buttons[bi];
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

    return buttons;
  }

  function hitTestLevelCard(x, y, W, H, unlockedLevels) {
    var cardW = Math.min(W * 0.8, 320);
    var cardH = 70;
    var cardStartY = H * 0.38;

    for (var i = 0; i < CONFIG.LEVELS.length; i++) {
      if (i >= unlockedLevels) continue;
      var cy = cardStartY + i * (cardH + 12);
      var cx = W / 2 - cardW / 2;
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
        return i;
      }
    }
    return -1;
  }

  function hitTestBackButton(x, y, W) {
    return x > W - 80 && y < 40;
  }

  function hitTestGameOverButton(x, y, buttons) {
    if (!buttons) return null;
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        return btn.id;
      }
    }
    return null;
  }

  return {
    getLayout, drawMenu, drawHUD, drawInventory, drawGameOver,
    hitTestLevelCard, hitTestBackButton, hitTestGameOverButton,
  };
})();
