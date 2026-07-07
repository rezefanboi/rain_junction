'use strict';
/* ============================================================================
 * ENDLESS RAIN — ui.js
 * OVERHAUL changes:
 *  - Main menu (#main-menu) shown on load; hidden when Play is clicked.
 *  - HUD (#hud-left, #hud-right) starts hidden, revealed when gameplay begins.
 *  - End screen gains a "Back to menu" button (#btn-to-menu).
 *  - Social tab removed from gameplay entirely (links live in main menu only).
 *  - Game title removed from HUD — gameplay belongs to the player.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.UIManager = class UIManager {
  constructor(onResume, onRestart, onMenu) {
    // HUD elements
    this.distanceEl  = document.getElementById('hud-distance');
    this.drynessEl   = document.getElementById('hud-dryness');
    this.timeEl      = document.getElementById('hud-time');
    this.hudLeft     = document.getElementById('hud-left');
    this.hudRight    = document.getElementById('hud-right');

    // Pause
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.resumeBtn    = document.getElementById('btn-resume');
    this.hint         = document.getElementById('keyboard-hint');

    // Settings dropdown
    this.menuBtn        = document.getElementById('btn-menu');
    this.menuPanel      = document.getElementById('menu-panel');
    this.pauseRow       = document.getElementById('menu-pause');
    this.muteRow        = document.getElementById('menu-mute');
    this.fullscreenRow  = document.getElementById('menu-fullscreen');

    // Main menu
    this.mainMenu = document.getElementById('main-menu');
    this.playBtn  = document.getElementById('btn-play');

    // End screen
    this.endOverlay    = document.getElementById('end-overlay');
    this.endDistanceEl = document.getElementById('end-distance');
    this.endTimeEl     = document.getElementById('end-time');
    this.restartBtn    = document.getElementById('btn-restart');
    this.toMenuBtn     = document.getElementById('btn-to-menu');

    this.paused = false;
    this.muted  = false;

    // --- Wiring ---
    this.playBtn.addEventListener('click', () => {
      this.hideMenu();
      this._revealHUD();
    });

    this.resumeBtn.addEventListener('click', () => {
      this.setPaused(false);
      onResume();
    });

    this.restartBtn.addEventListener('click', () => {
      this.hideEnding();
      onRestart();
    });

    this.toMenuBtn.addEventListener('click', () => {
      this.hideEnding();
      this._hideHUD();
      onMenu();
    });

    this.pauseRow.addEventListener('click',      () => { this.setPaused(true); this._closeDropdown(); });
    this.muteRow.addEventListener('click',       () => this.toggleMute());
    this.fullscreenRow.addEventListener('click', () => this.toggleFullscreen());

    this.menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.menuPanel.classList.toggle('open');
    });

    document.addEventListener('click', () => this._closeDropdown());
    this.menuPanel.addEventListener('click', (e) => e.stopPropagation());

    this._hintTimer = null;
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  showMenu() {
    this.mainMenu.classList.remove('hidden');
  }

  hideMenu() {
    this.mainMenu.classList.add('hidden');
  }

  // ── HUD visibility ─────────────────────────────────────────────────────────
  _revealHUD() {
    this.hudLeft.classList.add('visible');
    this.hudRight.classList.add('visible');
  }

  _hideHUD() {
    this.hudLeft.classList.remove('visible');
    this.hudRight.classList.remove('visible');
  }

  // ── Hint ───────────────────────────────────────────────────────────────────
  showHint() {
    this.hint.classList.add('visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hint.classList.remove('visible'), 7000);
  }

  // ── Dropdown ───────────────────────────────────────────────────────────────
  _closeDropdown() {
    this.menuPanel.classList.remove('open');
  }

  // ── Fullscreen / mute ──────────────────────────────────────────────────────
  toggleFullscreen() {
    this._closeDropdown();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.muteRow.querySelector('.menu-row-label').textContent =
      this.muted ? 'Sound: off' : 'Sound: on';
    this._closeDropdown();
    return this.muted;
  }

  // ── Pause ──────────────────────────────────────────────────────────────────
  setPaused(v) {
    this.paused = v;
    this.pauseOverlay.classList.toggle('visible', v);
  }

  // ── HUD update (called every render frame) ─────────────────────────────────
  update(distanceMeters, dryness, seconds) {
    this.distanceEl.textContent = `${distanceMeters.toFixed(0)} m`;
    this.drynessEl.textContent  = `${dryness}%`;
    this.drynessEl.style.color  = dryness < 30 ? '#f4a69a' : '';
    this.timeEl.textContent     = ER.Util.formatClock(seconds);
  }

  // ── End screen ─────────────────────────────────────────────────────────────
  showEnding(distanceMeters, seconds) {
    this.endDistanceEl.textContent = `${distanceMeters.toFixed(0)} m`;
    this.endTimeEl.textContent     = ER.Util.formatClock(seconds);
    this.endOverlay.classList.add('visible');
  }

  hideEnding() {
    this.endOverlay.classList.remove('visible');
  }
};
