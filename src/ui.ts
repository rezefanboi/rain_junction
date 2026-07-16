'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — ui.js
 * All DOM-facing logic: the title screen (tap-anywhere-to-start, social
 * links live only here), the in-game HUD, the settings menu, the pause
 * card, and a dedicated Game Over screen with Retry / Main Menu.
 *
 * `frame.dataset.state` drives almost all of the visibility in CSS
 * ('title' | 'playing' | 'ended'), so this class mostly just flips that
 * attribute and wires up button callbacks — it doesn't fight the CSS.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.UIManager = class UIManager {
  cb: any;
  frame: any;
  titleScreen: any;
  distanceEl: any;
  drynessEl: any;
  timeEl: any;
  pauseOverlay: any;
  resumeBtn: any;
  hint: any;
  menuBtn: any;
  menuPanel: any;
  pauseRow: any;
  muteRow: any;
  fullscreenRow: any;
  quitRow: any;
  gameOverScreen: any;
  endScoreEl: any;
  endDistanceEl: any;
  endTimeEl: any;
  retryBtn: any;
  mainMenuBtn: any;
  paused: any;
  muted: any;
  _hintTimer: any;

  constructor(callbacks) {
    // callbacks: { onStart, onResume, onRetry, onMainMenu, onUiTap }
    this.cb = callbacks;

    this.frame = document.getElementById('frame');
    this.titleScreen = document.getElementById('title-screen');

    this.distanceEl = document.getElementById('hud-distance');
    this.drynessEl = document.getElementById('hud-dryness');
    this.timeEl = document.getElementById('hud-time');

    this.pauseOverlay = document.getElementById('pause-overlay');
    this.resumeBtn = document.getElementById('btn-resume');
    this.hint = document.getElementById('keyboard-hint');

    this.menuBtn = document.getElementById('btn-menu');
    this.menuPanel = document.getElementById('menu-panel');
    this.pauseRow = document.getElementById('menu-pause');
    this.muteRow = document.getElementById('menu-mute');
    this.fullscreenRow = document.getElementById('menu-fullscreen');
    this.quitRow = document.getElementById('menu-quit');

    this.gameOverScreen = document.getElementById('gameover-screen');
    this.endScoreEl = document.getElementById('end-score');
    this.endDistanceEl = document.getElementById('end-distance');
    this.endTimeEl = document.getElementById('end-time');
    this.retryBtn = document.getElementById('btn-retry');
    this.mainMenuBtn = document.getElementById('btn-mainmenu');

    this.paused = false;
    this.muted = false;

    // Tap/click anywhere on the title screen (but not on a social link) starts the game.
    this.titleScreen.addEventListener('click', (e) => {
      if (e.target.closest('.social-icon')) return;
      this.cb.onUiTap?.();
      this.cb.onStart?.();
    });
    this.titleScreen.addEventListener('touchend', (e) => {
      if (e.target.closest('.social-icon')) return;
      e.preventDefault();
      this.cb.onUiTap?.();
      this.cb.onStart?.();
    }, { passive: false });

    this.resumeBtn.addEventListener('click', () => { this.cb.onUiTap?.(); this.setPaused(false); this.cb.onResume?.(); });
    this.retryBtn.addEventListener('click', () => { this.cb.onUiTap?.(); this.cb.onRetry?.(); });
    this.mainMenuBtn.addEventListener('click', () => { this.cb.onUiTap?.(); this.cb.onMainMenu?.(); });

    this.pauseRow.addEventListener('click', () => { this.cb.onUiTap?.(); this.setPaused(true); this._closeMenu(); });
    this.muteRow.addEventListener('click', () => { this.cb.onUiTap?.(); this.toggleMute(); });
    this.fullscreenRow.addEventListener('click', () => { this.cb.onUiTap?.(); this.toggleFullscreen(); });
    this.quitRow.addEventListener('click', () => { this.cb.onUiTap?.(); this._closeMenu(); this.cb.onMainMenu?.(); });

    this.menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cb.onUiTap?.();
      this.menuPanel.classList.toggle('open');
    });
    document.addEventListener('click', () => this._closeMenu());
    this.menuPanel.addEventListener('click', (e) => e.stopPropagation());

    this._hintTimer = null;
  }

  _closeMenu() { this.menuPanel.classList.remove('open'); }

  setState(state) { this.frame.dataset.state = state; }

  showHint() {
    this.hint.classList.add('visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hint.classList.remove('visible'), 7000);
  }

  toggleFullscreen() {
    this._closeMenu();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.muteRow.querySelector('.menu-row-label').textContent = this.muted ? 'Sound: off' : 'Sound: on';
    this._closeMenu();
    return this.muted;
  }

  setPaused(v) {
    this.paused = v;
    this.pauseOverlay.classList.toggle('visible', v);
  }

  update(distanceMeters, dryness, seconds) {
    this.distanceEl.textContent = `${distanceMeters.toFixed(0)} m`;
    this.drynessEl.textContent = `${dryness}%`;
    this.drynessEl.style.opacity = dryness < 40 ? '1' : '0.85';
    this.timeEl.textContent = ER.Util.formatClock(seconds);
  }

  showGameOver(score, distanceMeters, seconds) {
    this.endScoreEl.textContent = `${Math.round(score)}`;
    this.endDistanceEl.textContent = `${distanceMeters.toFixed(0)} m`;
    this.endTimeEl.textContent = ER.Util.formatClock(seconds);
    this.setState('ended');
  }
};
