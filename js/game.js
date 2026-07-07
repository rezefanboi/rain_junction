'use strict';
/* ============================================================================
 * ENDLESS RAIN — game.js
 * OVERHAUL changes:
 *  - Added 'menu' state. Game starts paused on the main menu; gameplay only
 *    begins once the player clicks Play.
 *  - Added _goToMenu(): tears down live state, rebuilds fresh, shows menu.
 *  - UIManager now receives a third callback (onMenu) for "Back to menu".
 *  - Audio, wind and ambient begin running on the first frame so the main
 *    menu has live rain behind it — but collision and player movement only
 *    run while state === 'playing'.
 *  - HUD is initially hidden; UIManager._revealHUD() is called by the Play
 *    button handler inside UIManager itself.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.Game = class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d', { alpha: false });
    this.dpr    = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0; this.h = 0;

    this.input  = new ER.InputManager();
    this.audio  = new ER.AudioManager();
    this.renderer = new ER.Renderer(this.ctx);
    this.ui = new ER.UIManager(
      () => this._resumeClock(),         // onResume
      () => this._restart(),             // onRestart
      () => this._goToMenu(),            // onMenu (Back to menu button)
    );

    this.baselineFrac = 0.6;
    this._fixedDt     = 1 / 120;
    this._accumulator = 0;
    this._lastTime    = performance.now();

    this._buildFreshState();

    // Touch / keyboard setup — but don't reveal HUD yet (menu is showing)
    if (this.input.isTouch) {
      document.getElementById('touch-controls').classList.add('visible');
    } else {
      // Hint will show once Play is clicked — wired via UIManager
    }

    // Wire Play button to actually start the game loop logic
    document.getElementById('btn-play').addEventListener('click', () => {
      this.state = 'playing';
      this._resumeClock();
      if (!this.input.isTouch) this.ui.showHint();
    });

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.ui.setPaused(true);
    });

    this.resize();
    requestAnimationFrame((t) => this._loop(t));
  }

  // ── State construction ──────────────────────────────────────────────────────
  _buildFreshState() {
    this.wind      = new ER.WindSystem();
    this.player    = new ER.Player();
    this.camera    = new ER.Camera();
    this.world     = new ER.WorldGenerator();
    this.rain      = new ER.RainSystem(Math.random);
    this.vehicles  = new ER.VehicleSystem();
    this.puddles   = new ER.PuddleSystem();
    this.ambient   = new ER.AmbientSystem();
    this.collisions= new ER.CollisionManager();

    this.elapsed = 0;
    this.state   = 'menu';      // 'menu' | 'playing' | 'ended'
    this._visible      = null;
    this._playerScreen = null;

    if (this.w && this.h) this.rain.resize(this.w, this.h);
  }

  // ── Resize ──────────────────────────────────────────────────────────────────
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.w = rect.width; this.h = rect.height;
    this.canvas.width  = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width  = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.rain.resize(this.w, this.h);
  }

  // ── Clock helpers ───────────────────────────────────────────────────────────
  _resumeClock() { this._lastTime = performance.now(); }

  // ── Restart (replay from scratch, same session) ─────────────────────────────
  _restart() {
    this._buildFreshState();
    this.state = 'playing';
    this._resumeClock();
    this.ui._revealHUD();
  }

  // ── Back to menu ────────────────────────────────────────────────────────────
  _goToMenu() {
    this._buildFreshState();   // fresh world, state='menu'
    this._resumeClock();
    this.ui.showMenu();
  }

  // ── Main loop ───────────────────────────────────────────────────────────────
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    dt = Math.min(dt, 0.1);

    if (this.ui.paused) return;

    this._accumulator += dt;
    while (this._accumulator >= this._fixedDt) {
      this._update(this._fixedDt);
      this._accumulator -= this._fixedDt;
    }
    this._render();
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  _update(dt) {
    // Wind, ambient and rain always run — the world doesn't stop for the menu
    this.wind.update(dt);
    this.ambient.update(dt);

    if (this.state === 'playing') {
      this.elapsed += dt;
      this._updatePlaying(dt);
    } else if (this.state === 'ended') {
      this.player.settle(dt);
    }
    // In 'menu' state: world is static, only atmosphere runs

    const camDeltaX = this.camera.deltaX;
    this.rain.update(dt, this.wind, camDeltaX);

    const px = this.renderer.worldToScreenX(this.camera, this.player.worldX);
    const py = this.renderer.roadScreenY(this.camera, this.player.worldX, this.h, this.baselineFrac) + 30;

    if (this.state === 'playing') {
      this.collisions.resolve(this.player, this.rain, px, py);
      if (this.player.dryness <= 0) this._triggerEnding();
    }
    this._playerScreen = { x: px, y: py };
  }

  _updatePlaying(dt) {
    const jumpPressed = this.input.consumeJump();
    this.player.update(dt, this.input.axis, jumpPressed);
    this.camera.update(dt, this.player, this.w);

    const viewMinX = this.camera.x - 150;
    const viewMaxX = this.camera.x + this.w + 150;
    this.world.ensureRange(viewMinX, viewMaxX);
    const visible = this.world.collectVisible(viewMinX, viewMaxX);

    this.vehicles.update(dt, viewMinX, viewMaxX, visible.puddles, (puddleWorldX, dir) => {
      const sx = this.renderer.worldToScreenX(this.camera, puddleWorldX);
      const sy = this.renderer.roadScreenY(this.camera, puddleWorldX, this.h, this.baselineFrac) + 20;
      this.rain.spawnSplash(sx, sy, -dir, 16, 1.6);
      this.audio.playSplash();
      const ppx = this.renderer.worldToScreenX(this.camera, this.player.worldX);
      const ppy = this.renderer.roadScreenY(this.camera, this.player.worldX, this.h, this.baselineFrac) + 30;
      this.collisions.resolveCarSplash(this.player, ppx, ppy, sx, sy);
    });

    this.puddles.update(this.player, visible.puddles, (p) => {
      const sx = this.renderer.worldToScreenX(this.camera, p.worldX);
      const sy = this.renderer.roadScreenY(this.camera, p.worldX, this.h, this.baselineFrac) + 20;
      this.rain.spawnSplash(sx, sy, 0, 8, 1.2);
      this.audio.playSplash();
      this.player.addWetness(this.puddles.missPenalty);
    });

    this._visible = visible;
  }

  // ── Ending ──────────────────────────────────────────────────────────────────
  _triggerEnding() {
    this.state = 'ended';
    this.player.frozen = true;
    const distance = this.player.worldX / 12;
    this.ui.showEnding(distance, this.elapsed);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  _render() {
    const { ctx, w, h } = this;
    this.renderer.clear(w, h);
    this.renderer.drawMountains(this.camera, w, h, this.baselineFrac);
    this.renderer.drawFog(w, h, this.ambient.fogBoost);
    this.rain.renderLayer(ctx, 'bg', ER.Palette.coolGray);

    this.renderer.drawGuardrail(this.camera, w, h, this.baselineFrac);
    this.renderer.drawRoad(this.camera, w, h, this.baselineFrac);
    this.renderer.drawPolesAndWires(this.camera, w, h, this.baselineFrac, this.elapsed);

    const visible = this._visible;
    if (visible) {
      for (const p of visible.puddles) {
        const sx = this.renderer.worldToScreenX(this.camera, p.worldX);
        const sy = this.renderer.roadScreenY(this.camera, p.worldX, h, this.baselineFrac) + 20;
        this.renderer.drawPuddle(sx, sy, p, this.elapsed);
      }
      for (const o of visible.objects) {
        const sx = this.renderer.worldToScreenX(this.camera, o.worldX);
        if (sx < -120 || sx > w + 120) continue;
        const roadY = this.renderer.roadScreenY(this.camera, o.worldX, h, this.baselineFrac);
        const sy = o.side > 0 ? roadY - 6 : roadY + 30;
        this.renderer.drawObject(o, sx, sy, this.elapsed);
      }
      for (const a of visible.ambientEvents) {
        const sx = this.renderer.worldToScreenX(this.camera, a.worldX);
        if (sx < -60 || sx > w + 60) continue;
        const roadY = this.renderer.roadScreenY(this.camera, a.worldX, h, this.baselineFrac);
        this.renderer.drawAmbient(a.type, sx, roadY - 4, this.elapsed);
      }
    }

    for (const car of this.vehicles.cars) {
      const sx = this.renderer.worldToScreenX(this.camera, car.worldX);
      if (sx < -80 || sx > w + 80) continue;
      const roadY = this.renderer.roadScreenY(this.camera, car.worldX, h, this.baselineFrac);
      this.renderer.drawVehicle(sx, roadY + 14, car);
    }

    this.rain.renderLayer(ctx, 'mid', ER.Palette.darkGray);
    if (this._playerScreen) {
      this.renderer.drawPlayer(this._playerScreen.x, this._playerScreen.y, this.player, this.wind);
    }
    this.rain.renderSplashes(ctx, ER.Palette.offWhite);
    this.rain.renderLayer(ctx, 'fg', ER.Palette.charcoal);

    if (this.state === 'playing') {
      this.ui.update(this.player.worldX / 12, this.player.dryness, this.elapsed);
    }
  }
};
