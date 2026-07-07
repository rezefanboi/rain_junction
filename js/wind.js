'use strict';
/* ============================================================================
 * ENDLESS RAIN — wind.js
 * Smoothly evolving wind direction that drives the rain's fall angle.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.WindSystem = class WindSystem {
  constructor() {
    this.states = [
      { name: 'Far Left', angle: -58 },
      { name: 'Left', angle: -38 },
      { name: 'Slight Left', angle: -16 },
      { name: 'Vertical', angle: 0 },
      { name: 'Slight Right', angle: 16 },
      { name: 'Right', angle: 38 },
      { name: 'Far Right', angle: 58 },
    ];
    this.stateIndex = 3;
    this.targetAngle = 0;
    this.angle = 0; // current interpolated angle (degrees from vertical)
    this.gustStrength = 0; // 0..1, purely cosmetic (sway amount)
    this._timer = ER.Util.range(Math.random, 5, 9);
  }

  update(dt) {
    this._timer -= dt;
    if (this._timer <= 0) {
      let next = this.stateIndex;
      while (next === this.stateIndex) next = Math.floor(Math.random() * this.states.length);
      this.stateIndex = next;
      this.targetAngle = this.states[next].angle;
      this._timer = ER.Util.range(Math.random, 6, 11);
    }
    this.angle = ER.Util.damp(this.angle, this.targetAngle, 0.6, dt);
    this.gustStrength = ER.Util.damp(this.gustStrength, Math.abs(this.targetAngle - this.angle) / 60, 3, dt);
  }

  get stateName() { return this.states[this.stateIndex].name; }
  /** Unit vector describing incoming rain direction (falling toward +y). */
  get direction() {
    const rad = ER.Util.deg2rad(this.angle);
    return { x: -Math.sin(rad), y: Math.cos(rad) };
  }
};
