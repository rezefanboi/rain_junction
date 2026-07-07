'use strict';
/* ============================================================================
 * ENDLESS RAIN — collision.js
 * Resolves raindrops/splashes vs. umbrella vs. player body. The umbrella
 * fairness fix lives in Umbrella.shields() (umbrella.js) — this manager is
 * unchanged aside from relying on that corrected test.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.CollisionManager = class CollisionManager {
  constructor() {
    this.checkRadius = 70;
    this.bodyHalfWidth = 15;
    this.bodyTop = 68;   // px above feet
    this.pivotUp = 50;   // umbrella pivot height above feet
  }

  resolve(player, rain, px, py) {
    const pivotX = px, pivotY = py - this.pivotUp;
    const bodyMinX = px - this.bodyHalfWidth, bodyMaxX = px + this.bodyHalfWidth;
    const bodyMinY = py - this.bodyTop, bodyMaxY = py + 6;
    let hits = 0;

    for (const key of ['mid', 'fg']) {
      const L = rain.layers[key];
      for (let i = 0; i < L.count; i++) {
        if (L.hit[i]) continue;
        const x = L.x[i], y = L.y[i];
        if (x < px - this.checkRadius || x > px + this.checkRadius) continue;
        if (y < bodyMinY - 40 || y > bodyMaxY) continue;
        if (player.umbrella.shields(x - pivotX, y - pivotY)) { L.hit[i] = 1; continue; }
        if (x >= bodyMinX && x <= bodyMaxX && y >= bodyMinY && y <= bodyMaxY) {
          L.hit[i] = 1;
          hits++;
        }
      }
    }

    for (const p of rain.splashes) {
      if (!p.active || p.scored) continue;
      if (p.x < px - this.checkRadius || p.x > px + this.checkRadius) continue;
      if (p.y < bodyMinY - 20 || p.y > bodyMaxY + 10) continue;
      if (player.umbrella.shields(p.x - pivotX, p.y - pivotY)) { p.scored = true; continue; }
      if (p.x >= bodyMinX && p.x <= bodyMaxX && p.y >= bodyMinY - 10 && p.y <= bodyMaxY + 10) {
        p.scored = true;
        hits += 1.4;
      }
    }

    if (hits > 0) player.addWetness(hits * 1.6);
  }

  /**
   * A rare, larger splash (car through a puddle) — only wets the player if
   * they're nearby AND not shielded. Kept small and rare on purpose.
   */
  resolveCarSplash(player, px, py, splashSx, splashSy) {
    const dx = splashSx - px, dy = splashSy - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 95) return;
    const pivotX = px, pivotY = py - this.pivotUp;
    if (player.umbrella.shields(splashSx - pivotX, splashSy - pivotY)) return;
    player.addWetness(4);
  }
};
