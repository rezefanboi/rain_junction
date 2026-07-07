'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — audio.js
 * Everything here is synthesized with the WebAudio API — filtered noise for
 * rain and thunder, short envelopes for footsteps/splashes/UI taps. No
 * external sample files, so nothing to fetch and nothing to go stale.
 * The context is created lazily and resumed on the first user gesture
 * (tap-to-start / any button), since browsers block audio before that.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.AudioManager = class AudioManager {
  constructor() {
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this._rainGain = null;
    this._started = false;
  }

  /** Must be called from within a user-gesture handler. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);
    this._buildNoiseBuffer();
    this._buildRainLoop();
    this._started = true;
  }

  _buildNoiseBuffer() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
  }

  _noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    return src;
  }

  /** Two continuous filtered-noise layers: a soft near hiss and a deeper far rumble. */
  _buildRainLoop() {
    const ctx = this.ctx;

    const near = this._noiseSource();
    const nearFilter = ctx.createBiquadFilter();
    nearFilter.type = 'highpass';
    nearFilter.frequency.value = 1800;
    const nearGain = ctx.createGain();
    nearGain.gain.value = 0.05;
    near.connect(nearFilter).connect(nearGain).connect(this.master);
    near.start();

    const far = this._noiseSource();
    const farFilter = ctx.createBiquadFilter();
    farFilter.type = 'lowpass';
    farFilter.frequency.value = 700;
    const farGain = ctx.createGain();
    farGain.gain.value = 0.10;
    far.connect(farFilter).connect(farGain).connect(this.master);
    far.start();

    this._rainGain = { near: nearGain, far: farGain };
  }

  /** Called every frame with 0..1 wind gust strength to gently swell the rain bed. */
  update(dt, gust = 0) {
    if (!this.ctx) return;
    if (this._rainGain) {
      const t = this.ctx.currentTime;
      this._rainGain.near.gain.setTargetAtTime(0.05 + gust * 0.04, t, 0.6);
      this._rainGain.far.gain.setTargetAtTime(0.10 + gust * 0.05, t, 0.6);
    }
  }

  _envGain(attack, hold, release, peak = 1) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
    return g;
  }

  playThunder() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = this._noiseSource();
    src.loop = false;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220 + Math.random() * 120;
    const gain = this._envGain(0.4, 0.6, 2.2, 0.22 + Math.random() * 0.1);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 4);
  }

  playFootstep() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = this._noiseSource();
    src.loop = false;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420 + Math.random() * 80;
    filter.Q.value = 0.8;
    const gain = this._envGain(0.002, 0.02, 0.09, 0.09);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 0.2);
  }

  playWind() {
    if (!this.ctx || this.muted) return;
    // Handled continuously via update()'s gust modulation; kept as a no-op hook.
  }

  playSplash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = this._noiseSource();
    src.loop = false;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.25);
    filter.Q.value = 0.6;
    const gain = this._envGain(0.005, 0.03, 0.22, 0.14);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 0.35);
  }

  playJump() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.12);
    const gain = this._envGain(0.01, 0.05, 0.12, 0.06);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playUmbrellaSwish() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = this._noiseSource();
    src.loop = false;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.5;
    const gain = this._envGain(0.02, 0.03, 0.16, 0.035);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 0.25);
  }

  playUiTap() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 520;
    const gain = this._envGain(0.002, 0.02, 0.09, 0.05);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  stopAllAudio() {
    if (this.master) this.master.gain.value = 0;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.08);
  }
};
