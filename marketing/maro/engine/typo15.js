// ================= 15s TYPOGRAPHY REEL (reference-matched structure, SABER GROUP content + palette) =================
// 120 BPM grid. Acts: intro line -> 4 beat words -> dot grid -> extruded word -> diagonal marquee -> counter -> dot burst -> lock-up
const DUR = 15, BEAT = 0.5;
const S = (h, v) => VERT ? v : h;
const K = {black: '#0b0706', cream: '#EFE7DC', red: '#C4321F', ember: '#FF6A1A', hi: '#FD9905', ink: '#140806', wine: '#5a0f14'};
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const eob = x => Math.max(0, eOutBack(x));
const eIO = x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;   // snappy quint in-out

function fill(c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
function vign(col, a) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col.replace('A', a)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function word(s, x, y, size, col, o = {}) { T(s, x, y, size, {w: o.w || 900, col, align: 'center', alpha: o.alpha ?? 1, glow: o.glow || 0, glowCol: o.glowCol}); }
// masked reveal: text rises from behind a horizontal line (clip)
function riseIn(s, x, y, size, col, p) { if (p <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(0, y - size * 0.75, W, size * 1.45); ctx.clip(); word(s, x, y + (1 - eOutExpo(p)) * size * 1.2, size, col); ctx.restore(); }
// extruded word: copies stepped along an angle, colour ramp from wine to ember, front face on top
function extrude(s, x, y, size, depth, ang, front, cA, cB, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); setFont(ctx, s, size, 900, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = Math.round(depth); i > 0; i--) { ctx.fillStyle = mix(cB, cA, Math.pow(1 - i / depth, 1.4)); ctx.fillText(s, dx * i * 2.2, dy * i * 2.2); }
  ctx.fillStyle = front; ctx.fillText(s, 0, 0); ctx.restore();
}

// ---------------- HUD (constant frame furniture) ----------------
const SECTIONS = [[0, 'المقدمة'], [4, 'الشكل'], [6.3, 'العمق'], [8.4, 'الخطوات'], [10.5, 'مارو'], [12.5, 'النهاية']];
function hud(t, dark) {
  const c = dark ? 'rgba(20,8,6,0.55)' : 'rgba(255,240,230,0.5)'; const m = S(26, 30), L = S(26, 30);
  ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 2;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke(); }
  ctx.restore();
  T('شوريل ' + AR(2026) + ' · صابر جروب', W - m - 8, m + 20, S(17, 20), {w: 700, col: c, align: 'right'});
  T(AR(String(Math.floor(t * 60)).padStart(3, '0')), m + 8, m + 20, S(17, 20), {w: 700, col: c, align: 'left'});
  let si = 0; SECTIONS.forEach((s, i) => { if (t >= s[0]) si = i; });
  ctx.fillStyle = c; ctx.fillRect(m + 8, H - m - 20, S(90, 110), 2);
  T(AR('0' + (si + 1)) + ' — ' + SECTIONS[si][1], W - m - 8, H - m - 20, S(17, 20), {w: 700, col: c, align: 'right'});
}

