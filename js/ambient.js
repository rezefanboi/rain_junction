'use strict';
/* ============================================================================
 * ENDLESS RAIN — ambient.js
 * Purely cosmetic world-life moments — no gameplay impact. Deliberately
 * restrained: gentle fog pulses only. The street is meant to feel a little
 * empty; that quiet is part of the mood, not a gap to fill.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.AmbientSystem = class AmbientSystem {
  constructor() {
    this.fogPulse = 0;
    this._fogTimer = ER.Util.range(Math.random, 14, 26);
    this.fogBoost = 0;
  }

  update(dt) {
    this.fogPulse += dt;
    this._fogTimer -= dt;
    if (this._fogTimer <= 0) {
      this._fogTimer = ER.Util.range(Math.random, 16, 30);
      this.fogBoost = 1;
    }
    this.fogBoost = ER.Util.damp(this.fogBoost, 0, 0.15, dt);
  }
};
