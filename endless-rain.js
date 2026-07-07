
'use strict';
/* ============================================================================
 * ENDLESS RAIN — core game module
 * Architecture: Game / Camera / Player / Umbrella / WindSystem / RainSystem /
 * WorldGenerator / Chunk / VehicleSystem / PuddleSystem / AmbientSystem /
 * CollisionManager / Renderer / UIManager / InputManager / AudioManager
 * ==========================================================================*/

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
const Util = {
    lerp(a, b, t) { return a + (b - a) * t; },
    clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    damp(a, b, lambda, dt) { return Util.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    deg2rad(d) { return (d * Math.PI) / 180; },
    rad2deg(r) { return (r * 180) / Math.PI; },
    // Deterministic PRNG (mulberry32) so chunks regenerate identically forever.
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
};

// ---------------------------------------------------------------------------
// Palette — soft desaturated monochrome, muted green accent for vegetation
// ---------------------------------------------------------------------------
const Palette = {
    sky: ['#dfe3e6', '#c9cdd1'],
    fogFar: 'rgba(200,203,207,0.55)',
    fogNear: 'rgba(225,227,229,0.35)',
    mountains: '#b7bbbe',
    road: '#8d8f92',
    roadLine: '#c7c9cb',
    curb: '#a6a9ac',
    offWhite: '#eceae6',
    warmWhite: '#e3e0da',
    lightGray: '#c7c8ca',
    coolGray: '#9a9d9f',
    darkGray: '#5f6263',
    charcoal: '#3c3e3f',
    green: '#8a9789',
    greenDark: '#6f7c6e',
    puddle: '#9fa7ab',
    window: '#efe9d8',
};

// ---------------------------------------------------------------------------
// AudioManager — placeholder hooks only. No audio implemented yet.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// AudioConfig & AudioManager — production level Audio System
// Supports both procedural Web Audio API synthesis & loading static files
// ---------------------------------------------------------------------------
const AudioConfig = {
    useSynth: true, // Default to true. Change to false to load static files from the assets folder.
    paths: {
        rainLoop: 'assets/audio/ambient/rain_loop.ogg',
        windLoop: 'assets/audio/ambient/wind_loop.ogg',
        thunder: 'assets/audio/sfx/thunder_rumble.wav',
        footstep: 'assets/audio/sfx/footstep_soft.wav',
        windGust: 'assets/audio/ambient/wind_loop.ogg', // reuse or specify wind_gust
        splash: 'assets/audio/sfx/splash_car.wav'
    }
};

class AudioManager {
    constructor() {
        this.muted = false;
        this.ctx = null;
        this.buffers = {};
        
        // Active audio sources & gains
        this.masterGain = null;
        this.rainGain = null;
        this.windGain = null;
        
        this.rainSource = null;
        this.windSource = null;
        
        this.windFilter = null;
    }

    async init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.65, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        if (!AudioConfig.useSynth) {
            try {
                await this._preloadAssets();
            } catch (e) {
                console.warn("Failed to load static audio assets, falling back to Web Audio Synthesis.", e);
                AudioConfig.useSynth = true;
            }
        }

        this._startRainLoop();
        this._startWindLoop();
    }

    async _preloadAssets() {
        const promises = Object.entries(AudioConfig.paths).map(async ([key, url]) => {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
        });
        await Promise.all(promises);
    }

    setMuted(m) {
        this.muted = m;
        if (!this.ctx) {
            if (!m) this.init();
            return;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        const targetGain = m ? 0 : 0.65;
        this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.15);
    }

    _createNoiseBuffer(type = 'white') {
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            if (type === 'pink') {
                // Pink noise filter approximation
                output[i] = (lastOut + (0.12 * white)) / 1.1;
                lastOut = output[i];
            } else {
                output[i] = white;
            }
        }
        return noiseBuffer;
    }

    _startRainLoop() {
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        this.rainGain.connect(this.masterGain);

        if (AudioConfig.useSynth) {
            const source = this.ctx.createBufferSource();
            source.buffer = this._createNoiseBuffer('white');
            source.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1100;
            filter.Q.value = 0.6;

            source.connect(filter);
            filter.connect(this.rainGain);
            source.start();
            this.rainSource = source;
        } else if (this.buffers.rainLoop) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers.rainLoop;
            source.loop = true;
            source.connect(this.rainGain);
            source.start();
            this.rainSource = source;
        }
    }

    _startWindLoop() {
        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        this.windGain.connect(this.masterGain);

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.value = 320;
        this.windFilter.Q.value = 2.2;
        this.windFilter.connect(this.windGain);

        if (AudioConfig.useSynth) {
            const source = this.ctx.createBufferSource();
            source.buffer = this._createNoiseBuffer('pink');
            source.loop = true;
            source.connect(this.windFilter);
            source.start();
            this.windSource = source;
        } else if (this.buffers.windLoop) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers.windLoop;
            source.loop = true;
            source.connect(this.windFilter);
            source.start();
            this.windSource = source;
        }

        this._modulateWind();
    }

    _modulateWind() {
        if (!this.ctx || !this.windFilter) return;
        const now = this.ctx.currentTime;
        const freq = 180 + Math.random() * 260;
        const Q = 1.2 + Math.random() * 1.8;
        this.windFilter.frequency.setTargetAtTime(freq, now, 2.0);
        this.windFilter.Q.setTargetAtTime(Q, now, 2.0);

        setTimeout(() => this._modulateWind(), 2500 + Math.random() * 2000);
    }

    playThunder() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        if (AudioConfig.useSynth) {
            const source = this.ctx.createBufferSource();
            source.buffer = this._createNoiseBuffer('pink');

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 65;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.38, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 3.2);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            source.start(now);
            source.stop(now + 3.5);
        } else if (this.buffers.thunder) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers.thunder;
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.6, now);
            gain.connect(this.masterGain);
            
            source.connect(gain);
            source.start(now);
        }
    }

    playFootstep() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        if (AudioConfig.useSynth) {
            const source = this.ctx.createBufferSource();
            source.buffer = this._createNoiseBuffer('pink');

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 240;
            filter.Q.value = 3.5;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            source.start(now);
            source.stop(now + 0.1);
        } else if (this.buffers.footstep) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers.footstep;
            source.connect(this.masterGain);
            source.start(now);
        }
    }

    playWind() {
        if (!this.ctx || !this.windGain) return;
        const now = this.ctx.currentTime;
        
        // Swells the wind volume temporarily
        this.windGain.gain.cancelScheduledValues(now);
        this.windGain.gain.setValueAtTime(this.windGain.gain.value, now);
        this.windGain.gain.linearRampToValueAtTime(0.18, now + 1.2);
        this.windGain.gain.exponentialRampToValueAtTime(0.06, now + 3.5);
    }

    playSplash() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        if (AudioConfig.useSynth) {
            // Low-frequency body of the splash
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);

            // High-frequency splash hiss/spray
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._createNoiseBuffer('white');

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(750, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.22);

            const oscGain = this.ctx.createGain();
            oscGain.gain.setValueAtTime(0.16, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.12, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(oscGain);
            oscGain.connect(this.masterGain);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.31);
            noise.start(now);
            noise.stop(now + 0.23);
        } else if (this.buffers.splash) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers.splash;
            source.connect(this.masterGain);
            source.start(now);
        }
    }

    stopAllAudio() {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
    }
}

