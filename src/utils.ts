'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — utils.js
 * Shared math helpers, deterministic PRNG, and the muted dusk palette.
 * Everything hangs off the single `ER` namespace so the game can run as
 * plain <script> tags with no bundler.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.Util = {
  lerp(a, b, t) { return a + (b - a) * t; },
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  damp(a, b, lambda, dt) { return ER.Util.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
  deg2rad(d) { return (d * Math.PI) / 180; },
  rad2deg(r) { return (r * 180) / Math.PI; },
  // Deterministic PRNG (mulberry32) so world chunks regenerate identically forever.
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; },
  range(rng, lo, hi) { return lo + rng() * (hi - lo); },
  formatClock(seconds) {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  },
};

// ---------------------------------------------------------------------------
// Palette — soft, desaturated dusk-blue and charcoal, one muted green accent
// for foliage and warm lamplight for cozy contrast against the gloom.
// ---------------------------------------------------------------------------
ER.Palette = {
  sky: ['#3d4759', '#7d8794'],
  fogFar: 'rgba(148,157,171,0.45)',
  fogNear: 'rgba(180,187,196,0.30)',
  mountains: '#4b566b',
  road: '#474d59',
  ground: '#687587',
  roadLine: '#8b93a0',
  curb: '#5a616d',
  offWhite: '#e6e8ec',
  warmWhite: '#dcd6c8',
  lightGray: '#a7adb8',
  coolGray: '#7d8591',
  darkGray: '#4a505c',
  charcoal: '#24272f',
  green: '#6d8177',
  greenDark: '#546156',
  puddle: '#5f6b7a',
  window: '#f0d9a3',
  skin: '#e4d8cc',
  hair: '#1b1d22',
  lightning: '#eef2f6',
  accent: '#8fa3bd',
};
