'use strict';
// ============================================================
// OH SHIM MY UMRELLA — shimmy.js  (flat sidewalk, parallax city)
// Normal horizontal view. Multiple parallax city layers behind
// a flat rainy sidewalk. NPCs walk L↔R. Wind steals umbrellas.
// ============================================================
(function () {

  const P = {
    sky0:'#0c1018', sky1:'#1c2836',
    road:'#1a1e26', curb:'#262c3c', swalk:'#343c4e', swalkB:'#2e3448',
    npcCoats:['#3d4759','#453861','#3d5947','#59403a','#3e5060','#504840'],
    skinTones:['#c09070','#b87850','#d0a882','#c8906a'],
    umbCols:['#4e7090','#88586e','#4e886e','#887850','#5e508a','#884e4e'],
    rain:'rgba(155,182,218,',
    splash:'rgba(155,192,238,.76)',
  };

  const canvas = document.getElementById('shimmy-canvas');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, GY = 0, SH = 0; // GY=ground Y, SH=sidewalk height

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = r.width; H = r.height;
    GY = Math.round(H * 0.72); SH = Math.round(H * 0.12);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    initRain(); initPuddles();
  }
  window.addEventListener('resize', resize);

  const sr = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5; return x - Math.floor(x); };

  // ── Rain ─────────────────────────────────────────────────
  const RL = [
    { cnt: 110, spd: 360, len: 9,  alpha: .13, lw: 1.0 },
    { cnt: 195, spd: 555, len: 16, alpha: .30, lw: 1.4 },
    { cnt: 68,  spd: 830, len: 27, alpha: .57, lw: 2.2 },
  ];
  let drops = [[], [], []];
  function initRain() {
    for (let li = 0; li < 3; li++) { drops[li] = []; for (let i = 0; i < RL[li].cnt; i++) drops[li].push({ x: Math.random() * (W + 300) - 150, y: Math.random() * H, sm: .78 + Math.random() * .44 }); }
  }

  const MAX_SP = 180;
  const sp = Array.from({ length: MAX_SP }, () => ({ a: false, x:0, y:0, vx:0, vy:0, l:0, ml:1, sz:1 }));
  function spSplash(x, y, n = 3, dx = 0) {
    let k = 0;
    for (const p of sp) { if (k >= n) break; if (p.a) continue; p.a = true; p.x = x; p.y = y; const ang = -Math.PI/2+(Math.random()-.5)*1.6+dx*.3; const spd = 24+Math.random()*58; p.vx=Math.cos(ang)*spd+dx*26; p.vy=Math.sin(ang)*spd; p.l=0; p.ml=.22+Math.random()*.22; p.sz=1+Math.random()*2.1; k++; }
  }

  // ── Puddles ──────────────────────────────────────────────
  let puddles = [];
  function initPuddles() {
    puddles = [];
    for (let i = 0; i < 11; i++) puddles.push({ x: Math.random() * W, y: GY - 8 + Math.random() * (SH - 8), r: 7 + Math.random() * 20, s: Math.random() });
  }

  // ── Wind ────────────────────────────────────────────────
  const wind = { baseX: .20, gustX: 0, str: 0, dir: 1, phase: 'idle', pT: 0, idleT: 3.5 };
  function updateWind(dt) {
    switch (wind.phase) {
      case 'idle': wind.idleT -= dt; if (wind.idleT <= 0 && gameStarted) { wind.phase='ramp'; wind.pT=1.3; wind.dir=Math.random()<.68?1:-1; wind.str=0; const el=document.getElementById('shimmy-gust-warn'); if(el){el.textContent=wind.dir>0?'wind →':'← wind';el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),1700);} } break;
      case 'ramp': wind.pT-=dt; wind.str=Math.min(wind.str+dt/1.3,1); if(wind.pT<=0){wind.phase='peak';wind.pT=.5;blowOff();} break;
      case 'peak': wind.pT-=dt; if(wind.pT<=0){wind.phase='fade';wind.pT=1.8;} break;
      case 'fade': wind.pT-=dt; wind.str=Math.max(wind.str-dt/1.8,0); if(wind.pT<=0){wind.phase='idle';wind.idleT=3.5+Math.random()*6;wind.str=0;} break;
    }
    wind.gustX = wind.dir * wind.str * .62;
  }

  // ── NPCs ────────────────────────────────────────────────
  let npcs = [], npcId = 0, npcTimer = 1.5;
  function spawnNpc() {
    if (npcs.length >= 5) return;
    const dir = Math.random() < .55 ? 1 : -1;
    const x = dir > 0 ? -80 : W + 80;
    const sc = .78 + Math.random() * .38;
    const ci = Math.floor(Math.random() * P.npcCoats.length);
    const uc = P.umbCols[Math.floor(Math.random() * P.umbCols.length)];
    const sk = P.skinTones[Math.floor(Math.random() * P.skinTones.length)];
    npcs.push({ id: npcId++, x, y: GY, dir, spd: 42+Math.random()*52, sc, coat:P.npcCoats[ci], umbCol:uc, skin:sk, hasUmb:true, umbAngle:dir>0?-6:6, state:'walk', stT:0, wc:Math.random()*Math.PI*2, leg:0, bob:0 });
  }
  function updateNpcs(dt) {
    for (const n of npcs) {
      n.wc += dt * 3.9; n.leg = Math.sin(n.wc) * 12; n.bob = Math.abs(Math.sin(n.wc)) * 1.7;
      const spd = n.state==='surprised'?0:n.state==='sad'?n.spd*.58:n.spd;
      n.x += n.dir * spd * dt;
      if (n.hasUmb) { const tgt = wind.gustX*14; n.umbAngle+=(tgt-n.umbAngle)*dt*4.5; }
      if (n.state==='surprised'||n.state==='happy') { n.stT-=dt; if(n.stT<=0) n.state=n.state==='surprised'?'sad':'walk'; }
    }
    npcs = npcs.filter(n => n.x > -160 && n.x < W + 160);
    npcTimer -= dt; if (npcTimer <= 0) { spawnNpc(); npcTimer = 2.0+Math.random()*3.5; }
  }

  // ── Umbrellas ───────────────────────────────────────────
  let umbrellas = [], draggedUmb = null, hintShown = false;
  function blowOff() {
    const cands = npcs.filter(n => n.hasUmb && n.state==='walk');
    if (!cands.length) return;
    const n = cands[Math.floor(Math.random() * cands.length)];
    n.hasUmb = false; n.state = 'surprised'; n.stT = 1.8;
    umbrellas.push({ x:n.x, y:n.y-68*n.sc, vx:wind.dir*(230+Math.random()*130), vy:-92-Math.random()*55, angle:n.umbAngle, angVel:(Math.random()-.5)*260+wind.dir*145, col:n.umbCol, owner:n, state:'drift', timer:6.5, nearHL:0 });
    if (!hintShown) { hintShown=true; const h=document.getElementById('shimmy-drag-hint'); if(h){h.classList.add('visible');setTimeout(()=>h.classList.remove('visible'),3200);} }
  }
  function updateUmbrellas(dt) {
    const wx = wind.baseX + wind.gustX;
    for (const u of umbrellas) {
      if (u.state==='grabbed') { u.x+=(mouse.x-u.x)*Math.min(dt*14,1); u.y+=(mouse.y-u.y)*Math.min(dt*14,1); u.angle+=(0-u.angle)*dt*7.5; u.timer-=dt; u.nearHL=0; if(u.timer<=0) loseUmb(u); }
      else if (u.state==='drift') { u.timer-=dt; u.vx+=wx*108*dt; u.vy+=28*dt; u.vx*=Math.pow(.925,dt*60); u.vy*=Math.pow(.925,dt*60); u.x+=u.vx*dt; u.y+=u.vy*dt; u.angle+=u.angVel*dt; u.angVel*=Math.pow(.87,dt*60); const dx=u.x-mouse.x,dy=u.y-mouse.y; u.nearHL=Math.max(0,1-Math.sqrt(dx*dx+dy*dy)/65); if(u.timer<=0||u.x<-110||u.x>W+110||u.y<-100||u.y>H+60) loseUmb(u); }
    }
    umbrellas = umbrellas.filter(u => u.state==='drift'||u.state==='grabbed');
  }
  function loseUmb(u) { u.state='lost'; if(u.owner.state!=='happy') u.owner.state='sad'; streak=0; lost++; fb(Math.max(50,Math.min(u.x,W-50)),Math.min(u.y+10,H-50),'gone',false); updateHUD(); if(draggedUmb===u){draggedUmb=null;canvas.style.cursor='default';} }
  function returnUmb(u) { u.state='returned'; u.owner.hasUmb=true; u.owner.umbCol=u.col; u.owner.umbAngle=0; u.owner.state='happy'; u.owner.stT=2.3; score++; streak++; if(streak>best)best=streak; fb(u.x,u.owner.y-90*u.owner.sc,streak>1?`${streak}×`:'saved',true); updateHUD(); if(draggedUmb===u){draggedUmb=null;canvas.style.cursor='default';} }

  let score=0, lost=0, streak=0, best=0;
  function updateHUD() { const s=document.getElementById('shimmy-score');if(s)s.textContent=score; const l=document.getElementById('shimmy-lost');if(l)l.textContent=lost; const st=document.getElementById('shimmy-streak');if(st){st.style.opacity=streak>1?'1':'0';if(streak>1)st.textContent=`${streak}×`;} }

  let fbs = [];
  function fb(x,y,text,ok){fbs.push({x,y,text,ok,life:0,ml:1.7,vy:-36});}
  function updateFbs(dt){for(const f of fbs){f.life+=dt;f.y+=f.vy*dt;f.vy*=Math.pow(.83,dt*60);}fbs=fbs.filter(f=>f.life<f.ml);}

  // ── Input ────────────────────────────────────────────────
  const mouse = { x: 0, y: 0 };
  function evPos(e) { const r=canvas.getBoundingClientRect(),s=e.touches?e.touches[0]:e; return{x:s.clientX-r.left,y:s.clientY-r.top}; }
  function onMove(e) { const p=evPos(e); mouse.x=p.x; mouse.y=p.y; if(!draggedUmb){let near=false;for(const u of umbrellas){if(u.state!=='drift')continue;const dx=u.x-p.x,dy=u.y-p.y;if(dx*dx+dy*dy<68*68){near=true;break;}}canvas.style.cursor=near?'grab':'default';} }
  function onDown(e) { if(e.touches)e.preventDefault(); const p=evPos(e);mouse.x=p.x;mouse.y=p.y; let closest=null,closestD=74*74; for(const u of umbrellas){if(u.state!=='drift')continue;const dx=u.x-p.x,dy=u.y-p.y,d2=dx*dx+dy*dy;if(d2<closestD){closest=u;closestD=d2;}} if(closest){closest.state='grabbed';draggedUmb=closest;canvas.style.cursor='grabbing';} }
  function onUp(e) { if(e.touches)e.preventDefault(); if(!draggedUmb)return; const u=draggedUmb,own=u.owner; const dx=u.x-own.x,dy=u.y-(own.y-68*own.sc); if(dx*dx+dy*dy<92*92){returnUmb(u);}else{u.state='drift';u.vx=wind.gustX*40+(Math.random()-.5)*22;u.vy=-18;draggedUmb=null;canvas.style.cursor='default';} }
  canvas.addEventListener('mousemove',onMove); canvas.addEventListener('mousedown',onDown); canvas.addEventListener('mouseup',onUp);
  canvas.addEventListener('touchmove',onMove,{passive:false}); canvas.addEventListener('touchstart',onDown,{passive:false}); canvas.addEventListener('touchend',onUp,{passive:false});

  // ═══════════════════════════════════════════════════════
  //  RENDERING
  // ═══════════════════════════════════════════════════════

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.sky0); g.addColorStop(.75, P.sky1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // 4 graduated parallax city layers — far(faint/small) → near(bold/large)
  function drawCityLayers(elapsed) {
    const layers = [
      { prl: 0.03, alpha: 0.18, hFrac: 0.26, tileW: 38, cf: '#0b0f17', seed: 40 },
      { prl: 0.08, alpha: 0.30, hFrac: 0.40, tileW: 52, cf: '#101720', seed: 80 },
      { prl: 0.15, alpha: 0.44, hFrac: 0.56, tileW: 68, cf: '#162030', seed: 120 },
      { prl: 0.26, alpha: 0.58, hFrac: 0.70, tileW: 88, cf: '#1d2a3a', seed: 160 },
    ];
    const camX = elapsed * 16; // slow automatic drift makes scene feel alive
    for (const [li, L] of layers.entries()) {
      const camOff = camX * L.prl;
      const startI = Math.floor((camOff - 100) / L.tileW);
      for (let bi = startI; bi < startI + Math.ceil((W + 240) / L.tileW) + 2; bi++) {
        const bw = L.tileW * (0.50 + sr(L.seed + bi * 7) * 0.74);
        const bh = GY * L.hFrac * (0.38 + sr(L.seed + bi * 13) * 0.76);
        const bx = bi * L.tileW - camOff;
        const by = GY; // anchored at ground level
        ctx.globalAlpha = L.alpha;
        ctx.fillStyle = L.cf;
        ctx.fillRect(bx, by - bh, bw, bh);
        // Window lights
        ctx.fillStyle = 'rgba(200,222,255,0.11)';
        const wr = 2 + li, wh = 4 + Math.round(li * 0.5);
        for (let wy = by - bh + 7; wy < by - 5; wy += 12) {
          for (let wx = bx + 4; wx < bx + bw - 3; wx += 9) {
            if (sr(wx * 0.09 + wy * 0.07 + li * 50) > 0.44) ctx.fillRect(wx, wy, wr, wh);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFog() {
    const g = ctx.createLinearGradient(0, GY * .38, 0, GY * .62);
    g.addColorStop(0, 'rgba(44,70,108,.36)'); g.addColorStop(1, 'rgba(44,70,108,0)');
    ctx.fillStyle = g; ctx.fillRect(0, GY * .38, W, GY * .24);
  }

  function drawSidewalk() {
    // Road
    ctx.fillStyle = P.road; ctx.fillRect(0, GY + 12, W, H - GY - 12);
    // Curb face
    ctx.fillStyle = P.curb; ctx.fillRect(0, GY, W, 14);
    // Sidewalk surface
    const g = ctx.createLinearGradient(0, GY - SH, 0, GY);
    g.addColorStop(0, P.swalk); g.addColorStop(1, P.swalkB);
    ctx.fillStyle = g; ctx.fillRect(0, GY - SH, W, SH);
    // Wet sheen
    const sh = ctx.createLinearGradient(0, GY - SH, 0, GY);
    sh.addColorStop(0, 'rgba(55,105,175,.03)'); sh.addColorStop(.5, 'rgba(55,105,175,.11)'); sh.addColorStop(1, 'rgba(55,105,175,.05)');
    ctx.fillStyle = sh; ctx.fillRect(0, GY - SH, W, SH);
    // Slab lines
    ctx.save(); ctx.globalAlpha = .10; ctx.strokeStyle = '#6878a4'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < W; x += 82) { ctx.moveTo(x, GY - SH); ctx.lineTo(x, GY); }
    for (let y = GY - SH; y <= GY; y += Math.round(SH / 3)) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke(); ctx.restore();
    // Top edge highlight
    ctx.strokeStyle = 'rgba(82,108,168,.42)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, GY - SH); ctx.lineTo(W, GY - SH); ctx.stroke();
  }

  function drawPuddles(elapsed) {
    for (const p of puddles) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, .35);
      ctx.globalAlpha = .52; ctx.fillStyle = 'rgba(65,90,138,.62)';
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .75, 0, 0, Math.PI*2); ctx.fill();
      const rt = (elapsed * .88 + p.s * 7.2) % 1.9;
      ctx.strokeStyle='rgba(136,174,230,.52)'; ctx.lineWidth=1.4; ctx.globalAlpha=(1-rt/1.9)*.44;
      ctx.beginPath(); ctx.ellipse(0,0,p.r*rt*.58,p.r*.75*rt*.58,0,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawRainLayer(li) {
    const L = RL[li]; const wx = wind.baseX + wind.gustX;
    ctx.save(); ctx.strokeStyle = P.rain + L.alpha + ')'; ctx.lineWidth = L.lw; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const d of drops[li]) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - wx * L.len * .62, d.y - L.len); }
    ctx.stroke(); ctx.restore();
  }

  function drawNpc(n) {
    ctx.save(); ctx.translate(n.x, n.y + n.bob * n.sc); ctx.scale(n.dir, 1); ctx.scale(n.sc, n.sc);
    // Shadow
    ctx.save(); ctx.scale(1,.28); ctx.fillStyle='rgba(0,0,0,.44)'; ctx.globalAlpha=.52; ctx.beginPath(); ctx.ellipse(0,0,14,10,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    // Legs
    ctx.strokeStyle='#121620'; ctx.lineWidth=5.6; ctx.lineCap='round'; ctx.globalAlpha=.94;
    ctx.beginPath(); ctx.moveTo(-3,-22); ctx.lineTo(-3+n.leg*.24,2); ctx.moveTo(3,-22); ctx.lineTo(3-n.leg*.24,2); ctx.stroke();
    ctx.fillStyle='#0e1218'; ctx.globalAlpha=.88; ctx.beginPath(); ctx.ellipse(-3+n.leg*.24,3,5.6,2.9,0,0,Math.PI*2); ctx.ellipse(3-n.leg*.24,3,5.6,2.9,0,0,Math.PI*2); ctx.fill();
    // Coat
    ctx.fillStyle=n.coat; ctx.globalAlpha=.97; ctx.beginPath(); ctx.roundRect(-10,-50,20,30,[5,5,7,7]); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-3,-50); ctx.lineTo(0,-43); ctx.lineTo(3,-50); ctx.stroke();
    // Neck
    ctx.fillStyle='rgba(175,138,102,.82)'; ctx.globalAlpha=.72; ctx.beginPath(); ctx.roundRect(-3,-54,6,7,2); ctx.fill();
    // Head + hair
    ctx.fillStyle=n.skin; ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(0,-58,8.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(16,14,12,.90)'; ctx.beginPath(); ctx.arc(0,-62,9.3,Math.PI,0); ctx.fill();
    // State
    if (n.state==='sad') { ctx.strokeStyle='rgba(115,158,218,.56)'; ctx.lineWidth=1.1; ctx.globalAlpha=.7; ctx.beginPath(); for(let i=-1;i<=1;i++){ctx.moveTo(i*5,-73);ctx.lineTo(i*5-.5,-58);} ctx.stroke(); }
    else if (n.state==='happy') { ctx.globalAlpha=.2; ctx.fillStyle='#62e088'; ctx.beginPath(); ctx.arc(0,-58,14,0,Math.PI*2); ctx.fill(); }
    else if (n.state==='surprised') { ctx.globalAlpha=.2; ctx.fillStyle='#e8d060'; ctx.beginPath(); ctx.arc(0,-58,14,0,Math.PI*2); ctx.fill(); }
    // Attached umbrella
    if (n.hasUmb) {
      ctx.save(); ctx.translate(2,-68); ctx.rotate(n.umbAngle*Math.PI/180);
      ctx.strokeStyle='#14141c'; ctx.lineWidth=2.6; ctx.globalAlpha=1; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-28); ctx.stroke();
      ctx.fillStyle=n.umbCol; ctx.globalAlpha=.93; ctx.beginPath(); ctx.arc(0,-28,22,Math.PI,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.1)'; ctx.globalAlpha=.58; ctx.beginPath(); ctx.arc(-6,-35,8,Math.PI*1.08,Math.PI*1.78); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=.9; ctx.beginPath(); for(let r=-3;r<=3;r+=1.5){ctx.moveTo(0,-28);ctx.lineTo(r<0?-22:22,-28);} ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawUmbrella(u) {
    const { x, y, angle, col, nearHL, state, timer } = u;
    if (nearHL > 0 && state==='drift') { ctx.save(); const ag=ctx.createRadialGradient(x,y-30,0,x,y-30,55); ag.addColorStop(0,`rgba(115,148,190,${nearHL*.35})`); ag.addColorStop(1,'rgba(115,148,190,0)'); ctx.fillStyle=ag; ctx.fillRect(x-62,y-88,124,118); ctx.restore(); }
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle*Math.PI/180);
    ctx.strokeStyle='#121218'; ctx.lineWidth=3; ctx.globalAlpha=.96; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-34); ctx.stroke();
    ctx.fillStyle=col; ctx.globalAlpha=.93; ctx.beginPath(); ctx.arc(0,-34,29,Math.PI,0); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.13)'; ctx.globalAlpha=.62; ctx.beginPath(); ctx.arc(-10,-43,13,Math.PI*1.05,Math.PI*1.78); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=1; ctx.beginPath(); for(let r=-3;r<=3;r++){ctx.moveTo(0,-34);ctx.lineTo(r<0?-29:29,-34);} ctx.stroke();
    ctx.restore();
    if (state==='drift'||state==='grabbed') {
      const frac = Math.max(0, timer/6.5);
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle*Math.PI/180);
      ctx.strokeStyle=frac>.45?'rgba(78,205,128,.86)':'rgba(218,72,62,.86)'; ctx.lineWidth=3.2; ctx.lineCap='round'; ctx.globalAlpha=.88;
      ctx.beginPath(); ctx.arc(0,-34,40,-Math.PI/2,-Math.PI/2+Math.PI*2*frac); ctx.stroke();
      ctx.restore();
    }
  }

  function drawSplashes() { ctx.save(); ctx.fillStyle=P.splash; for(const p of sp){if(!p.a)continue;ctx.globalAlpha=(1-p.l/p.ml)*.72;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);ctx.fill();} ctx.restore(); }

  function drawFbs() {
    ctx.save(); ctx.textAlign='center'; ctx.font='bold 15px Nunito,sans-serif';
    for(const f of fbs){ ctx.globalAlpha=Math.max(0,1-(f.life/f.ml)*1.4); ctx.shadowColor=f.ok?'#163826':'#361616'; ctx.shadowBlur=8; ctx.fillStyle=f.ok?'#74de96':'#de7474'; ctx.fillText(f.text,f.x,f.y); }
    ctx.shadowBlur=0; ctx.restore();
  }

  function drawGustEdge() { if(wind.str<.14)return; const ex=wind.dir>0?0:W; const g=ctx.createLinearGradient(ex,0,ex+wind.dir*70,0); g.addColorStop(0,`rgba(110,140,185,${wind.str*.2})`); g.addColorStop(1,'rgba(110,140,185,0)'); ctx.fillStyle=g; ctx.fillRect(ex,0,wind.dir*70,H); }

  function drawVignette() { const r=ctx.createRadialGradient(W*.5,H*.5,H*.24,W*.5,H*.5,H*.9); r.addColorStop(0,'rgba(8,11,16,0)'); r.addColorStop(1,'rgba(8,11,16,.48)'); ctx.fillStyle=r; ctx.fillRect(0,0,W,H); }

  function render(elapsed) {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawCityLayers(elapsed);  // graduated parallax city behind sidewalk
    drawFog();
    drawRainLayer(0);
    drawSidewalk();
    drawPuddles(elapsed);
    drawRainLayer(1);
    const sorted = [...npcs].sort((a,b)=>a.sc-b.sc); // smaller (background feel) first
    for (const n of sorted) drawNpc(n);
    for (const u of umbrellas) drawUmbrella(u);
    drawSplashes();
    drawRainLayer(2);
    drawFbs();
    drawGustEdge();
    drawVignette();
  }

  // ── Loop ─────────────────────────────────────────────────
  let gameStarted = false, elapsed = 0, lastT = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - lastT) / 1000, .05); lastT = now; elapsed += dt;
    updateWind(dt);
    const wx = wind.baseX + wind.gustX;
    for (let li = 0; li < 3; li++) {
      const L = RL[li];
      for (const d of drops[li]) {
        d.x += wx * L.spd * d.sm * dt; d.y += L.spd * d.sm * dt;
        if (d.y > H + 12) { d.y = -22-Math.random()*38; d.x=Math.random()*(W+300)-150; if(li>0&&Math.random()<.28)spSplash(d.x,GY-8+Math.random()*SH,1,wx*.3); }
        if (d.x < -200) d.x += W + 400; if (d.x > W + 200) d.x -= W + 400;
      }
    }
    for (const p of sp) { if(!p.a)continue; p.l+=dt; if(p.l>=p.ml){p.a=false;continue;} p.vy+=242*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
    if (gameStarted) { updateNpcs(dt); updateUmbrellas(dt); updateFbs(dt); }
    render(elapsed);
  }

  function startGame() {
    if (gameStarted) return; gameStarted = true;
    const ov = document.getElementById('shimmy-instructions');
    if (ov) { ov.style.opacity='0'; ov.style.transition='opacity .5s ease'; setTimeout(()=>ov.style.display='none',500); }
  }

  function init() {
    resize(); spawnNpc(); setTimeout(spawnNpc, 1800); npcTimer = 2.2; lastT = performance.now();
    document.getElementById('shimmy-start-btn')?.addEventListener('click', startGame);
    canvas.addEventListener('click', () => { if (!gameStarted) startGame(); });
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
