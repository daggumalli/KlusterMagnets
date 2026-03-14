# Kluster MVP Design

## Overview

HTML5 magnetic dexterity game — Player vs AI. Built with vanilla JS + Canvas 2D + Capacitor for iOS/Android/Web. MVP scope: Levels 1-2 with full physics, photorealistic visuals, all audio, haptics, and AI personality.

## Decisions

| Decision | Choice |
|---|---|
| Platform | HTML5 + Capacitor (iOS/Android/Web) |
| YT/Netflix | Later versions |
| Scope | MVP — Levels 1-2 |
| Monetization | Decide later |
| Audio | Full — all 10 sound events from GDD |
| Visuals | Photorealistic per GDD spec |
| Responsive | Auto-adjust to any screen/orientation |
| Source of truth | GDD document |

## 1. Physics Engine

### Magnetic Dipole Model

Each magnet has:
- Position (x, y), velocity (vx, vy)
- Orientation angle (theta), angular velocity (omega)
- Magnetic strength k with per-level variance
- Team (player/AI), state (in-hand, placed, clustered)

### Force Equations (from GDD)

```
F_radial = k * (3 * cos(theta_a - alpha) * cos(theta_b - alpha) - cos(theta_a - theta_b)) / r^3
F_tangential = k * sin(theta_a - theta_b - 2*alpha) / r^3
torque = k * sin(theta_a - theta_b) / r^3
```

Where alpha = angle of line connecting two magnets, r = center-to-center distance.

### Integration

- Verlet integration at fixed 60Hz timestep, decoupled from rendering
- Settling: run up to 120-240 simulation steps per level config
- Settled when max velocity < 0.1px/tick across all magnets

### Surface Simulation

- Perlin noise friction map for subtle variation
- Table vibration: radial impulse on placement, micro-nudges nearby magnets
- Magnet strength variance: +/-0% (L1), +/-5% (L2)

### Cluster Detection

- Threshold: center-to-center < 2.1x magnet radius
- Transitive linking via union-find algorithm
- 800ms removal animation delay

### Arena Boundary

- Circular rope boundary with radius per level config
- Magnets reflected inward with damping on boundary collision
- Placement rejected if center outside boundary

## 2. Renderer (Canvas 2D)

### Table Surface
Procedural walnut wood grain using layered Canvas gradients and noise. Radial gradient lighting (bright center, dark edges) simulating overhead pendant lamp.

### Rope Boundary
Golden braided cord with linear gradients for 3D fiber shading. Drop shadow beneath.

### Magnets
Polished hematite stones: metallic radial gradient, specular highlight (white ellipse top-left), 3D depth shadow, inner ring bevel. Red tint (player) / blue tint (AI).

### Magnetic Fields
Soft radial gradients at 3-5% opacity, pulsing. During drag: field lines intensify toward approaching magnet.

### Placement Preview
Ghost magnet follows finger/cursor. Danger meter pulses faster near existing magnets.

### Slow-Motion Settle
After placement, physics plays at 0.5x speed.

### Cluster Effects
Spark particle burst, 2px screen shake (200ms), yellow warning glow, smooth 800ms removal animation.

### Responsive Scaling
Canvas scales to fit any screen. Arena centered at 70-80% screen height. Logical pixel coordinates scaled by device-dependent factor. Works portrait, landscape, desktop.

## 3. Audio (Web Audio API)

All procedurally synthesized:

| Event | Approach | Duration |
|---|---|---|
| Magnet Placement | Noise burst filtered as wood "tock" | 200ms |
| Magnet Sliding | Filtered noise, pitch tied to velocity | Variable |
| Near-Miss Drift | Low sine, rising pitch on approach | Variable |
| CLUSTER! | Sharp noise burst + high sine accent | 400ms |
| Chain Reaction | Rapid ascending sine clicks | 600ms |
| Victory | C-E-G-C' sine chime | 1.2s |
| Defeat | Descending minor tones | 1.0s |
| AI Thinking | Subtle ticking filtered clicks | Variable |
| Rope Ambient | Low-pass filtered noise loop | Loop |
| Level Select | Short noise click | 150ms |

