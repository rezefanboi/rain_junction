'use strict';
/* ============================================================================
 * ENDLESS RAIN — main.js
 * Single entry point. Waits for the DOM, then constructs the Game.
 * Nothing else lives here.
 * ==========================================================================*/
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  window._game = new ER.Game(canvas);
});