// ---------------- acts ----------------
function aIntro(t) {                                         // 0 - 2
  fill(K.black);
  const d = eob(P(t, 0.25, 0.45)); const lw = eIO(P(t, 0.55, 1.05)) * S(560, 520);
  const cy = H / 2;
  if (lw < 8) { ctx.fillStyle = K.ember; ctx.beginPath(); ctx.arc(W / 2, cy, 6 * d, 0, 6.283); ctx.fill(); }
  else { const sp = eOutExpo(P(t, 1.0, 1.25)) * S(95, 90);   // one line splits into two, the title rises between them
    ctx.fillStyle = K.red; ctx.fillRect(W / 2 - lw / 2, cy - sp - 2, lw, 3); ctx.fillRect(W / 2 - lw / 2, cy + sp - 1, lw, 3);
    riseIn('صابر جروب', W / 2, cy + 4, S(130, 120), K.cream, P(t, 1.05, 1.4));
    T(AR(15) + ' ثانية من التصميم', W / 2, cy - sp - S(34, 34), S(20, 24), {w: 700, col: 'rgba(255,240,230,0.7)', alpha: P(t, 1.3, 1.5)}); }
  const sw = eInExpo(P(t, 1.65, 2.0));                        // an ember dot grows and swallows the frame
  if (sw > 0) { ctx.fillStyle = K.ember; ctx.beginPath(); ctx.arc(W / 2 + S(40, 20), cy, sw * Math.hypot(W, H), 0, 6.283); ctx.fill(); }
}
function aBeats(t) {                                         // 2 - 4 : one word per beat
  const i = Math.min(3, Math.floor((t - 2) / BEAT)), lt = t - 2 - i * BEAT, p = P(lt, 0, 0.18);
  const big = S(250, 210);
  if (i === 0) { fill(K.ember); vign('rgba(120,20,5,A)', 0.55); const s = lerp(1.25, 1, eOutExpo(p)); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); word('فكرة', 0, 0, big, K.ink); ctx.restore(); }
  if (i === 1) { fill(K.black); const x = W / 2 + (1 - eOutExpo(P(lt, 0, 0.14))) * W * 0.9;   // fast slide -> sub-frame motion blur
    word('بتتحوّل', x, H / 2, big, K.cream); const bl = eOutExpo(P(lt, 0.15, 0.35)); ctx.fillStyle = K.red; ctx.fillRect(W / 2 + S(260, 150) - S(160, 120) * bl, H / 2 + S(150, 140), S(160, 120) * bl, 8); }
  if (i === 2) { fill(K.cream); vign('rgba(150,120,100,A)', 0.35);
    for (let k = -3; k <= 3; k++) { if (!k) continue; const off = k * big * 0.62 + (lt * 260) % (big * 0.62); word('لتصميم', W / 2, H / 2 + off, big, 'rgba(196,50,31,0.10)'); }
    const s = lerp(0.85, 1, eOutExpo(p)); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); word('لتصميم', 0, 0, big, K.red); ctx.restore(); }
  if (i === 3) { fill(K.red); vign('rgba(60,5,5,A)', 0.5); const rp = eOutExpo(P(lt, 0, 0.35));
    ctx.save(); ctx.strokeStyle = 'rgba(255,200,150,0.8)'; ctx.lineWidth = 6; ctx.globalAlpha = 1 - rp * 0.6; ctx.beginPath(); ctx.arc(W / 2 - S(140, 110), H / 2, lerp(40, S(210, 190), rp), 0, 6.283); ctx.stroke(); ctx.restore();
    const s = lerp(1.3, 1, eOutExpo(p)); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); word('يبيع.', 0, 0, big, K.cream); ctx.restore(); }
}
function aGrid(t) {                                          // 4 - 6.3 : dots -> breathing squares -> collapse to a diamond
  fill(K.black); const t0 = 4, g = S(64, 66), cols = Math.ceil(W / g) + 1, rows = Math.ceil(H / g) + 1;
  const ox = (W - (cols - 1) * g) / 2, oy = (H - (rows - 1) * g) / 2, R = rng(4);
  const morph = eIO(P(t, t0 + 0.9, t0 + 1.3)), col = P(t, t0 + 0.9, t0 + 1.4), coll = eInExpo(P(t, t0 + 1.9, t0 + 2.25));
  const maxd = Math.hypot(W, H) / 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = ox + c * g, y0 = oy + r * g, d = Math.hypot(x0 - W / 2, y0 - H / 2) / maxd, rnd = R(), rnd2 = R();
    const app = eob(P(t, t0 + d * 0.55, t0 + d * 0.55 + 0.25)); if (app <= 0) continue;
    const breathe = 0.75 + 0.25 * Math.sin((t - t0) * 7 - d * 9);
    const sz = g * 0.36 * app * (morph > 0 ? lerp(1, breathe * 1.25, morph) : 1) * (1 - coll);
    const x = lerp(x0, W / 2, coll), y = lerp(y0, H / 2, coll); if (sz < 0.5) continue;
    const pal = rnd < 0.5 ? K.cream : (rnd < 0.8 ? K.ember : K.red);
    ctx.save(); ctx.translate(x, y); ctx.rotate(morph * (Math.sin((t - t0) * 3 + d * 6) * 0.6)); ctx.fillStyle = col > rnd2 ? pal : K.cream;
    if (morph <= 0) { ctx.beginPath(); ctx.arc(0, 0, sz, 0, 6.283); ctx.fill(); } else { const rr_ = sz * (1 - morph * 0.85); rr(ctx, -sz, -sz, sz * 2, sz * 2, rr_); ctx.fill(); }
    ctx.restore();
  }
  if (coll > 0.95) { const dp = eob(P(t, t0 + 2.2, t0 + 2.3)); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(Math.PI / 4); ctx.fillStyle = K.cream; ctx.fillRect(-16 * dp, -16 * dp, 32 * dp, 32 * dp); ctx.restore(); }
  const cp = P(t, t0 + 1.1, t0 + 1.35) * (1 - P(t, t0 + 1.85, t0 + 1.95));
  if (cp > 0) { ctx.save(); ctx.globalAlpha = cp; rr(ctx, W / 2 - S(300, 300), H / 2 - 55, S(600, 600), 110, 18); ctx.fillStyle = 'rgba(11,7,6,0.82)'; ctx.fill(); ctx.restore();
    riseIn('كل تفصيلة بتفرق', W / 2, H / 2, S(64, 60), K.cream, P(t, t0 + 1.1, t0 + 1.4)); }
}
function aDepth(t) {                                         // 6.3 - 8.4 : extruded word on cream
  const t0 = 6.3; fill(K.cream); vign('rgba(150,120,100,A)', 0.4);
  const ip = eOutExpo(P(t, t0, t0 + 0.35)), dep = lerp(4, 40, eIO(P(t, t0 + 0.2, t0 + 1.3)));
  const ang = lerp(-0.5, -2.3, eIO(P(t, t0 + 0.2, t0 + 1.9))), rot = lerp(-0.18, 0, eOutExpo(P(t, t0, t0 + 0.6)));
  const s = lerp(0.6, 1, ip); ctx.save(); ctx.translate(W / 2, H / 2 - S(10, 40)); ctx.scale(s, s);
  extrude('احتراف', 0, 0, S(270, 220), dep, ang, K.ink, K.ember, K.wine, rot); ctx.restore();
  riseIn('من أول خطوة.. لمشروع التخرج', W / 2, H / 2 + S(190, 190), S(34, 38), K.ink, P(t, t0 + 0.6, t0 + 0.9));
}
function aMarquee(t) {                                       // 8.4 - 10.5 : diagonal bands with the five real course steps
  const t0 = 8.4; fill(K.ember);
  const words = ['البرامج', 'تأسيس أكاديمي', 'ذكاء صناعي', 'سوق العمل', 'مشروع التخرج'];
  const line = words.join('  •  ') + '  •  '; const band = S(118, 124), size = S(62, 64);
  const lw = tw(line, size, 900); const ip = eOutExpo(P(t, t0, t0 + 0.35));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.21); ctx.scale(lerp(1.4, 1, ip), lerp(1.4, 1, ip));
  const n = Math.ceil(Math.hypot(W, H) / band) + 2;
  const hn = Math.ceil(n / 2); for (let k = -hn; k <= hn; k++) { const y = k * band, dark = ((k % 2) + 2) % 2 === 0, dir = dark ? 1 : -1;
    if (dark) { ctx.fillStyle = K.black; ctx.fillRect(-W * 1.5, y - band / 2, W * 3, band); }
    let x = ((t - t0) * 420 * dir + k * 311) % lw; x = x - lw * 3;
    for (let r = 0; r < 8; r++) T(line, x + r * lw, y + 4, size, {w: 900, align: 'left', col: dark ? K.cream : 'rgba(40,6,4,0.30)'});
  }
  ctx.restore();
  const bp = eob(P(t, t0 + 0.5, t0 + 0.8)); if (bp > 0) {    // rotating badge
    const r = S(128, 138); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(bp, bp);
    ctx.fillStyle = K.cream; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.strokeStyle = K.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.64, 0, 6.283); ctx.stroke();
    const ring = 'BEGINNER DIPLOMA · 5 STEPS · SABER GROUP · '; ctx.rotate(t * 1.2); setFont(ctx, 'A', r * 0.13, 800, 0); ctx.fillStyle = K.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < ring.length; i++) { ctx.save(); ctx.rotate(i / ring.length * 6.283); ctx.fillText(ring[i], 0, -r * 0.82); ctx.restore(); }
    ctx.restore(); word(AR('05'), W / 2, H / 2 + 6, S(78, 84), K.red);
  }
}
function aCounter(t) {                                       // 10.5 - 12.5 : blobs + counter
  const t0 = 10.5; fill('#0c0507');
  const bx = W / 2 + Math.sin((t - t0) * 1.7) * S(220, 160), by = H / 2 + Math.cos((t - t0) * 1.3) * S(120, 240);
  const shrink = eInExpo(P(t, t0 + 1.6, t0 + 2.0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glowBlob(bx, by, S(520, 560) * (1 - shrink) + 20, 'rgba(255,106,26,0.85)', 1);
  glowBlob(W - bx + S(80, 0), H - by, S(560, 600) * (1 - shrink), 'rgba(196,50,31,0.8)', 1);
  glowBlob(W / 2, H / 2 - S(60, 200), S(380, 420) * (1 - shrink), 'rgba(253,153,5,0.45)', 1); ctx.restore();
  const cp = P(t, t0 + 0.1, t0 + 1.1); const n = Math.round(eOut(cp) * 24);
  const jit = cp < 1 ? (Math.floor(t * 60) % 2 ? -1 : 1) * 6 : 0;
  ctx.save(); ctx.globalAlpha = 1 - shrink; word(AR(n), W / 2, H / 2 + jit, S(300, 300), K.cream);
  T(AR(24) + ' ساعة · ' + AR(7) + ' أيام', W / 2, H / 2 - S(200, 210), S(22, 26), {w: 700, col: 'rgba(255,240,230,0.75)', alpha: P(t, t0 + 0.3, t0 + 0.5)});
  T('مارو.. مساعدك الذكي صاحي معاك', W / 2, H / 2 + S(190, 200), S(36, 40), {w: 800, col: K.cream, alpha: P(t, t0 + 0.9, t0 + 1.1)}); ctx.restore();
}
function aEnd(t) {                                           // 12.5 - 15 : dot pulses, bursts, lock-up
  const t0 = 12.5; fill(K.black);
  const pre = t < t0 + 0.9;
  if (pre) { const pulse = 1 + 0.25 * Math.sin((t - t0) * 20) * Math.exp(-(t - t0) * 2);
    ctx.fillStyle = K.ember; ctx.beginPath(); ctx.arc(W / 2, H / 2, lerp(28, 7, P(t, t0, t0 + 0.4)) * pulse, 0, 6.283); ctx.fill(); }
  const bt = t - (t0 + 0.9);
  if (bt >= 0) {
    if (bt < 0.12) fill(`rgba(120,110,105,${1 - bt / 0.12})`);                         // flash
    const rp = eOutExpo(P(bt, 0, 0.7));                                                  // rings + radial lines
    ctx.save(); ctx.globalAlpha = 1 - P(bt, 0.3, 0.9); ctx.lineWidth = 3;
    ctx.strokeStyle = K.red; ctx.beginPath(); ctx.arc(W / 2, H / 2, rp * S(420, 380), 0, 6.283); ctx.stroke();
    ctx.strokeStyle = K.ember; ctx.beginPath(); ctx.arc(W / 2, H / 2, rp * S(330, 300), 0, 6.283); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,210,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283, r0 = rp * S(430, 400), r1 = r0 + 40 + (i % 3) * 30; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); ctx.stroke(); }
    ctx.restore();
    const gl = bt < 0.25 ? (1 - bt / 0.25) * 22 : 0;                                   // RGB split settles into the logo
    const s = lerp(1.15, 1, eOutExpo(P(bt, 0, 0.35))), ly = H / 2 - S(30, 40);
    ctx.save(); ctx.translate(W / 2, ly); ctx.scale(s, s);
    if (gl > 0.5) { ctx.globalCompositeOperation = 'lighter'; word('صابر جروب', -gl, 0, S(150, 132), 'rgba(255,60,30,0.7)'); word('صابر جروب', gl, 0, S(150, 132), 'rgba(255,170,60,0.6)'); ctx.globalCompositeOperation = 'source-over'; }
    word('صابر جروب', 0, 0, S(150, 132), K.cream); ctx.restore();
    const ul = eIO(P(bt, 0.2, 0.55)); ctx.fillStyle = K.ember; ctx.fillRect(W / 2 - S(250, 220) * ul, ly + S(92, 84), S(500, 440) * ul, 5);
    T('أكاديمية تدريب التصميم', W / 2, ly + S(150, 140), S(38, 40), {w: 700, col: 'rgba(255,240,230,0.85)', alpha: P(bt, 0.4, 0.6)});
    T('معاك.. على طول', W / 2, ly + S(200, 192), S(26, 30), {w: 800, col: K.ember, alpha: P(bt, 0.6, 0.8)});
  }
  const fo = P(t, DUR - 0.25, DUR); if (fo > 0) fill(`rgba(0,0,0,${fo})`);
}
const ACTS = [[0, 2, aIntro, false], [2, 4, aBeats, null], [4, 6.3, aGrid, false], [6.3, 8.4, aDepth, true], [8.4, 10.5, aMarquee, false], [10.5, 12.5, aCounter, false], [12.5, 15, aEnd, false]];
function scene(t) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); fill(K.black); ctx.restore();
  let a = ACTS.find(x => t >= x[0] && t < x[1]) || ACTS[ACTS.length - 1];
  const since = t - a[0]; const pz = a[0] > 0 ? 1 + 0.06 * Math.exp(-since * 16) : 1;           // every cut lands with a small punch
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(pz, pz); ctx.translate(-W / 2, -H / 2); a[2](t); ctx.restore();
  const dark = a[3] === null ? Math.floor((t - 2) / BEAT) === 2 || Math.floor((t - 2) / BEAT) === 0 : a[3];
  hud(t, dark);
}
function nSub(t) { for (const a of ACTS) if (a[0] > 0 && Math.abs(t - a[0]) < 0.15) return 8; if (t > 2 && t < 4 && ((t - 2) % BEAT) < 0.15) return 8; if (t > 2.5 && t < 2.7) return 10; return 4; }

// ---------------- render hooks ----------------
const grains = []; { const R = rng(7); for (let k = 0; k < 6; k++) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); grains.push(c); } }
function post(f) { out.save(); out.globalAlpha = 0.05; out.globalCompositeOperation = 'overlay'; out.translate((f * 37) % 256, (f * 91) % 256); out.fillStyle = out.createPattern(grains[f % 6], 'repeat'); out.fillRect(-256, -256, W + 512, H + 512); out.restore(); }
window.renderFrame = function (f) {
  const t0 = f / FPS, N = nSub(t0), shutter = 0.5 / FPS; out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
  for (let k = 0; k < N; k++) { const t = Math.min(DUR - 1e-4, Math.max(0, t0 + (N > 1 ? (k / (N - 1) - 0.5) * shutter : 0))); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    scene(t); out.globalAlpha = 1 / (k + 1); out.drawImage(sub, 0, 0); }
  out.globalAlpha = 1; post(f);
};
window.ready = (async () => { await Promise.all([600, 700, 800, 900].flatMap(w => [document.fonts.load(`${w} 40px Cairo`, 'صابر'), document.fonts.load(`${w} 40px Cairo`, 'AB')])); return true; })();
