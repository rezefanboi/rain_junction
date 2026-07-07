'use strict';
/* ============================================================================
 * ENDLESS RAIN — player.js
 * Continuously auto-walks forward; the umbrella tilt and the jump are the
 * only inputs. New in this pass: a quick, floaty jump (for clearing puddles)
 * and a settle() routine that eases the walk pose to rest for the ending,
 * instead of freezing mid-stride.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.Player = class Player {
  constructor() {
    this.worldX = 0;
    this.speed = 118; // world units per second
    this.walkCycle = 0;
    this.bob = 0;
    this.legSwing = 0;
    this.wetness = 0; // 0..100
    this.umbrella = new ER.Umbrella();

    this.isJumping = false;
    this.jumpT = 0;
    this.jumpDuration = 0.42; // quick
    this.jumpHeight = 30;     // small

    this.frozen = false; // true once dryness hits zero
  }

  get groundY() { return ER.Road.elevation(this.worldX); }

  /** Smooth vertical arc, small and floaty — not an arcade hop. */
  get jumpOffset() {
    if (!this.isJumping) return 0;
    const t = ER.Util.clamp(this.jumpT / this.jumpDuration, 0, 1);
    return Math.sin(t * Math.PI) * this.jumpHeight;
  }

  requestJump() {
    if (this.isJumping || this.frozen) return;
    this.isJumping = true;
    this.jumpT = 0;
  }

  update(dt, axis, jumpPressed) {
    if (this.frozen) return;

    this.worldX += this.speed * dt;
    this.walkCycle += dt * (this.speed / 18);
    this.bob = Math.sin(this.walkCycle * 2) * 3.2;
    this.legSwing = Math.sin(this.walkCycle * 2) * 10;
    this.umbrella.update(dt, axis);

    if (jumpPressed) this.requestJump();
    if (this.isJumping) {
      this.jumpT += dt;
      if (this.jumpT >= this.jumpDuration) { this.isJumping = false; this.jumpT = 0; }
    }

    // Dryness recovers slowly when not being rained on directly.
    this.wetness = ER.Util.clamp(this.wetness - dt * 3.4, 0, 100);
  }

  /** Called instead of update() once frozen — eases the pose to a calm stand, no movement. */
  settle(dt) {
    this.bob = ER.Util.damp(this.bob, 0, 6, dt);
    this.legSwing = ER.Util.damp(this.legSwing, 0, 6, dt);
  }

  addWetness(amount) { this.wetness = ER.Util.clamp(this.wetness + amount, 0, 100); }
  get dryness() { return Math.round(100 - this.wetness); }
};
