'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — render.js
 * Draws sky, road, chunk scenery, vehicles, rain, and the player. The only
 * significant rewrite in this file is drawPlayer(): the old figure was a
 * rounded rectangle with a circle for a head. She is now a simple, flat-
 * shaded silhouette — long straight black hair, an oversized white sailor
 * blouse, a dark pleated skirt — built from the reference image as loose
 * inspiration rather than a copy, and drawn at the same scale/pivot as the
 * original so the umbrella and collision math didn't need to move.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.Renderer = class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.roadBandY = 0; // set each frame by Game (fraction of view height)
  }

  worldToScreenX(camera, worldX) { return worldX - camera.x; }
  roadScreenY(camera, worldX, viewH, baselineFrac) {
    return viewH * baselineFrac - (ER.Road.elevation(worldX) + camera.y);
  }

  clear(w, h) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, ER.Palette.sky[0]);
    g.addColorStop(1, ER.Palette.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /** A soft, brief brightening across the whole scene — the visual half of thunder. */
  drawLightningFlash(w, h, alpha) {
    if (alpha <= 0.002) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = ER.Palette.lightning;
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Gentle darkened corners so the eye settles on the character and road ahead. */
  drawVignette(w, h) {
    const ctx = this.ctx;
    ctx.save();
    const r = ctx.createRadialGradient(w * 0.5, h * 0.46, h * 0.35, w * 0.5, h * 0.5, h * 0.85);
    r.addColorStop(0, 'rgba(20,22,28,0)');
    r.addColorStop(1, 'rgba(18,20,26,0.28)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawMountains(camera, w, h, baselineFrac) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = ER.Palette.mountains;
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
    ctx.fillStyle = ER.Palette.fogFar;
    ctx.globalAlpha = 0.35 + boost * 0.25;
    ctx.fillRect(0, h * 0.28, w, h * 0.18);
    ctx.fillStyle = ER.Palette.fogNear;
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
    ctx.fillStyle = ER.Palette.road;
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
    ctx.strokeStyle = ER.Palette.roadLine;
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
    ctx.strokeStyle = ER.Palette.charcoal;
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
    ctx.strokeStyle = ER.Palette.darkGray;
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
      ctx.beginPath();
      ctx.moveTo(sx - 12, topY + 8);
      ctx.lineTo(sx + 12, topY + 8);
      ctx.stroke();
      poleTops.push({ x: sx, y: topY + 8 });
    }
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
    ctx.fillStyle = ER.Palette.puddle;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ER.Palette.offWhite;
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
        ctx.fillStyle = ER.Palette.warmWhite;
        ctx.fillRect(-w / 2, -h, w, h);
        ctx.fillStyle = ER.Palette.darkGray;
        ctx.beginPath();
        ctx.moveTo(-w / 2 - 8, -h);
        ctx.lineTo(0, -h - 28);
        ctx.lineTo(w / 2 + 8, -h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = ER.Palette.window;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-w / 2 + 10, -h + 14, 14, 14);
        ctx.fillRect(w / 2 - 24, -h + 14, 14, 14);
        break;
      }
      case 'tree': {
        ctx.fillStyle = ER.Palette.darkGray;
        ctx.fillRect(-3, -30, 6, 30);
        ctx.save();
        ctx.translate(0, -40);
        ctx.rotate(ER.Util.deg2rad(sway * 0.6));
        ctx.fillStyle = ER.Palette.green;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'bush': {
        ctx.fillStyle = ER.Palette.greenDark;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(-10, -8, 12, 0, Math.PI * 2);
        ctx.arc(6, -10, 14, 0, Math.PI * 2);
        ctx.arc(14, -6, 10, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'fenceRun': {
        ctx.strokeStyle = ER.Palette.coolGray;
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
        ctx.fillStyle = ER.Palette.coolGray;
        ctx.fillRect(-4, -24, 8, 24);
        ctx.fillRect(-9, -34, 18, 12);
        break;
      }
      case 'vending': {
        ctx.fillStyle = ER.Palette.lightGray;
        ctx.fillRect(-13, -46, 26, 46);
        ctx.fillStyle = ER.Palette.window;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-9, -40, 18, 26);
        break;
      }
      case 'bicycle': {
        ctx.strokeStyle = ER.Palette.charcoal;
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
        ctx.strokeStyle = ER.Palette.darkGray;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -48);
        ctx.stroke();
        ctx.fillStyle = ER.Palette.offWhite;
        ctx.beginPath();
        ctx.arc(0, -52, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'mirror': {
        ctx.strokeStyle = ER.Palette.darkGray;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -40);
        ctx.stroke();
        ctx.fillStyle = ER.Palette.lightGray;
        ctx.beginPath();
        ctx.ellipse(6, -44, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sign': {
        ctx.strokeStyle = ER.Palette.darkGray;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -34);
        ctx.stroke();
        ctx.fillStyle = ER.Palette.charcoal;
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
    ctx.fillStyle = ER.Palette.charcoal;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillRect(-w / 2 + 8, -h - 10, w - 20, 10);
    ctx.fillStyle = ER.Palette.window;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-w / 2 + 10, -h - 8, w - 24, 7);
    ctx.fillStyle = ER.Palette.darkGray;
    ctx.globalAlpha = 0.9;
    const wheelR = 5;
    for (const wx of [-w / 2 + 9, w / 2 - 9]) {
      ctx.save();
      ctx.translate(wx, 0);
      ctx.rotate(car.wheelSpin);
      ctx.beginPath(); ctx.arc(0, 0, wheelR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ER.Palette.offWhite; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-wheelR, 0); ctx.lineTo(wheelR, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * The character. Side-view, flat-shaded, mostly silhouette — a lonely girl
   * walking home in the rain. Same feet-at-origin pivot and umbrella
   * placement as before (translate(0,-50)) so nothing downstream (collision,
   * camera) needed to change.
   */
  drawPlayer(sx, sy, player, wind) {
    const ctx = this.ctx;
    const bob = player.bob;
    const legSwing = player.legSwing;
    const jumpY = -(player.jumpOffset || 0);
    const windLean = wind ? ER.Util.clamp(wind.angle / 60, -1, 1) : 0;
    const hairSway = Math.sin(player.walkCycle * 1.4) * 2.2 + windLean * 2.4;

    ctx.save();
    ctx.translate(sx, sy + bob + jumpY);

    // --- legs, thin and pale ---
    ctx.strokeStyle = ER.Palette.charcoal;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, -20); ctx.lineTo(-3 + legSwing * 0.3, -1);
    ctx.moveTo(3, -20); ctx.lineTo(3 - legSwing * 0.3, -1);
    ctx.stroke();

    // shoes
    ctx.fillStyle = ER.Palette.offWhite;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(-3 + legSwing * 0.3, 0, 4, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(3 - legSwing * 0.3, 0, 4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- skirt: dark, pleated, flares slightly with the walk ---
    const skirtSway = legSwing * 0.14;
    ctx.fillStyle = ER.Palette.darkGray;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(-9, -30);
    ctx.lineTo(9, -30);
    ctx.lineTo(12 + skirtSway, -12);
    ctx.lineTo(-12 + skirtSway, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ER.Palette.charcoal;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 6, -29);
      ctx.lineTo(i * 6 + skirtSway * 0.6, -13);
      ctx.stroke();
    }

    // --- blouse: oversized, white, sailor collar ---
    ctx.fillStyle = ER.Palette.offWhite;
    ctx.globalAlpha = 0.97;
    ctx.beginPath();
    ctx.roundRect(-12, -52, 24, 24, 7);
    ctx.fill();
    ctx.strokeStyle = ER.Palette.charcoal;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-6, -52); ctx.lineTo(0, -44); ctx.lineTo(6, -52);
    ctx.stroke();
    ctx.fillStyle = ER.Palette.charcoal;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, -44); ctx.lineTo(-2.4, -39); ctx.lineTo(2.4, -39);
    ctx.closePath();
    ctx.fill();

    // --- head: pale, minimal ---
    ctx.fillStyle = ER.Palette.skin;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, -58, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // --- hair: long, straight, black; trails slightly with walk + wind ---
    ctx.fillStyle = ER.Palette.hair;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(-8, -63);
    ctx.quadraticCurveTo(-11 + hairSway * 0.5, -50, -9 + hairSway, -27);
    ctx.quadraticCurveTo(-4, -30, -6, -50);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -63);
    ctx.quadraticCurveTo(11 + hairSway * 0.5, -50, 9 + hairSway, -27);
    ctx.quadraticCurveTo(4, -30, 6, -50);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -61, 8.7, Math.PI, 0);
    ctx.fill();

    // minimal face — a single tiny mark, mostly silhouette
    ctx.fillStyle = ER.Palette.charcoal;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(3.2, -58, 0.85, 0, Math.PI * 2);
    ctx.fill();

    // --- umbrella: unchanged geometry — still the entire mechanic ---
    ctx.save();
    ctx.translate(0, -50);
    ctx.rotate(ER.Util.deg2rad(player.umbrella.angle));
    ctx.strokeStyle = ER.Palette.darkGray;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -player.umbrella.canopyLength);
    ctx.stroke();
    ctx.fillStyle = ER.Palette.offWhite;
    ctx.globalAlpha = 0.94;
    ctx.beginPath();
    ctx.arc(0, -player.umbrella.canopyLength, player.umbrella.canopyHalfWidth, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ER.Palette.coolGray;
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
    if (kind === 'litterBag') {
      ctx.fillStyle = ER.Palette.warmWhite;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 8, Math.sin(t) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};
