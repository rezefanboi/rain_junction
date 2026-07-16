'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — ambient.js
 * Purely cosmetic world-life moments — no gameplay impact. Deliberately
 * restrained: gentle fog pulses only. The street is meant to feel a little
 * empty; that quiet is part of the mood, not a gap to fill.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.AmbientSystem = class AmbientSystem {
  fogPulse: any;
  _fogTimer: any;
  fogBoost: any;
  _thunderTimer: any;
  lightningFlash: any;
  thunderStruck: any;

  constructor() {
    this.fogPulse = 0;
    this._fogTimer = ER.Util.range(Math.random, 14, 26);
    this.fogBoost = 0;

    this._thunderTimer = ER.Util.range(Math.random, 20, 40);
    this.lightningFlash = 0;   // 0..1, decays after each strike — read by the renderer
    this.thunderStruck = false; // one-frame flag the game loop consumes to fire audio
  }

  update(dt) {
    this.fogPulse += dt;
    this._fogTimer -= dt;
    if (this._fogTimer <= 0) {
      this._fogTimer = ER.Util.range(Math.random, 16, 30);
      this.fogBoost = 1;
    }
    this.fogBoost = ER.Util.damp(this.fogBoost, 0, 0.15, dt);

    this.thunderStruck = false;
    this._thunderTimer -= dt;
    if (this._thunderTimer <= 0) {
      this._thunderTimer = ER.Util.range(Math.random, 24, 48);
      this.lightningFlash = 1;
      this.thunderStruck = true;
    }
    this.lightningFlash = ER.Util.damp(this.lightningFlash, 0, 5, dt);
  }
};
