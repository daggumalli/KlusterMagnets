"use strict";

(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

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
    sc = Math.min(W, H) / 420;
  }

  window.addEventListener("resize", resize);
  resize();

  window.KLUSTER = {
    canvas, ctx, getW: () => W, getH: () => H, getSc: () => sc,
    getCenterX: () => centerX, getCenterY: () => centerY,
  };

  // Initialize the game now that KLUSTER global is available
  Game.init();

  let lastTime = 0;
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    try {
      Game.update(dt);
      Game.render(ctx, W, H, sc);
    } catch (e) {
      console.error("Game loop error:", e);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function() {});
  }
})();
