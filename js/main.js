'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — main.js
 * Bootstrap. Everything else attaches itself to window.ER; this just wires
 * it to the canvas once the DOM is ready.
 * ==========================================================================*/
(function () {
  function start() {
    const canvas = document.getElementById('canvas');
    const game = new ER.Game(canvas);
    window.game = game; // handy for console debugging
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
