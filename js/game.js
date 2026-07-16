'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — game.js
 * Orchestrates the fixed-timestep loop and every subsystem, plus the three
 * screens the whole experience moves through:
 *
 *   title  → a blurred, softly animated preview of the world sits behind a
 *            cinematic title card. Tapping anywhere (off the social icons)
 *            starts the walk.
 *   playing→ the actual game: auto-walk, tilt the umbrella, jump puddles.
 *   ended  → a dedicated Game Over screen with score / distance / time and
 *            Retry + Main Menu, instead of dropping straight back to title.
 *
 * Rain, wind, and fog keep drifting in every state — the world doesn't stop
 * just because the player isn't moving through it yet (or ever again).
 * ==========================================================================*/
window.ER = window.ER || {};
ER.Game = class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = 0;
        this.h = 0;
        this.input = new ER.InputManager();
        this.audio = new ER.AudioManager();
        this.renderer = new ER.Renderer(this.ctx);
        this.ui = new ER.UIManager({
            onUiTap: () => this.audio.unlock(),
            onStart: () => this._startGame(),
            onResume: () => this._resumeClock(),
            onRetry: () => this._retry(),
            onMainMenu: () => this._goToMainMenu(),
        });
        this.baselineFrac = 0.6;
        this._fixedDt = 1 / 120;
        this._accumulator = 0;
        this._lastTime = performance.now();
        this.state = 'title'; // 'title' | 'playing' | 'ended'
        this._buildFreshState();
        this.ui.setState('title');
        if (this.input.isTouch) {
            document.getElementById('touch-controls').classList.add('visible');
        }
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing')
                this.ui.setPaused(true);
        });
        this.resize();
        requestAnimationFrame((t) => this._loop(t));
    }
    /** (Re)builds all mutable game state. Used by the constructor, retry, and main-menu. */
    _buildFreshState() {
        this.wind = new ER.WindSystem();
        this.player = new ER.Player();
        this.camera = new ER.Camera();
        this.world = new ER.WorldGenerator();
        this.rain = new ER.RainSystem(Math.random);
        this.vehicles = new ER.VehicleSystem();
        this.puddles = new ER.PuddleSystem();
        this.ambient = new ER.AmbientSystem();
        this.collisions = new ER.CollisionManager();
        this.elapsed = 0;
        this.puddlesCleared = 0;
        this._visible = null;
        this._playerScreen = null;
        if (this.w && this.h)
            this.rain.resize(this.w, this.h);
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.w = rect.width;
        this.h = rect.height;
        this.canvas.width = Math.round(this.w * this.dpr);
        this.canvas.height = Math.round(this.h * this.dpr);
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.rain.resize(this.w, this.h);
    }
    _resumeClock() { this._lastTime = performance.now(); }
    _startGame() {
        if (this.state !== 'title')
            return;
        this.state = 'playing';
        this.ui.setState('playing');
        if (!this.input.isTouch)
            this.ui.showHint();
        this._resumeClock();
    }
    _retry() {
        this._buildFreshState();
        this.state = 'playing';
        this.ui.setState('playing');
        this._resumeClock();
    }
    _goToMainMenu() {
        this.ui.setPaused(false);
        this._buildFreshState();
        this.state = 'title';
        this.ui.setState('title');
        this._resumeClock();
    }
    _loop(now) {
        requestAnimationFrame((t) => this._loop(t));
        let dt = (now - this._lastTime) / 1000;
        this._lastTime = now;
        dt = Math.min(dt, 0.1);
        if (this.ui.paused)
            return;
        this._accumulator += dt;
        while (this._accumulator >= this._fixedDt) {
            this._update(this._fixedDt);
            this._accumulator -= this._fixedDt;
        }
        this._render();
    }
    _update(dt) {
        // Wind, fog, and background ambience run in every state.
        this.wind.update(dt);
        this.ambient.update(dt);
        this.audio.update(dt, this.wind.gustStrength);
        if (this.ambient.thunderStruck)
            this.audio.playThunder();
        if (this.state === 'playing') {
            this.elapsed += dt;
            this._updatePlaying(dt);
        }
        else if (this.state === 'title') {
            this._updateIdle(dt);
        }
        else {
            this.player.settle(dt);
            this._idleUmbrellaSway(dt);
        }
        const camDeltaX = this.camera.deltaX;
        this.rain.update(dt, this.wind, camDeltaX);
        const rawPx = this.renderer.worldToScreenX(this.camera, this.player.worldX);
        // Clamp the player's screen position so the character and umbrella never
        // drift off-screen while the spring camera is catching up.
        const playerMargin = 80;
        const px = ER.Util.clamp(rawPx, playerMargin, this.w - playerMargin);
        const py = this.renderer.roadScreenY(this.camera, this.player.worldX, this.h, this.baselineFrac) + 30;
        if (this.state === 'playing') {
            this.collisions.resolve(this.player, this.rain, px, py);
            if (this.player.dryness <= 0)
                this._triggerGameOver();
        }
        this._playerScreen = { x: px, y: py };
    }
    /** Gentle, non-interactive drift used behind the blurred title card. */
    _updateIdle(dt) {
        this.camera.x = ER.Util.damp(this.camera.x, this.elapsed * 14, 1.4, dt);
        this.camera.y = ER.Util.damp(this.camera.y, -ER.Road.elevation(this.camera.x), 2.2, dt);
        this.player.settle(dt);
        this._idleUmbrellaSway(dt);
        const viewMinX = this.camera.x - 150;
        const viewMaxX = this.camera.x + this.w + 150;
        this.world.ensureRange(viewMinX, viewMaxX);
        this._visible = this.world.collectVisible(viewMinX, viewMaxX);
        this.vehicles.update(dt, viewMinX, viewMaxX, this._visible.puddles, () => { });
    }
    /** Purely cosmetic: lets the umbrella lean with the wind when nobody's steering it. */
    _idleUmbrellaSway(dt) {
        const target = this.wind.angle * 0.4;
        this.player.umbrella.angle = ER.Util.damp(this.player.umbrella.angle, target, 1.5, dt);
    }
    _updatePlaying(dt) {
        const jumpPressed = this.input.consumeJump();
        const wasJumping = this.player.isJumping;
        // Tell the umbrella where the screen edges are so it can cap its tilt
        // angle per-side — the canopy tip will never fly beyond the viewport.
        const pivotX = ER.Util.clamp(
            this.renderer.worldToScreenX(this.camera, this.player.worldX),
            80, this.w - 80
        );
        this.player.umbrella.setScreenBounds(pivotX, this.w);
        this.player.update(dt, this.input.axis, jumpPressed);
        if (!wasJumping && this.player.isJumping)
            this.audio.playJump();
        if (this.input.axis !== 0 && Math.abs(this.player.umbrella.angularVel) > 60 && Math.random() < 0.03) {
            this.audio.playUmbrellaSwish();
        }
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
            const px = this.renderer.worldToScreenX(this.camera, this.player.worldX);
            const py = this.renderer.roadScreenY(this.camera, this.player.worldX, this.h, this.baselineFrac) + 30;
            this.collisions.resolveCarSplash(this.player, px, py, sx, sy);
        });
        this.puddles.update(this.player, visible.puddles, (p) => {
            const sx = this.renderer.worldToScreenX(this.camera, p.worldX);
            const sy = this.renderer.roadScreenY(this.camera, p.worldX, this.h, this.baselineFrac) + 20;
            this.rain.spawnSplash(sx, sy, 0, 8, 1.2);
            this.audio.playSplash();
            this.player.addWetness(this.puddles.missPenalty);
        }, () => { this.puddlesCleared++; });
        this._visible = visible;
    }
    _triggerGameOver() {
        this.state = 'ended';
        this.player.frozen = true;
        const distance = this.player.worldX / 12;
        const score = distance * 10 + this.puddlesCleared * 50;
        this.ui.showGameOver(score, distance, this.elapsed);
    }
    _render() {
        const { ctx, w, h } = this;
        this.renderer.clear(w, h);
        this.renderer.drawMountains(this.camera, w, h, this.baselineFrac);
        this.renderer.drawCityBackground(this.camera, w, h, this.baselineFrac);
        this.renderer.drawFog(w, h, this.ambient.fogBoost);

        this.rain.renderLayer(ctx, 'bg', ER.Palette.coolGray);
        const visible = this._visible;
        if (visible) {
            // Far-side scenery belongs behind the road's top edge. Drawing it here
            // stops houses and trees from appearing to stand on the driving lane.
            for (const o of visible.objects) {
                if (o.side <= 0)
                    continue;
                const sx = this.renderer.worldToScreenX(this.camera, o.worldX);
                if (sx < -120 || sx > w + 120)
                    continue;
                const roadY = this.renderer.roadScreenY(this.camera, o.worldX, h, this.baselineFrac);
                this.renderer.drawObject(o, sx, roadY - 30, this.elapsed);
            }
        }
        this.renderer.drawGround(this.camera, w, h, this.baselineFrac);
        this.renderer.drawGuardrail(this.camera, w, h, this.baselineFrac);
        this.renderer.drawRoad(this.camera, w, h, this.baselineFrac);
        this.renderer.drawPolesAndWires(this.camera, w, h, this.baselineFrac, this.elapsed);
        if (visible) {
            for (const p of visible.puddles) {
                const sx = this.renderer.worldToScreenX(this.camera, p.worldX);
                const sy = this.renderer.roadScreenY(this.camera, p.worldX, h, this.baselineFrac) + 20;
                this.renderer.drawPuddle(sx, sy, p, this.elapsed);
            }
            for (const o of visible.objects) {
                if (o.side > 0)
                    continue;
                const sx = this.renderer.worldToScreenX(this.camera, o.worldX);
                if (sx < -120 || sx > w + 120)
                    continue;
                const roadY = this.renderer.roadScreenY(this.camera, o.worldX, h, this.baselineFrac);
                this.renderer.drawObject(o, sx, roadY + 30, this.elapsed);
            }
            for (const a of visible.ambientEvents) {
                const sx = this.renderer.worldToScreenX(this.camera, a.worldX);
                if (sx < -60 || sx > w + 60)
                    continue;
                const roadY = this.renderer.roadScreenY(this.camera, a.worldX, h, this.baselineFrac);
                this.renderer.drawAmbient(a.type, sx, roadY - 4, this.elapsed);
            }
        }
        for (const car of this.vehicles.cars) {
            const sx = this.renderer.worldToScreenX(this.camera, car.worldX);
            if (sx < -80 || sx > w + 80)
                continue;
            const roadY = this.renderer.roadScreenY(this.camera, car.worldX, h, this.baselineFrac);
            this.renderer.drawVehicle(sx, roadY + 14, car);
        }
        this.rain.renderLayer(ctx, 'mid', ER.Palette.darkGray);
        if (this._playerScreen) {
            this.renderer.drawPlayer(this._playerScreen.x, this._playerScreen.y, this.player, this.wind);
        }
        this.rain.renderSplashes(ctx, ER.Palette.offWhite);
        this.rain.renderLayer(ctx, 'fg', ER.Palette.charcoal);
        this.renderer.drawVignette(w, h);
        this.renderer.drawLightningFlash(w, h, this.ambient.lightningFlash);
        if (this.state === 'playing') {
            this.ui.update(this.player.worldX / 12, this.player.dryness, this.elapsed);
        }
    }
};
//# sourceMappingURL=game.js.map
