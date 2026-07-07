'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — input.js
 * Keyboard (desktop) + touch buttons (mobile), auto-detected. The umbrella
 * axis is held (left/right), the jump is a discrete, edge-triggered press
 * so holding the key down doesn't spam jumps.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.InputManager = class InputManager {
  constructor() {
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.left = false;
    this.right = false;
    this._jumpQueued = false;

    this._onKeyDown = (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = true;
      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        this._jumpQueued = true;
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this._bindTouchButton('btn-left', (v) => (this.left = v));
    this._bindTouchButton('btn-right', (v) => (this.right = v));
    this._bindTouchTap('btn-jump', () => { this._jumpQueued = true; });
  }

  _bindTouchButton(id, setter) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => { e.preventDefault(); setter(true); el.classList.add('active'); };
    const up = (e) => { e.preventDefault(); setter(false); el.classList.remove('active'); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
  }

  _bindTouchTap(id, onTap) {
    const el = document.getElementById(id);
    if (!el) return;
    const fire = (e) => {
      e.preventDefault();
      onTap();
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 140);
    };
    el.addEventListener('touchstart', fire, { passive: false });
    el.addEventListener('mousedown', fire);
  }

  /** -1 = tilt left, 1 = tilt right, 0 = neutral */
  get axis() {
    if (this.left && !this.right) return -1;
    if (this.right && !this.left) return 1;
    return 0;
  }

  /** Consumes the queued jump press exactly once (edge-triggered). */
  consumeJump() {
    if (!this._jumpQueued) return false;
    this._jumpQueued = false;
    return true;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
};
