"use strict";

const Audio = (function () {
  let actx = null;
  let unlocked = false;

  function init() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
  }

  function unlock() {
    if (unlocked || !actx) return;
    const buf = actx.createBuffer(1, 1, 22050);
    const src = actx.createBufferSource();
    src.buffer = buf;
    src.connect(actx.destination);
    src.start(0);
    if (actx.state === "suspended") actx.resume();
    unlocked = true;
  }

  function now() { return actx ? actx.currentTime : 0; }

  let noiseBuffer = null;
  function getNoiseBuffer(duration) {
    if (noiseBuffer) return noiseBuffer;
    const len = Math.floor(actx.sampleRate * (duration || 2));
    noiseBuffer = actx.createBuffer(1, len, actx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function playTone(freq, type, duration, volume, startTime) {
    const t = startTime || now();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function playNoise(duration, filterFreq, volume, startTime) {
    const t = startTime || now();
    const src = actx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filter = actx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq || 800, t);
    filter.Q.setValueAtTime(1.5, t);
    const gain = actx.createGain();
    gain.gain.setValueAtTime(volume || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(actx.destination);
    src.start(t);
    src.stop(t + duration);
  }

  // Magnet Placement: Soft wooden "tock" — 200ms
  function placement() {
    if (!actx) return;
    playNoise(0.2, 600, 0.25);
    playTone(180, "sine", 0.08, 0.1);
  }

  // Magnet Sliding: Gentle scraping hiss — variable
  let slideSrc = null;
  let slideGain = null;
  function slideStart() {
    if (!actx) return;
    slideSrc = actx.createBufferSource();
    slideSrc.buffer = getNoiseBuffer();
    slideSrc.loop = true;
    const filter = actx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2000, now());
    slideGain = actx.createGain();
    slideGain.gain.setValueAtTime(0, now());
    slideSrc.connect(filter);
    filter.connect(slideGain);
    slideGain.connect(actx.destination);
    slideSrc.start();
  }
  function slideUpdate(speed) {
    if (!slideGain) return;
    const vol = Math.min(speed * 0.5, 0.15);
    slideGain.gain.setTargetAtTime(vol, now(), 0.05);
  }
  function slideStop() {
    if (slideSrc) { try { slideSrc.stop(); } catch(e) {} slideSrc = null; }
    slideGain = null;
  }

  // Near-Miss Drift: Low resonant hum, rising pitch
  function nearMiss(intensity) {
    if (!actx) return;
    const freq = 80 + intensity * 300;
    playTone(freq, "sine", 0.3, 0.08 + intensity * 0.1);
  }

  // CLUSTER!: Sharp metallic "CLACK" + glass shatter accent — 400ms
  function cluster() {
    if (!actx) return;
    playNoise(0.15, 3000, 0.4);
    playNoise(0.4, 8000, 0.15);
    playTone(800, "square", 0.05, 0.2);
    playTone(1200, "sine", 0.1, 0.15, now() + 0.05);
  }

  // Chain Reaction: Rapid succession of clicks, ascending pitch — 600ms
  function chainReaction(count) {
    if (!actx) return;
    for (let i = 0; i < Math.min(count, 6); i++) {
      const t = now() + i * 0.08;
      playTone(400 + i * 150, "sine", 0.06, 0.15, t);
      playNoise(0.04, 2000 + i * 500, 0.1, t);
    }
  }

  // Victory: Warm chime progression (C-E-G-C') — 1.2s
  function victory() {
    if (!actx) return;
    const notes = [261.6, 329.6, 392.0, 523.3];
    notes.forEach((freq, i) => {
      playTone(freq, "sine", 0.4, 0.2, now() + i * 0.25);
      playTone(freq * 2, "sine", 0.3, 0.05, now() + i * 0.25);
    });
  }

  // Defeat: Descending minor tones — 1.0s
  function defeat() {
    if (!actx) return;
    const notes = [392.0, 349.2, 311.1, 261.6];
    notes.forEach((freq, i) => {
      playTone(freq, "sine", 0.35, 0.15, now() + i * 0.22);
    });
  }

  // AI Thinking: Subtle ticking
  let thinkingInterval = null;
  function thinkingStart() {
    if (!actx) return;
    thinkingInterval = setInterval(() => {
      playTone(600 + Math.random() * 200, "sine", 0.02, 0.04);
    }, 200 + Math.random() * 100);
  }
  function thinkingStop() {
    if (thinkingInterval) { clearInterval(thinkingInterval); thinkingInterval = null; }
  }

  // Rope Ambient: Faint room tone — loop
  let ambientSrc = null;
  function ambientStart() {
    if (!actx) return;
    ambientSrc = actx.createBufferSource();
    ambientSrc.buffer = getNoiseBuffer();
    ambientSrc.loop = true;
    const filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, now());
    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.02, now());
    ambientSrc.connect(filter);
    filter.connect(gain);
    gain.connect(actx.destination);
    ambientSrc.start();
  }
  function ambientStop() {
    if (ambientSrc) { try { ambientSrc.stop(); } catch(e) {} ambientSrc = null; }
  }

  // Level Select: Satisfying mechanical "chunk" — 150ms
  function levelSelect() {
    if (!actx) return;
    playNoise(0.15, 400, 0.2);
    playTone(250, "square", 0.04, 0.15);
  }

  return {
    init, unlock,
    placement, slideStart, slideUpdate, slideStop,
    nearMiss, cluster, chainReaction,
    victory, defeat,
    thinkingStart, thinkingStop,
    ambientStart, ambientStop,
    levelSelect,
  };
})();
