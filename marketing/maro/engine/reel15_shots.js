// ================= 15s BEGINNER DIPLOMA REEL (60fps, 16:9 + 9:16 native) =================
// 120 BPM: one beat = 0.5s. Every cut lands on a beat; the music/SFX in reel15_audio.py use the same grid.
const DUR = 15;
const LV = (h, v) => VERT ? v : h;
const BEAT = 0.5;
const CUTS = [0, 1, 2, 4, 6, 8, 10, 12, 13.5, 15];
const WIPES = [null, 'bars', 'circle', 'bars', 'slice', 'circle', 'bars', 'slice', 'circle'];  // wipe INTO scene i
// visual stage: a 1000x800 local box, placed natively per format (no cropping)
const STG = () => VERT ? {x: W / 2, y: 1240, s: 0.98} : {x: 610, y: 590, s: 0.86};

// ---------- small helpers ----------
function kinetic(words, t, t0, step, size, y, o = {}) {       // RTL words slam in one by one
  const col = o.col || C.white, gap = size * 0.36;
  const ws = words.map(w => tw(w, size, 900)); const total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let xr = (o.cx ?? W / 2) + total / 2;
  words.forEach((w, i) => {
    const p = P(t, t0 + i * step, t0 + i * step + 0.16); if (p <= 0) { xr -= ws[i] + gap; return; }
    const s = lerp(1.7, 1, eOutExpo(p));
    ctx.save(); ctx.translate(xr - ws[i] / 2, y); ctx.scale(s, s); ctx.globalAlpha = clamp(p * 3);
    T(w, 0, 0, size, {col: i === words.length - 1 && o.lastCol ? o.lastCol : col, glow: o.glow || 0}); ctx.restore();
    xr -= ws[i] + gap;
  });
}
function stepHeader(t, t0, num, ar, en) {
  const pn = P(t, t0, t0 + 0.35), sN = lerp(2.4, 1, eob(pn));
  if (VERT) {
    ctx.save(); ctx.translate(W / 2, 300); ctx.scale(sN, sN); text3D(num, 0, 0, 200, {depth: 18, alpha: clamp(pn * 3)}); ctx.restore();
    typeOn(ar, W / 2 + tw(ar, 88) / 2, 475, 88, t0 + 0.05, t, {col: C.white, dur: 0.3, glow: 12});
    T(en, W / 2, 560, 30, {w: 800, ls: 10, col: C.ember, alpha: P(t, t0 + 0.3, t0 + 0.5)});
  } else {
    ctx.save(); ctx.translate(W - 250, 300); ctx.scale(sN, sN); text3D(num, 0, 0, 210, {depth: 18, alpha: clamp(pn * 3)}); ctx.restore();
    typeOn(ar, W - 110, 500, 72, t0 + 0.05, t, {col: C.white, dur: 0.3, glow: 12});
    T(en, W - 110, 585, 30, {w: 800, ls: 10, col: C.ember, align: 'right', alpha: P(t, t0 + 0.3, t0 + 0.5)});
  }
}
function chips(t, t0, list, y) {                               // small pills that pop in, centred on the stage
  const sz = 30, pad = 26, gap = 18;
  const wsz = list.map(s => tw(s, sz, 800) + pad * 2); const tot = wsz.reduce((a, b) => a + b, 0) + gap * (list.length - 1);
  let x = tot / 2;
  list.forEach((s, i) => { const p = eob(P(t, t0 + i * 0.08, t0 + i * 0.08 + 0.3)); if (p > 0) pill(s, x - wsz[i] / 2, y, sz, {sc: p, w: 800}); x -= wsz[i] + gap; });
}
function stage(fn) { const g = STG(); ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.s, g.s); fn(); ctx.restore(); }
function sparks(t, t0, n, seed, spread = 520) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, sp = 200 + R() * spread, d = 0.5 + R() * 0.5, p = P(t, t0, t0 + d); if (p <= 0 || p >= 1) { R(); continue; }
    const r = eOutExpo(p) * sp, x = Math.cos(a) * r, y = Math.sin(a) * r;
    ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = R() > 0.5 ? C.ember : C.hi; ctx.beginPath(); ctx.arc(x, y, 5 * (1 - p) + 1, 0, 6.283); ctx.fill(); ctx.restore();
  }
}

