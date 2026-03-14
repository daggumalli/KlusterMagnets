"use strict";

const CONFIG = {
  MAGNET_RADIUS: 18,
  CLUSTER_THRESHOLD_FACTOR: 2.1,
  SETTLE_VELOCITY_THRESHOLD: 0.5,
  SETTLE_TIMEOUT_MS: 5000,
  PHYSICS_DT: 1 / 60,
  SLOW_MOTION_FACTOR: 0.5,
  PLACEMENT_VIBRATION_IMPULSE: 3,
  ARENA_PADDING: 40,
  FIELD_OPACITY_MIN: 0.03,
  FIELD_OPACITY_MAX: 0.05,
  FIELD_PULSE_SPEED: 0.002,
  DANGER_PULSE_MIN_HZ: 1,
  DANGER_PULSE_MAX_HZ: 12,
  CLUSTER_FLASH_DURATION: 800,
  SCREEN_SHAKE_AMPLITUDE: 2,
  SCREEN_SHAKE_DURATION: 200,
  PLAYER_COLOR: { base: "#C0392B", light: "#E74C3C", dark: "#922B21" },
  AI_COLOR: { base: "#2471A3", light: "#3498DB", dark: "#1A5276" },
  ROPE_COLOR: { base: "#D4A84B", light: "#F0C75E", dark: "#B8860B" },
  TABLE_COLOR: { base: "#5D3A1A", light: "#8B6914", dark: "#3E2410" },
  FIELD_ATTRACT: "rgba(0, 200, 0, 0.04)",
  FIELD_REPEL: "rgba(200, 0, 0, 0.04)",
  CLUSTER_GLOW: "#FFD700",
  LEVELS: [
    {
      id: 1, name: "Rookie", description: "Learn the basics of magnetic placement",
      magnetsEach: 4, arenaRadius: 155,
      // CORRECT r⁴ dipole physics. Force = 3k·f(θ)/r⁴
      // k=2e9 gives visible interactions at ~100px (2/3 of arena)
      // At r=100: F_max=120, at r=70: F=418, at r=50: F=1920→fast snap
      // Static friction threshold: 0.30·1.2·12·22 = 95
      magneticK: 2000000000, surfaceFriction: 0.30,
      magnetMassVariance: 0, surfaceImperfection: 0, polarityRandomization: 0,
      magneticRange: 200, simSteps: 120, aiCandidates: 80, aiNoise: 0.4,
      aiThinkTime: 1500, isTutorial: true,
    },
    {
      id: 2, name: "Novice", description: "Stronger pull, smarter opponent",
      magnetsEach: 5, arenaRadius: 145,
      magneticK: 3500000000, surfaceFriction: 0.26,
      magnetMassVariance: 0.05, surfaceImperfection: 0.2, polarityRandomization: 0.15,
      magneticRange: 220, simSteps: 140, aiCandidates: 90, aiNoise: 0.3,
      aiThinkTime: 1200, isTutorial: false,
    },
  ],
  STATES: {
    MENU: "MENU", LEVEL_SELECT: "LEVEL_SELECT", GAME_INIT: "GAME_INIT",
    PLAYER_TURN: "PLAYER_TURN", PLACING: "PLACING", SETTLING: "SETTLING",
    CLUSTER_CHECK: "CLUSTER_CHECK", CLUSTER_ANIM: "CLUSTER_ANIM",
    AI_TURN: "AI_TURN", AI_THINKING: "AI_THINKING", AI_PLACING: "AI_PLACING",
    WIN: "WIN", LOSE: "LOSE", GAME_OVER: "GAME_OVER",
  },
};
