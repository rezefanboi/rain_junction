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
            var _a, _b, _c, _d;
            if (e.target.closest('.social-icon'))
                return;
            (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a);
            (_d = (_c = this.cb).onStart) === null || _d === void 0 ? void 0 : _d.call(_c);
        });
        this.titleScreen.addEventListener('touchend', (e) => {
            var _a, _b, _c, _d;
            if (e.target.closest('.social-icon'))
                return;
            e.preventDefault();
            (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a);
            (_d = (_c = this.cb).onStart) === null || _d === void 0 ? void 0 : _d.call(_c);
        }, { passive: false });
        this.resumeBtn.addEventListener('click', () => { var _a, _b, _c, _d; (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a); this.setPaused(false); (_d = (_c = this.cb).onResume) === null || _d === void 0 ? void 0 : _d.call(_c); });
        this.retryBtn.addEventListener('click', () => { var _a, _b, _c, _d; (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a); (_d = (_c = this.cb).onRetry) === null || _d === void 0 ? void 0 : _d.call(_c); });
        this.mainMenuBtn.addEventListener('click', () => { var _a, _b, _c, _d; (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a); (_d = (_c = this.cb).onMainMenu) === null || _d === void 0 ? void 0 : _d.call(_c); });
        this.pauseRow.addEventListener('click', () => { var _a, _b; (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a); this.setPaused(true); this._closeMenu(); });
        this.muteRow.addEventListener('click', () => { var _a, _b; (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a); this.toggleMute(); });
        this.fullscreenRow.addEventListener('click', () => { var _a, _b; (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a); this.toggleFullscreen(); });
        this.quitRow.addEventListener('click', () => { var _a, _b, _c, _d; (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a); this._closeMenu(); (_d = (_c = this.cb).onMainMenu) === null || _d === void 0 ? void 0 : _d.call(_c); });
        this.menuBtn.addEventListener('click', (e) => {
            var _a, _b;
            e.stopPropagation();
            (_b = (_a = this.cb).onUiTap) === null || _b === void 0 ? void 0 : _b.call(_a);
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
        var _a, _b, _c;
        this._closeMenu();
        if (!document.fullscreenElement)
            (_b = (_a = document.documentElement).requestFullscreen) === null || _b === void 0 ? void 0 : _b.call(_a);
        else
            (_c = document.exitFullscreen) === null || _c === void 0 ? void 0 : _c.call(document);
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
//# sourceMappingURL=ui.js.map