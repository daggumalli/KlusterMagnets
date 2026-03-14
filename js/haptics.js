"use strict";

const Haptics = (function () {
  let capacitorHaptics = null;
  let useWebVibration = false;
  let enabled = true;
  let pulseTimer = null;

  function init() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
      capacitorHaptics = window.Capacitor.Plugins.Haptics;
    } else if (navigator.vibrate) {
      useWebVibration = true;
    }
  }

  function setEnabled(val) { enabled = val; }

  function impact(style) {
    if (!enabled) return;
    if (capacitorHaptics) {
      capacitorHaptics.impact({ style: style || "Heavy" });
    } else if (useWebVibration) {
      navigator.vibrate(style === "Light" ? 10 : style === "Medium" ? 25 : 50);
    }
  }

  function vibrate(duration) {
    if (!enabled) return;
    if (capacitorHaptics) {
      capacitorHaptics.vibrate({ duration: duration || 30 });
    } else if (useWebVibration) {
      navigator.vibrate(duration || 30);
    }
  }

  function stopPulse() {
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
  }

  function updateDragFeedback(dangerLevel) {
    if (!enabled) return;
    stopPulse();

    if (dangerLevel <= 0) return;

    if (dangerLevel < 0.33) {
      pulseTimer = setInterval(() => vibrate(10), 500);
    } else if (dangerLevel < 0.66) {
      pulseTimer = setInterval(() => vibrate(20), 125);
    } else {
      pulseTimer = setInterval(() => vibrate(40), 50);
    }
  }

  function clusterImpact() {
    stopPulse();
    impact("Heavy");
  }

  return {
    init, setEnabled, impact, vibrate,
    updateDragFeedback, stopPulse, clusterImpact,
  };
})();
