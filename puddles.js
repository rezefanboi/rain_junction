'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — puddles.js
 * PuddleSystem — the architecture comment at the top of the original file
 * always listed a PuddleSystem alongside VehicleSystem and AmbientSystem,
 * but puddles were purely decorative; this fills that gap in.
 *
 * A puddle is "in range" while the player's worldX overlaps its width (plus
 * a small forgiveness margin). If the player is airborne (isJumping) at any
 * point during that overlap, the puddle is marked cleared — no penalty. If
 * the player passes all the way through without ever having jumped, it's a
 * miss: a small, forgiving dryness cost and a small splash, nothing more.
 *
 * Puddles are rare (see world.js) on purpose — the player should mostly
 * forget they exist until one quietly appears.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.PuddleSystem = class PuddleSystem {
  constructor() {
    this.margin = 6;     // small forgiveness so jump timing needn't be pixel-perfect
    this.missPenalty = 5; // small, non-punishing dryness cost for a missed puddle
  }

  update(player, visiblePuddles, onMiss, onClear) {
    const x = player.worldX;
    for (const p of visiblePuddles) {
      const src = p._src;
      if (!src || src.resolved) continue;

      const rangeMin = p.worldX - p.width / 2 - this.margin;
      const rangeMax = p.worldX + p.width / 2 + this.margin;

      if (x < rangeMin) continue;

      if (x <= rangeMax) {
        if (player.isJumping) { src.resolved = true; src.cleared = true; onClear?.(p); }
      } else {
        // Passed all the way through without ever having jumped over it.
        src.resolved = true;
        onMiss(p);
      }
    }
  }
};