// ---------------------------------------------------------------------------
// InputManager — keyboard (desktop) + touch buttons (mobile), auto-detected
// ---------------------------------------------------------------------------
class InputManager {
    constructor() {
        this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        this.left = false;
        this.right = false;
        this._onKeyDown = (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = true;
        };
        this._onKeyUp = (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = false;
        };
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        this._bindTouchButton('btn-left', (v) => (this.left = v));
        this._bindTouchButton('btn-right', (v) => (this.right = v));
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

    /** -1 = tilt left, 1 = tilt right, 0 = neutral */
    get axis() {
        if (this.left && !this.right) return -1;
        if (this.right && !this.left) return 1;
        return 0;
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }
}

// ---------------------------------------------------------------------------
// WindSystem — smoothly evolving wind direction that drives rain angle
// ---------------------------------------------------------------------------
class WindSystem {
    constructor() {
        this.states = [
            { name: 'Far Left', angle: -58 },
            { name: 'Left', angle: -38 },
            { name: 'Slight Left', angle: -16 },
            { name: 'Vertical', angle: 0 },
            { name: 'Slight Right', angle: 16 },
            { name: 'Right', angle: 38 },
            { name: 'Far Right', angle: 58 },
        ];
        this.stateIndex = 3;
        this.targetAngle = 0;
        this.angle = 0; // current interpolated angle (degrees from vertical)
        this.gustStrength = 0; // 0..1, purely cosmetic (sway amount)
        this._timer = Util.range(Math.random, 5, 9);
    }

    update(dt) {
        this._timer -= dt;
        if (this._timer <= 0) {
            let next = this.stateIndex;
            while (next === this.stateIndex) next = Math.floor(Math.random() * this.states.length);
            this.stateIndex = next;
            this.targetAngle = this.states[next].angle;
            this._timer = Util.range(Math.random, 6, 11);
        }
        this.angle = Util.damp(this.angle, this.targetAngle, 0.6, dt);
        this.gustStrength = Util.damp(this.gustStrength, Math.abs(this.targetAngle - this.angle) / 60, 3, dt);
    }

    get stateName() { return this.states[this.stateIndex].name; }
    /** Unit vector describing incoming rain direction (falling toward +y). */
    get direction() {
        const rad = Util.deg2rad(this.angle);
        return { x: -Math.sin(rad), y: Math.cos(rad) };
    }
}

// ---------------------------------------------------------------------------
// Umbrella — the only player-controlled mechanic. Weighted rotation w/ inertia.
// ---------------------------------------------------------------------------
class Umbrella {
    constructor() {
        this.angle = 0;         // degrees from vertical, matches wind convention
        this.angularVel = 0;
        this.maxAngle = 62;
        this.accel = 260;       // deg/s^2 while held
        this.friction = 4.2;    // damping when released
        this.maxSpeed = 140;    // deg/s
        this.canopyLength = 58;
        this.canopyHalfWidth = 21;
    }

    update(dt, axis) {
        if (axis !== 0) {
            this.angularVel += axis * this.accel * dt;
            this.angularVel = Util.clamp(this.angularVel, -this.maxSpeed, this.maxSpeed);
        } else {
            this.angularVel *= Math.max(0, 1 - this.friction * dt);
        }
        this.angle += this.angularVel * dt;
        if (this.angle > this.maxAngle) { this.angle = this.maxAngle; this.angularVel = 0; }
        if (this.angle < -this.maxAngle) { this.angle = -this.maxAngle; this.angularVel = 0; }
    }

