'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — rain.js
 * Three parallax layers of pooled raindrops + pooled splash particles.
 * Typed arrays throughout — no per-frame allocation.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.RainLayer = class RainLayer {
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
};

ER.RainSystem = class RainSystem {
  constructor(rng) {
    this.rng = rng;
    this.layers = {
      bg: new ER.RainLayer(90, { fallSpeed: 340, lenMin: 6, lenMax: 11, alpha: 0.22, width: 1, parallax: 0.12 }),
      mid: new ER.RainLayer(180, { fallSpeed: 520, lenMin: 10, lenMax: 16, alpha: 0.42, width: 1.4, parallax: 0.04 }),
      fg: new ER.RainLayer(70, { fallSpeed: 760, lenMin: 16, lenMax: 26, alpha: 0.65, width: 2.1, parallax: 0.02 }),
    };
    this.splashes = []; // pooled ground/puddle splash particles
    this.maxSplashes = 220;
    for (let i = 0; i < this.maxSplashes; i++) {
      this.splashes.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, scored: false });
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
};
