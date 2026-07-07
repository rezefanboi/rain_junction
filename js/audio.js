'use strict';
/* ============================================================================
 * ENDLESS RAIN — audio.js
 * Placeholder hooks only — no samples shipped yet. Kept as a real class so
 * dropping in a WebAudio backend later doesn't touch any calling code.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.AudioManager = class AudioManager {
  constructor() { this.muted = false; }
  playRainLoop() { /* placeholder: start looping rain ambience */ }
  playThunder() { /* placeholder: one-shot thunder rumble */ }
  playFootstep() { /* placeholder: single footstep tick */ }
  playWind() { /* placeholder: wind gust swell */ }
  playSplash() { /* placeholder: puddle splash, car or missed jump */ }
  playJump() { /* placeholder: quick soft jump foley */ }
  stopAllAudio() { /* placeholder: halt every voice */ }
  setMuted(m) { this.muted = m; }
};