    /**
     * Point-in-canopy test. `dx,dy` = point relative to umbrella pivot (screen px,
     * +y down). Returns true if the point is shielded by the canopy.
     */
    shields(dx, dy) {
        const rad = Util.deg2rad(this.angle);
        const cos = Math.cos(rad), sin = Math.sin(rad);
        // rotate point into umbrella-local space (canopy points "up" from pivot,
        // tilted by `angle` the same way wind angle is measured)
        const rx = dx * cos + dy * sin;
        const ry = -dx * sin + dy * cos;
        return rx > -this.canopyHalfWidth && rx < this.canopyHalfWidth && ry < 0 && ry > -this.canopyLength;
    }
}

// ---------------------------------------------------------------------------
// Road — continuous procedural elevation function (shared by world + camera)
// ---------------------------------------------------------------------------
const Road = {
    // Sum of gentle sine waves = smooth hills, always continuous & differentiable.
    elevation(x) {
        return (
            Math.sin(x * 0.0012) * 46 +
            Math.sin(x * 0.0037 + 1.7) * 22 +
            Math.sin(x * 0.0009 + 4.1) * 30
        );
    },
    slope(x) {
        const h = 4;
        return (Road.elevation(x + h) - Road.elevation(x - h)) / (2 * h);
    },
};

// ---------------------------------------------------------------------------
// Player — continuously auto-walks forward; only the umbrella responds to input
// ---------------------------------------------------------------------------
class Player {
    constructor() {
        this.worldX = 0;
        this.speed = 118; // world units per second
        this.walkCycle = 0;
        this.bob = 0;
        this.wetness = 0; // 0..100
        this.umbrella = new Umbrella();
    }

    get groundY() { return Road.elevation(this.worldX); }

    update(dt, axis) {
        this.worldX += this.speed * dt;
        this.walkCycle += dt * (this.speed / 18);
        this.bob = Math.sin(this.walkCycle * 2) * 3.2;
        this.umbrella.update(dt, axis);

        // Dryness recovers slowly when not being rained on directly.
        this.wetness = Util.clamp(this.wetness - dt * 3.4, 0, 100);
    }

    addWetness(amount) { this.wetness = Util.clamp(this.wetness + amount, 0, 100); }
    get dryness() { return Math.round(100 - this.wetness); }
}

// ---------------------------------------------------------------------------
// Camera — spring-smoothed follow, keeps player ~35% from left, no snapping
// ---------------------------------------------------------------------------
class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetY = 0;
        this.anchorFrac = 0.35;
        this.prevPlayerX = 0;
    }

    update(dt, player, viewW) {
        const desiredX = player.worldX - viewW * this.anchorFrac;
        this.x = Util.damp(this.x, desiredX, 4.5, dt);

        // Vertical compensation follows the road's elevation with its own spring
        // so hills feel weighty rather than instantly snapping the horizon.
        this.targetY = -player.groundY;
        this.y = Util.damp(this.y, this.targetY, 3.2, dt);
    }

    get deltaX() {
        const d = this.x - (this._lastX ?? this.x);
        this._lastX = this.x;
        return d;
    }

    worldToScreenX(worldX) { return worldX - this.x; }
}

// ---------------------------------------------------------------------------
// RainSystem — 3 parallax layers of pooled raindrops + pooled splash particles
// ---------------------------------------------------------------------------
class RainLayer {
    constructor(count, opts) {
        this.count = count;
        this.opts = opts;
        this.x = new Float32Array(count);
        this.y = new Float32Array(count);
        this.speedMul = new Float32Array(count);
        this.len = new Float32Array(count);
        this.hit = new Uint8Array(count); // scored-this-pass flag, avoids double counting
    }

    init(w, h, rng) {
        for (let i = 0; i < this.count; i++) {
            this.x[i] = rng() * (w + 400) - 200;
            this.y[i] = rng() * h;
            this.speedMul[i] = 0.85 + rng() * 0.3;
            this.len[i] = this.opts.lenMin + rng() * (this.opts.lenMax - this.opts.lenMin);
        }
    }
}

