'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — road.js
 * Continuous procedural elevation function shared by world + camera + player.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.Road = {
  // Sum of gentle sine waves = smooth hills, always continuous & differentiable.
  elevation(x) {
    return (
      Math.sin(x * 0.0012) * 46 +
      Math.sin(x * 0.0037 + 1.7) * 22 +
      Math.sin(x * 0.0009 + 4.1) * 30
    );
  },
  slope(x) {
    const h = 4;
    return (ER.Road.elevation(x + h) - ER.Road.elevation(x - h)) / (2 * h);
  },
};
