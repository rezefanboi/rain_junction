'use strict';
/* ============================================================================
 * ENDLESS RAIN — utils.js
 * Shared math helpers, deterministic PRNG, and the color palette.
 * OVERHAUL: Sky, road, fog, and rain colors shifted to a gloomy dusk/night
 * palette. The previous near-white grays caused the white-screen rendering bug.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.Util = {
  lerp(a, b, t) { return a + (b - a) * t; },
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  damp(a, b, lambda, dt) { return ER.Util.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
  deg2rad(d) { return (d * Math.PI) / 180; },
  rad2deg(r) { return (r * 180) / Math.PI; },
  // Deterministic PRNG (mulberry32) so world chunks regenerate identically.
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
// Palette — gloomy dusk evening, cold and damp.
// Dark sky is the foundation everything else builds on.
// ---------------------------------------------------------------------------
ER.Palette = {
  sky: ['#1a1f2e', '#2d3448'],      // deep slate blue — replaces the old white grays
  fogFar: 'rgba(180,190,205,0.40)',
  fogNear: 'rgba(200,210,218,0.18)',
  mountains: '#3d4557',
  road: '#232529',                   // very dark asphalt
  roadLine: '#35373d',
  offWhite: '#eceae6',
  warmWhite: '#e3e0da',
  lightGray: '#c7c8ca',
  coolGray: '#9a9d9f',
  darkGray: '#5f6263',
  charcoal: '#3c3e3f',
  green: '#4a5c4a',
  greenDark: '#394839',
  puddle: '#3a4550',
  window: '#c4a96f',                 // warm amber for lit windows
  skin: '#d4c4b8',
  hair: '#1a1a1b',
};
