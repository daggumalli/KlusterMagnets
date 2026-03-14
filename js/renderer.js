"use strict";

const Renderer = (function () {
  let woodPattern = null;
  let woodPatternSize = 0;

  function generateWoodGrain(size) {
    if (woodPattern && woodPatternSize === size) return woodPattern;
    woodPatternSize = size;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#5D3A1A";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 80; i++) {
      const y = Math.random() * size;
      const thickness = 0.5 + Math.random() * 2;
      const alpha = 0.03 + Math.random() * 0.08;
      const dark = Math.random() > 0.5;
      ctx.strokeStyle = dark ? `rgba(30,15,5,${alpha})` : `rgba(120,80,30,${alpha})`;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < size; x += 10) {
        const yOff = Math.sin(x * 0.01 + i) * 3 + Math.sin(x * 0.03 + i * 2) * 1.5;
        ctx.lineTo(x, y + yOff);
      }
      ctx.stroke();
    }

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

  function drawTable(ctx, W, H) {
    const wood = generateWoodGrain(512);
    const pat = ctx.createPattern(wood, "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    const lightGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    lightGrad.addColorStop(0, "rgba(255,220,160,0.12)");
    lightGrad.addColorStop(0.4, "rgba(255,200,120,0.05)");
    lightGrad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawRope(ctx, cx, cy, radius, sc) {
    const ropeWidth = 6 * sc;

    ctx.beginPath();
    ctx.arc(cx, cy, radius * sc + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = ropeWidth + 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * sc, 0, Math.PI * 2);

    const ropeGrad = ctx.createLinearGradient(cx - radius * sc, cy - radius * sc, cx + radius * sc, cy + radius * sc);
    ropeGrad.addColorStop(0, CONFIG.ROPE_COLOR.light);
    ropeGrad.addColorStop(0.3, CONFIG.ROPE_COLOR.base);
    ropeGrad.addColorStop(0.7, CONFIG.ROPE_COLOR.dark);
    ropeGrad.addColorStop(1, CONFIG.ROPE_COLOR.light);
    ctx.strokeStyle = ropeGrad;
    ctx.lineWidth = ropeWidth;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * sc - ropeWidth * 0.2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,240,200,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

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

    if (!isGhost) {
      ctx.beginPath();
      ctx.arc(2 * sc, 3 * sc, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
    }

    const baseGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    baseGrad.addColorStop(0, colors.light);
    baseGrad.addColorStop(0.6, colors.base);
    baseGrad.addColorStop(1, colors.dark);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = baseGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0.3, Math.PI * 1.2);
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 2 * sc;
    ctx.stroke();

    const poleR = r * 0.12;
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, poleR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.5, poleR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.restore();

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
      grad.addColorStop(1, "rgba(100,180,255,0)");
      ctx.beginPath();
      ctx.arc(x, y, fieldR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  function drawClusterEffect(ctx, cluster, cx, cy, sc, progress) {
    for (const m of cluster) {
      const x = cx + m.x * sc;
      const y = cy + m.y * sc;
      const r = CONFIG.MAGNET_RADIUS * sc;

      const glowAlpha = 0.6 * (1 - progress);
      ctx.beginPath();
      ctx.arc(x, y, r + 8 * sc, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,215,0,${glowAlpha})`;
      ctx.fill();

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

  function drawDangerMeter(ctx, dangerLevel, cx, cy, arenaRadius, sc, time) {
    if (dangerLevel <= 0) return;
    const meterW = 120 * sc;
    const meterH = 8 * sc;
    const meterX = cx - meterW / 2;
    const meterY = cy + arenaRadius * sc + 20 * sc;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(meterX, meterY, meterW, meterH, 4 * sc);
    ctx.fill();

    const fillW = meterW * Math.min(dangerLevel, 1);
    const pulse = 0.7 + 0.3 * Math.sin(time * dangerLevel * 15);
    const r = Math.floor(255 * pulse);
    const g = Math.floor(100 * (1 - dangerLevel));
    ctx.fillStyle = `rgb(${r},${g},0)`;
    ctx.beginPath();
    ctx.roundRect(meterX, meterY, fillW, meterH, 4 * sc);
    ctx.fill();
  }

  function drawAIThinkingDots(ctx, candidates, cx, cy, sc, progress) {
    if (!candidates || candidates.length === 0) return;
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
    generateWoodGrain, drawTable, drawRope, drawMagnet, drawFieldLines,
    drawClusterEffect, drawDangerMeter, drawAIThinkingDots,
    triggerShake, getShakeOffset,
  };
})();