class RainSystem {
    constructor(rng) {
        this.rng = rng;
        this.layers = {
            bg: new RainLayer(90, { fallSpeed: 340, lenMin: 6, lenMax: 11, alpha: 0.22, width: 1, parallax: 0.12 }),
            mid: new RainLayer(180, { fallSpeed: 520, lenMin: 10, lenMax: 16, alpha: 0.42, width: 1.4, parallax: 0.04 }),
            fg: new RainLayer(70, { fallSpeed: 760, lenMin: 16, lenMax: 26, alpha: 0.65, width: 2.1, parallax: 0.02 }),
        };
        this.splashes = []; // pooled ground/puddle splash particles
        this.maxSplashes = 220;
        for (let i = 0; i < this.maxSplashes; i++) {
            this.splashes.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1 });
        }
        this.w = 0; this.h = 0;
    }

    resize(w, h) {
        this.w = w; this.h = h;
        for (const key in this.layers) this.layers[key].init(w, h, this.rng);
    }

    spawnSplash(x, y, dirX = 0, count = 3, spread = 1) {
        let spawned = 0;
        for (let i = 0; i < this.maxSplashes && spawned < count; i++) {
            const p = this.splashes[i];
            if (p.active) continue;
            p.active = true;
            p.x = x; p.y = y;
            const ang = (-Math.PI / 2) + (Math.random() - 0.5) * spread + dirX * 0.6;
            const speed = 40 + Math.random() * 70;
            p.vx = Math.cos(ang) * speed + dirX * 60;
            p.vy = Math.sin(ang) * speed;
            p.life = 0;
            p.maxLife = 0.35 + Math.random() * 0.25;
            p.size = 1.5 + Math.random() * 2;
            p.scored = false;
            spawned++;
        }
    }

    update(dt, wind, cameraDeltaX) {
        const dir = wind.direction;
        this.dirX = dir.x; this.dirY = dir.y;
        for (const key in this.layers) {
            const L = this.layers[key];
            const opt = L.opts;
            for (let i = 0; i < L.count; i++) {
                L.x[i] += dir.x * opt.fallSpeed * L.speedMul[i] * dt - cameraDeltaX * opt.parallax;
                L.y[i] += dir.y * opt.fallSpeed * L.speedMul[i] * dt;
                if (L.y[i] > this.h + 20) {
                    L.y[i] = -20 - this.rng() * 60;
                    L.x[i] = this.rng() * (this.w + 400) - 200;
                    L.hit[i] = 0;
                    if (opt === this.layers.mid.opts || opt === this.layers.fg.opts) {
                        if (this.rng() < 0.5) this.spawnSplash(L.x[i], this.h - 4 + this.rng() * 4, dir.x, 1, 0.8);
                    }
                }
                if (L.x[i] < -220) L.x[i] += this.w + 400;
                if (L.x[i] > this.w + 220) L.x[i] -= this.w + 400;
            }
        }
        // gravity-ish physics for splash particles
        const g = 260;
        for (const p of this.splashes) {
            if (!p.active) continue;
            p.life += dt;
            if (p.life >= p.maxLife) { p.active = false; continue; }
            p.vy += g * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }

    renderLayer(ctx, key, color) {
        const L = this.layers[key];
        const opt = L.opts;
        const dx = this.dirX ?? 0, dy = this.dirY ?? 1;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = opt.alpha;
        ctx.lineWidth = opt.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < L.count; i++) {
            const x = L.x[i], y = L.y[i];
            const len = L.len[i];
            ctx.moveTo(x, y);
            ctx.lineTo(x - dx * len, y - dy * len);
        }
        ctx.stroke();
        ctx.restore();
    }

    renderSplashes(ctx, color) {
        ctx.save();
        ctx.fillStyle = color;
        for (const p of this.splashes) {
            if (!p.active) continue;
            const a = 1 - p.life / p.maxLife;
            ctx.globalAlpha = a * 0.7;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
// ---------------------------------------------------------------------------
// WorldGenerator / Chunk — infinite recyclable roadside scenery
// ---------------------------------------------------------------------------
const CHUNK_WIDTH = 900;

const RIGHT_TYPES = [
    { type: 'house', weight: 3 },
    { type: 'tree', weight: 3 },
    { type: 'bush', weight: 3 },
    { type: 'fenceRun', weight: 2 },
    { type: 'mailbox', weight: 1 },
    { type: 'vending', weight: 1 },
    { type: 'bicycle', weight: 1 },
    { type: 'lampRight', weight: 1 },
];
const LEFT_TYPES = [
    { type: 'mirror', weight: 1 },
    { type: 'sign', weight: 1 },
    { type: 'lampLeft', weight: 1 },
    { type: 'none', weight: 3 },
];

function weightedPick(rng, table) {
    const total = table.reduce((s, t) => s + t.weight, 0);
    let r = rng() * total;
    for (const t of table) { if ((r -= t.weight) <= 0) return t.type; }
    return table[table.length - 1].type;
}

class WorldGenerator {
    constructor() {
        this.chunks = new Map();
    }

    _generateChunk(index) {
        const rng = Util.mulberry32(index * 7919 + 13);
        const objects = [];

        const rightCount = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < rightCount; i++) {
            objects.push({
                side: 1,
                type: weightedPick(rng, RIGHT_TYPES),
                localX: rng() * CHUNK_WIDTH,
                scale: 0.8 + rng() * 0.5,
                seed: rng(),
            });
        }
        const leftCount = 1 + Math.floor(rng() * 2);
        for (let i = 0; i < leftCount; i++) {
            const type = weightedPick(rng, LEFT_TYPES);
            if (type === 'none') continue;
            objects.push({ side: -1, type, localX: rng() * CHUNK_WIDTH, scale: 0.9 + rng() * 0.3, seed: rng() });
        }
        objects.sort((a, b) => a.localX - b.localX);

        const puddles = [];
        const puddleCount = rng() < 0.6 ? 1 : rng() < 0.85 ? 2 : 0;
        for (let i = 0; i < puddleCount; i++) {
            puddles.push({
                localX: 60 + rng() * (CHUNK_WIDTH - 120),
                width: 34 + rng() * 46,
                depth: 0.5 + rng() * 0.5,
                seed: rng(),
            });
        }

        // Rare ambient "life" seeds baked per chunk so events feel placed, not random noise.
        const ambientRoll = rng();
        const ambient = ambientRoll < 0.12
            ? { type: Util.pick(rng, ['cat', 'bird', 'litWindow', 'litterBag']), localX: rng() * CHUNK_WIDTH }
            : null;

        return { index, objects, puddles, ambient };
    }

    getChunk(index) {
        let c = this.chunks.get(index);
        if (!c) { c = this._generateChunk(index); this.chunks.set(index, c); }
        return c;
    }

    /** Ensure chunks covering [minX, maxX] exist; prune far-away ones to bound memory. */
    ensureRange(minX, maxX) {
        const first = Math.floor(minX / CHUNK_WIDTH) - 1;
        const last = Math.floor(maxX / CHUNK_WIDTH) + 1;
        for (let i = first; i <= last; i++) this.getChunk(i);
        for (const key of this.chunks.keys()) {
            if (key < first - 3 || key > last + 3) this.chunks.delete(key);
        }
    }

    /** Flatten visible objects/puddles into world-space coordinates. */
    collectVisible(minX, maxX) {
        const first = Math.floor(minX / CHUNK_WIDTH);
        const last = Math.floor(maxX / CHUNK_WIDTH);
        const objects = [];
        const puddles = [];
        const ambientEvents = [];
        for (let i = first; i <= last; i++) {
            const c = this.getChunk(i);
            const base = i * CHUNK_WIDTH;
            for (const o of c.objects) objects.push({ ...o, worldX: base + o.localX });
            for (const p of c.puddles) puddles.push({ ...p, worldX: base + p.localX });
            if (c.ambient) ambientEvents.push({ ...c.ambient, worldX: base + c.ambient.localX, chunkIndex: i });
        }
        return { objects, puddles, ambientEvents };
    }
}
// ---------------------------------------------------------------------------
// VehicleSystem — occasional cars that splash through puddles
// ---------------------------------------------------------------------------
class VehicleSystem {
    constructor() {
        this.cars = [];
        this._timer = Util.range(Math.random, 5, 10);
    }

    update(dt, minX, maxX, puddles, onSplash) {
        this._timer -= dt;
        if (this._timer <= 0) {
            this._timer = Util.range(Math.random, 9, 19);
            const dir = Math.random() < 0.5 ? 1 : -1;
            const speed = (70 + Math.random() * 55) * dir;
            const startX = dir > 0 ? minX - 260 : maxX + 260;
            this.cars.push({
                worldX: startX, speed, dir, wheelSpin: 0,
                lane: dir > 0 ? -18 : 18,
                splashed: new Set(),
                hue: 0.7 + Math.random() * 0.3,
            });
        }

        for (const car of this.cars) {
            car.worldX += car.speed * dt;
            car.wheelSpin += Math.abs(car.speed) * dt * 0.05;
            for (const p of puddles) {
                const key = p.worldX.toFixed(1);
                const carFront = car.worldX + (car.dir > 0 ? 26 : -26);
                if (!car.splashed.has(key) && Math.abs(carFront - p.worldX) < p.width * 0.5) {
                    car.splashed.add(key);
                    onSplash(p.worldX, car.dir);
                }
            }
        }
        this.cars = this.cars.filter((c) => c.worldX > minX - 400 && c.worldX < maxX + 400);
    }
}

// ---------------------------------------------------------------------------
// AmbientSystem — purely cosmetic world-life moments (no gameplay impact)
// ---------------------------------------------------------------------------
class AmbientSystem {
    constructor() {
        this.fogPulse = 0;
        this._fogTimer = Util.range(Math.random, 14, 26);
        this.fogBoost = 0;
    }

    update(dt) {
        this.fogPulse += dt;
        this._fogTimer -= dt;
        if (this._fogTimer <= 0) {
            this._fogTimer = Util.range(Math.random, 16, 30);
            this.fogBoost = 1;
        }
        this.fogBoost = Util.damp(this.fogBoost, 0, 0.15, dt);
    }
}
// ---------------------------------------------------------------------------
// CollisionManager — resolves raindrops/splashes vs. umbrella vs. player body
// ---------------------------------------------------------------------------
class CollisionManager {
    constructor() {
        this.checkRadius = 70;
        this.bodyHalfWidth = 15;
        this.bodyTop = 68;   // px above feet
        this.pivotUp = 50;   // umbrella pivot height above feet
    }

    resolve(player, rain, px, py) {
        const pivotX = px, pivotY = py - this.pivotUp;
        const bodyMinX = px - this.bodyHalfWidth, bodyMaxX = px + this.bodyHalfWidth;
        const bodyMinY = py - this.bodyTop, bodyMaxY = py + 6;
        let hits = 0;

        for (const key of ['mid', 'fg']) {
            const L = rain.layers[key];
            for (let i = 0; i < L.count; i++) {
                if (L.hit[i]) continue;
                const x = L.x[i], y = L.y[i];
                if (x < px - this.checkRadius || x > px + this.checkRadius) continue;
                if (y < bodyMinY - 40 || y > bodyMaxY) continue;
                if (player.umbrella.shields(x - pivotX, y - pivotY)) { L.hit[i] = 1; continue; }
                if (x >= bodyMinX && x <= bodyMaxX && y >= bodyMinY && y <= bodyMaxY) {
                    L.hit[i] = 1;
                    hits++;
                }
            }
        }

        for (const p of rain.splashes) {
            if (!p.active || p.scored) continue;
            if (p.x < px - this.checkRadius || p.x > px + this.checkRadius) continue;
            if (p.y < bodyMinY - 20 || p.y > bodyMaxY + 10) continue;
            if (player.umbrella.shields(p.x - pivotX, p.y - pivotY)) { p.scored = true; continue; }
            if (p.x >= bodyMinX && p.x <= bodyMaxX && p.y >= bodyMinY - 10 && p.y <= bodyMaxY + 10) {
                p.scored = true;
                hits += 1.4;
            }
        }

        if (hits > 0) player.addWetness(hits * 1.6);
    }
}
// ---------------------------------------------------------------------------
// Renderer — draws sky, road, chunk scenery, player, vehicles, rain, HUD fx
// ---------------------------------------------------------------------------
class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.roadBandY = 0; // set each frame by Game (fraction of view height)
    }

    worldToScreenX(camera, worldX) { return worldX - camera.x; }
    roadScreenY(camera, worldX, viewH, baselineFrac) {
        return viewH * baselineFrac - (Road.elevation(worldX) + camera.y);
    }

    clear(w, h) {
        const ctx = this.ctx;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, Palette.sky[0]);
        g.addColorStop(1, Palette.sky[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    drawMountains(camera, w, h, baselineFrac) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = Palette.mountains;
        ctx.globalAlpha = 0.55;
        const parallax = 0.15;
        const baseY = h * baselineFrac - 40;
        ctx.beginPath();
        ctx.moveTo(0, baseY + 60);
        const step = 60;
        for (let sx = -step; sx <= w + step; sx += step) {
            const worldX = (camera.x + sx) * parallax;
            const y = baseY - 34 - Math.sin(worldX * 0.01) * 22 - Math.sin(worldX * 0.023 + 2) * 12;
            ctx.lineTo(sx, y);
        }
        ctx.lineTo(w + step, baseY + 60);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawFog(w, h, boost) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = Palette.fogFar;
        ctx.globalAlpha = 0.35 + boost * 0.25;
        ctx.fillRect(0, h * 0.28, w, h * 0.18);
        ctx.fillStyle = Palette.fogNear;
        ctx.globalAlpha = 0.22 + boost * 0.2;
        ctx.fillRect(0, h * 0.5, w, h * 0.14);
        ctx.restore();
    }

    drawRoad(camera, w, h, baselineFrac) {
        const ctx = this.ctx;
        const samples = 40;
        const worldStart = camera.x - 100;
        const worldEnd = camera.x + w + 100;
        const stepWorld = (worldEnd - worldStart) / samples;

        ctx.save();
        ctx.fillStyle = Palette.road;
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const wx = worldStart + i * stepWorld;
            const sx = this.worldToScreenX(camera, wx);
            const sy = this.roadScreenY(camera, wx, h, baselineFrac);
            if (i === 0) ctx.moveTo(sx, sy - 30); else ctx.lineTo(sx, sy - 30);
        }
        for (let i = samples; i >= 0; i--) {
            const wx = worldStart + i * stepWorld;
            const sx = this.worldToScreenX(camera, wx);
            const sy = this.roadScreenY(camera, wx, h, baselineFrac);
            ctx.lineTo(sx, sy + 34);
        }
        ctx.closePath();
        ctx.fill();

        // center dashes
        ctx.strokeStyle = Palette.roadLine;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 22]);
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const wx = worldStart + i * stepWorld;
            const sx = this.worldToScreenX(camera, wx);
            const sy = this.roadScreenY(camera, wx, h, baselineFrac);
            if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawGuardrail(camera, w, h, baselineFrac) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = Palette.charcoal;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        const postSpacing = 46;
        const startPost = Math.floor((camera.x - 60) / postSpacing);
        const endPost = Math.ceil((camera.x + w + 60) / postSpacing);
        ctx.beginPath();
        let prev = null;
        for (let p = startPost; p <= endPost; p++) {
            const wx = p * postSpacing;
            const sx = this.worldToScreenX(camera, wx);
            const sy = this.roadScreenY(camera, wx, h, baselineFrac) + 30;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx, sy - 16);
            if (prev) { ctx.moveTo(prev.x, prev.y - 12); ctx.lineTo(sx, sy - 12); }
            prev = { x: sx, y: sy };
        }
        ctx.stroke();
        ctx.restore();
    }

    drawPolesAndWires(camera, w, h, baselineFrac, t) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = Palette.darkGray;
        const spacing = 340;
        const startPole = Math.floor((camera.x - 200) / spacing);
        const endPole = Math.ceil((camera.x + w + 200) / spacing);
        const poleTops = [];
        for (let p = startPole; p <= endPole; p++) {
            const wx = p * spacing + (p % 3) * 18 - 9;
            const sx = this.worldToScreenX(camera, wx);
            const groundY = this.roadScreenY(camera, wx, h, baselineFrac) - 26;
            const topY = groundY - 92;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(sx, groundY);
            ctx.lineTo(sx, topY);
            ctx.stroke();
            // cross arm
            ctx.beginPath();
            ctx.moveTo(sx - 12, topY + 8);
            ctx.lineTo(sx + 12, topY + 8);
            ctx.stroke();
            poleTops.push({ x: sx, y: topY + 8 });
        }
        // sagging wires between consecutive poles
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1.4;
        for (let i = 0; i < poleTops.length - 1; i++) {
            const a = poleTops[i], b = poleTops[i + 1];
            const midX = (a.x + b.x) / 2;
            const sag = 14 + Math.sin(t * 0.6 + i) * 1.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo(midX, a.y + sag + (b.y - a.y) / 2, b.x, b.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawPuddle(sx, sy, p, t) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(1, 0.28);
        ctx.fillStyle = Palette.puddle;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
        ctx.fill();
        // ripple rings
        ctx.strokeStyle = Palette.offWhite;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.2;
        const ringT = (t * 0.5 + p.seed * 10) % 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, (p.width / 2) * ringT * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawObject(o, sx, sy, t) {
        const ctx = this.ctx;
        const s = o.scale;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(s, s);
        const sway = Math.sin(t * 0.8 + o.seed * 10) * 2;

        switch (o.type) {
            case 'house': {
                const w = 74, h = 58;
                ctx.fillStyle = Palette.warmWhite;
                ctx.fillRect(-w / 2, -h, w, h);
                ctx.fillStyle = Palette.darkGray;
                ctx.beginPath();
                ctx.moveTo(-w / 2 - 8, -h);
                ctx.lineTo(0, -h - 28);
                ctx.lineTo(w / 2 + 8, -h);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = Palette.window;
                ctx.globalAlpha = 0.85;
                ctx.fillRect(-w / 2 + 10, -h + 14, 14, 14);
                ctx.fillRect(w / 2 - 24, -h + 14, 14, 14);
                break;
            }
            case 'tree': {
                ctx.fillStyle = Palette.darkGray;
                ctx.fillRect(-3, -30, 6, 30);
                ctx.save();
                ctx.translate(0, -40);
                ctx.rotate(Util.deg2rad(sway * 0.6));
                ctx.fillStyle = Palette.green;
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.arc(0, 0, 22, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
            }
            case 'bush': {
                ctx.fillStyle = Palette.greenDark;
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                ctx.arc(-10, -8, 12, 0, Math.PI * 2);
                ctx.arc(6, -10, 14, 0, Math.PI * 2);
                ctx.arc(14, -6, 10, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'fenceRun': {
                ctx.strokeStyle = Palette.coolGray;
                ctx.globalAlpha = 0.7;
                ctx.lineWidth = 2;
                for (let i = -2; i <= 2; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * 12, -2);
                    ctx.lineTo(i * 12, -24);
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.moveTo(-26, -20); ctx.lineTo(26, -20);
                ctx.moveTo(-26, -6); ctx.lineTo(26, -6);
                ctx.stroke();
                break;
            }
            case 'mailbox': {
                ctx.fillStyle = Palette.coolGray;
                ctx.fillRect(-4, -24, 8, 24);
                ctx.fillRect(-9, -34, 18, 12);
                break;
            }
            case 'vending': {
                ctx.fillStyle = Palette.lightGray;
                ctx.fillRect(-13, -46, 26, 46);
                ctx.fillStyle = Palette.window;
                ctx.globalAlpha = 0.7;
                ctx.fillRect(-9, -40, 18, 26);
                break;
            }
            case 'bicycle': {
                ctx.strokeStyle = Palette.charcoal;
                ctx.globalAlpha = 0.75;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-11, -8, 8, 0, Math.PI * 2);
                ctx.arc(11, -8, 8, 0, Math.PI * 2);
                ctx.moveTo(-11, -8); ctx.lineTo(0, -20); ctx.lineTo(11, -8);
                ctx.lineTo(-11, -8);
                ctx.moveTo(0, -20); ctx.lineTo(4, -26);
                ctx.stroke();
                break;
            }
            case 'lampRight':
            case 'lampLeft': {
                ctx.strokeStyle = Palette.darkGray;
                ctx.globalAlpha = 0.7;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -48);
                ctx.stroke();
                ctx.fillStyle = Palette.offWhite;
                ctx.beginPath();
                ctx.arc(0, -52, 5, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'mirror': {
                ctx.strokeStyle = Palette.darkGray;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(0, -40);
                ctx.stroke();
                ctx.fillStyle = Palette.lightGray;
                ctx.beginPath();
                ctx.ellipse(6, -44, 8, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'sign': {
                ctx.strokeStyle = Palette.darkGray;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(0, -34);
                ctx.stroke();
                ctx.fillStyle = Palette.charcoal;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(0, -46); ctx.lineTo(-8, -34); ctx.lineTo(8, -34);
                ctx.closePath();
                ctx.fill();
                break;
            }
        }
        ctx.restore();
    }

    drawVehicle(sx, sy, car, w = 46, h = 20) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(car.dir, 1);
        ctx.fillStyle = Palette.charcoal;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(-w / 2, -h, w, h);
        ctx.fillRect(-w / 2 + 8, -h - 10, w - 20, 10);
        ctx.fillStyle = Palette.window;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-w / 2 + 10, -h - 8, w - 24, 7);
        ctx.fillStyle = Palette.darkGray;
        ctx.globalAlpha = 0.9;
        const wheelR = 5;
        for (const wx of [-w / 2 + 9, w / 2 - 9]) {
            ctx.save();
            ctx.translate(wx, 0);
            ctx.rotate(car.wheelSpin);
            ctx.beginPath(); ctx.arc(0, 0, wheelR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = Palette.offWhite; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-wheelR, 0); ctx.lineTo(wheelR, 0); ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    drawPlayer(sx, sy, player) {
        const ctx = this.ctx;
        const bob = player.bob;
        const legSwing = Math.sin(player.walkCycle * 2) * 10;
        ctx.save();
        ctx.translate(sx, sy + bob);

        // legs
        ctx.strokeStyle = Palette.charcoal;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-4, -18); ctx.lineTo(-4 + legSwing * 0.3, 0);
        ctx.moveTo(4, -18); ctx.lineTo(4 - legSwing * 0.3, 0);
        ctx.stroke();

        // body
        ctx.fillStyle = Palette.charcoal;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.roundRect(-11, -46, 22, 30, 6);
        ctx.fill();

        // head
        ctx.beginPath();
        ctx.arc(0, -54, 9, 0, Math.PI * 2);
        ctx.fill();

        // umbrella
        ctx.save();
        ctx.translate(0, -50);
        ctx.rotate(Util.deg2rad(player.umbrella.angle));
        ctx.strokeStyle = Palette.darkGray;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -player.umbrella.canopyLength);
        ctx.stroke();
        ctx.fillStyle = Palette.offWhite;
        ctx.globalAlpha = 0.94;
        ctx.beginPath();
        ctx.arc(0, -player.umbrella.canopyLength, player.umbrella.canopyHalfWidth, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = Palette.coolGray;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -player.umbrella.canopyLength, player.umbrella.canopyHalfWidth, Math.PI, 0);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    drawAmbient(kind, sx, sy, t) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = 0.8;
        if (kind === 'cat') {
            ctx.fillStyle = Palette.charcoal;
            ctx.beginPath();
            ctx.ellipse(0, -8, 12, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(11, -12, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (kind === 'bird') {
            ctx.strokeStyle = Palette.charcoal;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-5, 0); ctx.quadraticCurveTo(0, -4, 5, 0);
            ctx.stroke();
        } else if (kind === 'litterBag') {
            ctx.fillStyle = Palette.warmWhite;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.ellipse(0, 0, 6, 8, Math.sin(t) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
// ---------------------------------------------------------------------------
// UIManager — HUD text, pause overlay, settings, fullscreen (DOM-based)
// ---------------------------------------------------------------------------
class UIManager {
    constructor(onResume, onMuteToggle) {
        this.distanceEl = document.getElementById('hud-distance');
        this.drynessEl = document.getElementById('hud-dryness');
        this.timeEl = document.getElementById('hud-time');
        this.windEl = document.getElementById('hud-wind');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.pauseBtn = document.getElementById('btn-pause');
        this.resumeBtn = document.getElementById('btn-resume');
        this.fullscreenBtn = document.getElementById('btn-fullscreen');
        this.muteBtn = document.getElementById('btn-mute');
        this.hint = document.getElementById('keyboard-hint');

        this.paused = false;
        this.muted = false; // Starts unmuted by default
        this.pauseBtn.addEventListener('click', () => this.setPaused(true));
        this.resumeBtn.addEventListener('click', () => { this.setPaused(false); onResume(); });
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.muteBtn.addEventListener('click', () => {
            const isMuted = this.toggleMute();
            if (onMuteToggle) onMuteToggle(isMuted);
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    }

    toggleMute() {
        this.muted = !this.muted;
        this.muteBtn.textContent = this.muted ? '🔇' : '🔈';
        return this.muted;
    }

    setPaused(v) {
        this.paused = v;
        this.pauseOverlay.classList.toggle('visible', v);
    }

    update(distanceMeters, dryness, seconds, windName) {
        this.distanceEl.textContent = `${distanceMeters.toFixed(0)} m`;
        this.drynessEl.textContent = `${dryness}%`;
        this.drynessEl.style.opacity = dryness < 40 ? '1' : '0.85';
        const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
        const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
        this.timeEl.textContent = `${mm}:${ss}`;
        if (this.windEl) this.windEl.textContent = windName;
    }
}

// ---------------------------------------------------------------------------
// Game — orchestrates the fixed-timestep loop and all subsystems
// ---------------------------------------------------------------------------
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = 0; this.h = 0;

        this.input = new InputManager();
        this.audio = new AudioManager();
        this.wind = new WindSystem();
        this.player = new Player();
        this.camera = new Camera();
        this.world = new WorldGenerator();
        this.rain = new RainSystem(Math.random);
        this.vehicles = new VehicleSystem();
        this.ambient = new AmbientSystem();
        this.collisions = new CollisionManager();
        this.renderer = new Renderer(this.ctx);
        this.ui = new UIManager(() => this._resumeClock(), (muted) => this.audio.setMuted(muted));

        this.baselineFrac = 0.6;
        this.elapsed = 0;
        this._accumulator = 0;
        this._fixedDt = 1 / 120;
        this._lastTime = performance.now();
        this._running = true;

        if (this.input.isTouch) {
            document.getElementById('touch-controls').classList.add('visible');
            document.getElementById('keyboard-hint').classList.remove('visible');
        } else {
            document.getElementById('keyboard-hint').classList.add('visible');
        }

        // Initialize audio on first user gesture to satisfy browser autoplay policy
        const initAudio = () => {
            if (!this.ui.muted) {
                this.audio.init();
            }
            window.removeEventListener('click', initAudio);
            window.removeEventListener('keydown', initAudio);
            window.removeEventListener('touchstart', initAudio);
        };
        window.addEventListener('click', initAudio);
        window.addEventListener('keydown', initAudio);
        window.addEventListener('touchstart', initAudio);

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.ui.setPaused(true);
        });
        this.resize();
        requestAnimationFrame((t) => this._loop(t));
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.w = rect.width; this.h = rect.height;
        this.canvas.width = Math.round(this.w * this.dpr);
        this.canvas.height = Math.round(this.h * this.dpr);
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.rain.resize(this.w, this.h);
    }

    _resumeClock() { this._lastTime = performance.now(); }

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

    _update(dt) {
        this.elapsed += dt;

        // Track states before update to detect transitions for audio triggers
        const prevWindState = this.wind.stateIndex;
        const prevFogBoost = this.ambient.fogBoost;
        const prevWalkCycle = this.player.walkCycle;

        this.wind.update(dt);
        this.player.update(dt, this.input.axis);
        this.camera.update(dt, this.player, this.w);
        const camDeltaX = this.camera.deltaX;
        this.ambient.update(dt);

        // 1. Play wind gust sound when the wind shifts state
        if (this.wind.stateIndex !== prevWindState) {
            this.audio.playWind();
        }

        // 2. Play thunder rumble when a visual lightning flash occurs
        if (this.ambient.fogBoost > prevFogBoost && this.ambient.fogBoost === 1) {
            this.audio.playThunder();
        }

        // 3. Play footstep sounds synced with the bobbing walk animation cycle
        const stepPeriod = Math.PI / 2;
        if (Math.floor(this.player.walkCycle / stepPeriod) !== Math.floor(prevWalkCycle / stepPeriod)) {
            this.audio.playFootstep();
        }

        const viewMinX = this.camera.x - 150;
        const viewMaxX = this.camera.x + this.w + 150;
        this.world.ensureRange(viewMinX, viewMaxX);
        const visible = this.world.collectVisible(viewMinX, viewMaxX);

        this.vehicles.update(dt, viewMinX, viewMaxX, visible.puddles, (puddleWorldX, dir) => {
            const sx = this.renderer.worldToScreenX(this.camera, puddleWorldX);
            const sy = this.renderer.roadScreenY(this.camera, puddleWorldX, this.h, this.baselineFrac) + 20;
            this.rain.spawnSplash(sx, sy, -dir, 16, 1.6);
            this.audio.playSplash();
        });

        this.rain.update(dt, this.wind, camDeltaX);

        const px = this.renderer.worldToScreenX(this.camera, this.player.worldX);
        const py = this.renderer.roadScreenY(this.camera, this.player.worldX, this.h, this.baselineFrac) + 30;
        this.collisions.resolve(this.player, this.rain, px, py);

        this._visible = visible;
        this._playerScreen = { x: px, y: py };
    }

    _render() {
        const { ctx, w, h } = this;
        this.renderer.clear(w, h);
        this.renderer.drawMountains(this.camera, w, h, this.baselineFrac);
        this.renderer.drawFog(w, h, this.ambient.fogBoost);
        this.rain.renderLayer(ctx, 'bg', Palette.coolGray);

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

        this.rain.renderLayer(ctx, 'mid', Palette.darkGray);
        if (this._playerScreen) this.renderer.drawPlayer(this._playerScreen.x, this._playerScreen.y, this.player);
        this.rain.renderSplashes(ctx, Palette.offWhite);
        this.rain.renderLayer(ctx, 'fg', Palette.charcoal);

        this.ui.update(this.player.worldX / 12, this.player.dryness, this.elapsed, this.wind.stateName);
    }
}