## 4. Haptics

Capacitor Haptics plugin (native) with Web Vibration API fallback.

| Zone | Behavior |
|---|---|
| Idle (far) | No vibration |
| Approaching (within magnetic range) | 2Hz pulse, 20% amplitude |
| Danger (1.5x cluster threshold) | 8Hz pulse, 60% amplitude |
| Critical (cluster threshold) | Continuous, 90% amplitude |
| CLUSTER event | Single sharp heavy impact |

## 5. AI Opponent

### Decision Architecture
1. Sample candidate positions (52 L1, 58 L2)
2. Run full physics simulation on each candidate
3. Score by: distance from nearest magnet, distance from center, trap potential
4. Inject noise (+/-50% L1, +/-40% L2)

### Personality
- Variable think times (1.5s L1, 1.2s L2)
- Hesitation animation (place and pull back)
- Visible consideration dots over candidate positions

## 6. UI Layout

### Game Screen
- Top Bar: Level name (left), back button (right), 24px, semi-transparent dark
- Score Panel: Two compact cards with magnet counts, active player glows
- Arena: Centered, 70-80% screen height
- Magnet Inventory: Dots below arena
- Message Bar: Contextual messages with color coding

### Menu Screen
- Dark walnut background, gold "KLUSTER" title with underline
- Level cards (vertical list) — unlocked: warm bg + gold badge, locked: dimmed + lock
- "How to Play" section at bottom

### Game Over Screen
- Full-screen overlay, animated text (green "YOU WIN" / red "AI WINS")
- Buttons: Retry (gold), Next Level (green, win only), Menu (outlined)
- Flavor text

## 7. Game State Machine

```
MENU -> LEVEL_SELECT -> GAME_INIT -> PLAYER_TURN -> PLACING -> SETTLING ->
  -> CLUSTER_CHECK -> (CLUSTER_ANIM ->) AI_TURN -> AI_THINKING -> AI_PLACING ->
  -> SETTLING -> CLUSTER_CHECK -> (CLUSTER_ANIM ->) -> PLAYER_TURN
  -> WIN / LOSE -> GAME_OVER
```

## 8. MVP Level Config

| Param | Level 1 (Rookie) | Level 2 (Novice) |
|---|---|---|
| Magnets each | 4 | 5 |
| Arena radius | 155px | 145px |
| Magnetic k | 0.08 | 0.12 |
| Surface friction | 0.92 | 0.90 |
| Magnet variance | +/-0% | +/-5% |
| Surface imperfection | None | Low |
| Polarity randomization | Aligned | Slight tilt |
| Magnetic range | 70px | 78px |
| Sim steps | 120 | 140 |
| AI candidates | 52 | 58 |
| AI noise | +/-50% | +/-40% |
| AI think time | 1.5s | 1.2s |

Level 1 includes tutorial with field visualization and contextual hints.

## 9. File Structure

```
kluster/
  index.html
  css/style.css
  js/
    config.js       — level params, physics constants, thresholds
    physics.js      — dipole forces, Verlet integration, Perlin friction, collision
    renderer.js     — photorealistic Canvas 2D drawing
    audio.js        — Web Audio procedural synthesis
    haptics.js      — Capacitor + Web Vibration fallback
    ai.js           — Monte Carlo sampling, scoring, personality
    game.js         — state machine, turn logic, cluster detection
    ui.js           — menus, HUD, game over, responsive scaling
    app.js          — bootstrap, entry point
  manifest.json
  sw.js
  icons/
```

## 10. Performance Targets

- 60fps on iPhone SE 2020 / Galaxy A53
- L1: 28 pairwise calcs/tick, L2: 45 pairwise calcs/tick
- Memory < 50MB
- Single Canvas element, no WebGL