// ---------- scenes ----------
function sHook1(t) {                                          // 0 - 1
  background(t, {glow: 0.6});
  const fl = Math.exp(-((t % BEAT)) * 10) * 0.25; if (fl > 0.01) { ctx.fillStyle = `rgba(196,50,31,${fl})`; ctx.fillRect(0, 0, W, H); }
  kinetic(['مش', 'هتخرج'], t, 0.02, 0.14, LV(150, 128), H / 2 - LV(90, 110));
  kinetic(['حافظ', 'أدوات..'], t, 0.32, 0.14, LV(150, 128), H / 2 + LV(90, 110), {lastCol: 'rgba(255,247,242,0.55)'});
}
function sHook2(t) {                                          // 1 - 2
  background(t, {glow: 1.2});
  const p = P(t, 1.0, 1.4);
  rays(W / 2, H / 2, 0.5 * eOut(p), t * 0.4);
  glowBlob(W / 2, H / 2, 700, 'rgba(255,110,40,0.35)', p);
  kinetic(['هتفكر'], t, 1.02, 0.1, LV(150, 130), H / 2 - LV(120, 150));
  const q = P(t, 1.22, 1.45); if (q > 0) {                   // "كمصمم." slams with an RGB split that settles
    const s = lerp(2.2, 1, eOutExpo(q)), sp = (1 - eOutExpo(q)) * 24;
    ctx.save(); ctx.translate(W / 2, H / 2 + LV(70, 60)); ctx.scale(s, s);
    if (sp > 0.5) { ctx.globalCompositeOperation = 'lighter'; T('كمصمم.', -sp, 0, LV(230, 190), {col: 'rgba(255,40,40,0.6)'}); T('كمصمم.', sp, 0, LV(230, 190), {col: 'rgba(40,160,255,0.5)'}); ctx.globalCompositeOperation = 'source-over'; }
    text3D('كمصمم.', 0, 0, LV(230, 190), {depth: 20, front: C.ember}); ctx.restore();
  }
}
function sPrograms(t) {                                        // 2 - 4 : layers explode + pen tool
  const t0 = 2; background(t);
  stepHeader(t, t0, '01', 'إتقان البرامج', 'PHOTOSHOP + ILLUSTRATOR');
  stage(() => {
    const ex = eOutExpo(P(t, t0 + 0.25, t0 + 0.8));
    const layers = [
      () => { rr(ctx, -300, -200, 600, 400, 26); const g = ctx.createLinearGradient(0, -200, 0, 200); g.addColorStop(0, '#3a0b07'); g.addColorStop(1, '#170403'); ctx.fillStyle = g; ctx.fill(); },
      () => imgCard(IM.V1, 0, 0, 560, 360, {shadow: false, r: 20}),
      () => { ctx.fillStyle = C.ember; ctx.shadowColor = C.ember; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(170, -90, 70, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; },
      () => { T('SARA', -140, 120, 70, {w: 900, col: '#fff', glow: 16}); },
    ];
    const names = ['Background', 'Photo', 'Shape', 'Text'];
    layers.forEach((draw, i) => {
      ctx.save(); ctx.translate(-80 + i * 34 * ex, 60 - i * 118 * ex);
      ctx.transform(1, -0.18 * ex, 0.42 * ex, 1 - 0.45 * ex, 0, 0);
      ctx.globalAlpha = clamp(P(t, t0 + 0.05 + i * 0.05, t0 + 0.25 + i * 0.05) * 3); draw();
      if (ex > 0.2) { ctx.strokeStyle = `rgba(255,150,80,${0.8 * ex})`; ctx.lineWidth = 3; rr(ctx, -300, -200, 600, 400, 26); ctx.stroke(); }
      ctx.restore();
      T(names[i], VERT ? -400 : 420, 150 - i * 118 * ex, 26, {w: 800, align: VERT ? 'right' : 'left', col: 'rgba(255,200,160,0.9)', alpha: ex});
    });
    // pen tool: a bezier drawn with anchors + handles
    const pp = eInOut(P(t, t0 + 0.9, t0 + 1.7)); if (pp > 0) {
      const A = [-430, 330], B = [430, 300], c1 = [-200, 80], c2 = [180, 520];
      ctx.save(); ctx.strokeStyle = C.hi; ctx.lineWidth = 7; ctx.shadowColor = C.ember; ctx.shadowBlur = 20; ctx.lineCap = 'round';
      ctx.beginPath(); const N = 60; for (let k = 0; k <= N * pp; k++) { const u = k / N, v = 1 - u;
        const x = v*v*v*A[0] + 3*v*v*u*c1[0] + 3*v*u*u*c2[0] + u*u*u*B[0], y = v*v*v*A[1] + 3*v*v*u*c1[1] + 3*v*u*u*c2[1] + u*u*u*B[1]; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...c1); ctx.stroke(); if (pp > 0.7) { ctx.beginPath(); ctx.moveTo(...B); ctx.lineTo(...c2); ctx.stroke(); }
      for (const q of [A, c1, ...(pp > 0.7 ? [c2, B] : [])]) { ctx.fillStyle = '#fff'; ctx.fillRect(q[0] - 9, q[1] - 9, 18, 18); }
      ctx.restore();
    }
  });
}
function sAcademic(t) {                                        // 4 - 6 : colour wheel + thirds grid + perspective
  const t0 = 4; background(t);
  stepHeader(t, t0, '02', 'تأسيس أكاديمي', 'DESIGN FUNDAMENTALS');
  stage(() => {
    // perspective lines behind everything
    const pl = P(t, t0 + 0.1, t0 + 0.6); ctx.save(); ctx.globalAlpha = 0.35 * pl; ctx.strokeStyle = C.ember; ctx.lineWidth = 2;
    for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(k * 160 * pl, 460); ctx.stroke(); } ctx.restore();
    // colour wheel
    const cx = -250, cy = -20, R0 = 90, R1 = 220, rot = t * 1.4;
    for (let i = 0; i < 12; i++) { const p = eob(P(t, t0 + 0.15 + i * 0.03, t0 + 0.4 + i * 0.03)); if (p <= 0) continue;
      const a0 = rot + i * Math.PI / 6, a1 = a0 + Math.PI / 6 - 0.04;
      ctx.beginPath(); ctx.arc(cx, cy, R0 + (R1 - R0) * p, a0, a1); ctx.arc(cx, cy, R0, a1, a0, true); ctx.closePath();
      ctx.fillStyle = `hsl(${i * 30},82%,56%)`; ctx.fill(); }
    T('COLOR', cx, cy, 34, {w: 900, alpha: P(t, t0 + 0.5, t0 + 0.7)});
    // thirds grid over a real poster
    const gp = P(t, t0 + 0.35, t0 + 0.7); imgCard(IM.V4, 250, -20, 360, 450, {rotY: 0.08, alpha: clamp(gp * 2)});
    const lp = eInOut(P(t, t0 + 0.7, t0 + 1.2)); if (lp > 0) { ctx.save(); ctx.strokeStyle = 'rgba(255,230,200,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
      for (const f of [1 / 3, 2 / 3]) { ctx.beginPath(); ctx.moveTo(70 + 360 * f, -245); ctx.lineTo(70 + 360 * f, -245 + 450 * lp); ctx.stroke(); ctx.beginPath(); ctx.moveTo(70, -245 + 450 * f); ctx.lineTo(70 + 360 * lp, -245 + 450 * f); ctx.stroke(); }
      ctx.setLineDash([]); ctx.restore();
      for (const [fx, fy] of [[1/3,1/3],[2/3,1/3],[1/3,2/3],[2/3,2/3]]) { const d = eob(P(t, t0 + 1.1, t0 + 1.35)); ctx.fillStyle = C.ember; ctx.shadowColor = C.ember; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(70 + 360 * fx, -245 + 450 * fy, 12 * d, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; } }
    chips(t, t0 + 1.0, ['تحليل التصميم', 'المنظور', 'نظريات الألوان', 'أسس التصميم'], 330);
  });
}
function sAI(t) {                                              // 6 - 8 : prompt -> generated image
  const t0 = 6; background(t);
  stepHeader(t, t0, '03', 'ذكاء صناعي للمصممين', 'AI FOR DESIGNERS');
  stage(() => {
    const bp = eOutExpo(P(t, t0 + 0.05, t0 + 0.3)); ctx.save(); ctx.globalAlpha = bp;
    rr(ctx, -460, -390, 920, 96, 48); ctx.fillStyle = 'rgba(12,6,5,0.95)'; ctx.fill(); ctx.strokeStyle = C.ember; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    const pr = 'family portrait, cinematic light, 3D clinic';
    const n = Math.floor(pr.length * P(t, t0 + 0.15, t0 + 0.8)); T(pr.slice(0, n) + (Math.floor(t * 8) % 2 ? '|' : ''), -420, -342, 34, {w: 700, align: 'left', alpha: bp});
    T('PROMPT', 400, -342, 22, {w: 900, ls: 4, col: C.ember, align: 'right', alpha: bp});
    const q = P(t, t0 + 0.8, t0 + 1.55); const iw = 820, ih = 461;
    if (t < t0 + 0.8) { card(-iw / 2, 60 - ih / 2, iw, ih, {fill: 'rgba(10,5,4,0.9)', alpha: P(t, t0 + 0.3, t0 + 0.5)}); }
    else pixelResolve(IM.V2a, 0, 60, iw, ih, q);
    if (q > 0 && q < 1) T(`AI GENERATING  ${Math.floor(eOut(q) * 100)}%`, 0, 60 + ih / 2 + 44, 26, {w: 800, ls: 8, col: '#FFB070'});
    if (t > t0 + 1.55) { const fl = Math.exp(-(t - t0 - 1.55) * 7); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowBlob(0, 60, 700, `rgba(255,220,190,${0.7 * fl})`, 1); ctx.restore(); sparks(t, t0 + 1.55, 26, 5); }
  });
}
function sMarket(t) {                                          // 8 - 10 : portfolio board assembles
  const t0 = 8; background(t);
  stepHeader(t, t0, '04', 'تأهيل لسوق العمل', 'PORTFOLIO · BEHANCE · CV');
  stage(() => {
    const fp = eOutExpo(P(t, t0 + 0.05, t0 + 0.35)); card(-470, -380, 940, 700, {r: 30, alpha: fp, glow: 30});
    T('PORTFOLIO', -430, -330, 30, {w: 900, ls: 8, align: 'left', col: C.ember, alpha: fp});
    const imgs = [IM.V1, IM.V3, IM.V5, IM.V6, IM.V7, IM.V4], R = rng(9);
    imgs.forEach((im, i) => { const c = i % 3, r = Math.floor(i / 3); const tx = -300 + c * 300, ty = -140 + r * 280;
      const sx = (R() - 0.5) * 1600, sy = (R() - 0.5) * 1400, rot0 = (R() - 0.5) * 1.2;
      const p = eOutExpo(P(t, t0 + 0.2 + i * 0.07, t0 + 0.6 + i * 0.07)); if (p <= 0) return;
      ctx.save(); ctx.translate(lerp(sx, tx, p), lerp(sy, ty, p)); ctx.rotate(rot0 * (1 - p)); imgCard(im, 0, 0, 270, 250, {shadow: false, r: 16}); ctx.restore(); });
    const cp = P(t, t0 + 0.9, t0 + 1.7);
    if (cp > 0) { T(`APPRECIATIONS  ${Math.floor(eOut(cp) * 1284).toLocaleString('en')}`, -430, 355, 28, {w: 800, align: 'left', ls: 2});
      T(`VIEWS  ${(eOut(cp) * 18.6).toFixed(1)}K`, 430, 355, 28, {w: 800, align: 'right', ls: 2, col: C.ember}); }
  });
}
function sGrad(t) {                                            // 10 - 12 : everything lands in one graduation project
  const t0 = 10; background(t, {glow: 1.2});
  stepHeader(t, t0, '05', 'مشروع التخرج', 'GRADUATION PROJECT');
  stage(() => {
    const ip = eOutExpo(P(t, t0 + 0.05, t0 + 0.45));
    const small = [IM.V1, IM.V4, IM.V2a, IM.V5]; small.forEach((im, i) => { const a = i * 1.57 + 0.6, r = lerp(520, 0, ip);
      ctx.save(); ctx.globalAlpha = 1 - ip; imgCard(im, Math.cos(a) * r, Math.sin(a) * r * 0.7, 200, 150, {shadow: false}); ctx.restore(); });
    imgCard(PA, 0, -10, lerp(120, 460, ip), lerp(150, 575, ip), {rotY: 0.06, alpha: clamp(ip * 2)});
    const sp = P(t, t0 + 0.6, t0 + 0.8); if (sp > 0) {        // stamp slam
      const s = lerp(3, 1, eOutExpo(sp)); ctx.save(); ctx.translate(210, 200); ctx.rotate(-0.18); ctx.scale(s, s); ctx.globalAlpha = clamp(sp * 3);
      rr(ctx, -210, -70, 420, 140, 22); ctx.strokeStyle = C.ember; ctx.lineWidth = 8; ctx.shadowColor = C.ember; ctx.shadowBlur = 30; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(196,50,31,0.25)'; ctx.fill(); T('مشروع التخرج', 0, 4, 58, {w: 900, col: C.hi}); ctx.restore(); }
    // confetti
    const R = rng(33); for (let i = 0; i < 70; i++) { const x0 = (R() - 0.5) * 1100, v = 300 + R() * 500, ph = R() * 6, st = t0 + 0.65 + R() * 0.2; const dt = t - st; if (dt < 0) { R(); continue; }
      const y = -520 + v * dt + 200 * dt * dt, x = x0 + Math.sin(ph + dt * 5) * 40; if (y > 520) { R(); continue; }
      ctx.save(); ctx.translate(x, y); ctx.rotate(ph + dt * 6); ctx.fillStyle = R() > 0.5 ? C.ember : (R() > 0.5 ? C.hi : '#fff'); ctx.fillRect(-7, -4, 14, 8); ctx.restore(); }
  });
  T('كل اللي اتعلمته.. في مشروع واحد', VERT ? W / 2 : W - 110, VERT ? 1790 : 700, LV(40, 44), {w: 800, align: VERT ? 'center' : 'right', alpha: P(t, t0 + 0.9, t0 + 1.2)});
}
function sMaro(t) {                                            // 12 - 13.5 : MARO flies in
  const t0 = 12; background(t, {glow: 1.3});
  const fp = eOutExpo(P(t, t0, t0 + 0.55));
  const mx = VERT ? W / 2 : 560, my = VERT ? lerp(H + 400, 1280, fp) : lerp(H + 400, 600, fp);
  glowBlob(mx, my, 520, 'rgba(255,110,40,0.4)', fp);
  maroAt('M2', mx + Math.sin(t * 3) * 10, my + Math.sin(t * 2.4) * 12, LV(330, 360), {expr: t > t0 + 0.6 ? 'wink' : 'happy', et: t - t0 - 0.6, t, thrust: 1.4, rot: (1 - fp) * -0.25});
  const tx = VERT ? W / 2 : 1330, ty = VERT ? 360 : 400;
  kinetic(['ومعاك', 'مارو'], t, t0 + 0.2, 0.12, LV(120, 110), ty, {cx: tx, lastCol: C.ember});
  const hp = P(t, t0 + 0.55, t0 + 0.8); if (hp > 0) { const s = lerp(2, 1, eob(hp)); ctx.save(); ctx.translate(tx, ty + LV(190, 190)); ctx.scale(s, s); text3D('24/7', 0, 0, LV(170, 170), {depth: 16, alpha: clamp(hp * 3)}); ctx.restore(); }
  T('مساعدك الذكي طول الكورس وبعده', tx, ty + LV(330, 330), LV(38, 38), {w: 700, alpha: P(t, t0 + 0.85, t0 + 1.1)});
}
function sEnd(t) {                                             // 13.5 - 15 : logo lock-up
  const t0 = 13.5; background(t, {glow: 1.4});
  const lp = eob(P(t, t0 + 0.05, t0 + 0.4)); rays(W / 2, H / 2 - LV(110, 200), 0.45 * lp, t * 0.5);
  const L = LV(260, 300); ctx.save(); ctx.translate(W / 2, H / 2 - LV(110, 200)); ctx.scale(lp, lp); ctx.shadowColor = 'rgba(196,50,31,0.9)'; ctx.shadowBlur = 60;
  rr(ctx, -L / 2, -L / 2, L, L, 50); ctx.clip(); ctx.drawImage(IM.logo, -L / 2, -L / 2, L, L); ctx.restore();
  T('دبلومة المبتدئين', W / 2, H / 2 + LV(110, 60), LV(80, 84), {w: 900, glow: 20, alpha: P(t, t0 + 0.25, t0 + 0.45)});
  T('صابر جروب.. معاك على طول', W / 2, H / 2 + LV(200, 160), LV(46, 50), {w: 800, col: C.ember, alpha: P(t, t0 + 0.45, t0 + 0.65)});
  const fo = P(t, DUR - 0.3, DUR); if (fo > 0) { ctx.fillStyle = `rgba(0,0,0,${fo})`; ctx.fillRect(0, 0, W, H); }
}
const SCENES = [sHook1, sHook2, sPrograms, sAcademic, sAI, sMarket, sGrad, sMaro, sEnd];

// ---------- wipes: drawn ON TOP around each cut, fully covering the frame at the cut itself ----------
function wipe(kind, p, i) {   // p: -1..1 around the cut (0 = cut, fully covered)
  const cov = 1 - Math.abs(p); if (cov <= 0) return; const e = eInOut(cov);
  ctx.save();
  if (kind === 'bars') { const n = 6; for (let k = 0; k < n; k++) { const h = H / n + 2, dir = k % 2 ? 1 : -1; const off = (1 - e) * W * 1.05 * dir * (p < 0 ? 1 : -1);
      ctx.fillStyle = k % 2 ? C.red : C.ember; ctx.fillRect(off, k * H / n, W, h); } }
  else if (kind === 'circle') { const r = e * Math.hypot(W, H) * 0.6; ctx.fillStyle = C.ember; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(0, r - 60 * (1 - e)), 0, 6.283); ctx.fill(); }
  else if (kind === 'slice') { ctx.fillStyle = C.ember; ctx.beginPath(); const x = (p < 0 ? -1 : 1) * (1 - e) * (W + H);
      ctx.moveTo(x - H * 0.4, 0); ctx.lineTo(x + W + H * 0.4, 0); ctx.lineTo(x + W, H); ctx.lineTo(x - H * 0.8, H); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
const WIPE_HALF = 0.11;
function scene(t) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.restore();
  let i = 0; while (i < SCENES.length - 1 && t >= CUTS[i + 1]) i++;
  // incoming punch: each scene starts slightly zoomed and settles on the beat
  const since = t - CUTS[i]; const pz = i ? 1 + 0.12 * Math.exp(-since * 14) : 1;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(pz, pz); ctx.translate(-W / 2, -H / 2); SCENES[i](t); ctx.restore();
  for (let k = 1; k < SCENES.length; k++) { const d = t - CUTS[k]; if (Math.abs(d) < WIPE_HALF) wipe(WIPES[k], d / WIPE_HALF, k); }
}
function nSub(t) { for (let k = 1; k < CUTS.length - 1; k++) if (Math.abs(t - CUTS[k]) < 0.2) return 8; return 4; }
