// Design-app UI shown on Sara's laptop in the opening shot (replaces the blank white screen).
// Painted into an offscreen canvas every frame, then mapped onto the laptop-screen quad with a subdivided affine warp.
const SUI = document.createElement('canvas'); SUI.width = 1280; SUI.height = 800; const sug = SUI.getContext('2d');
function paintUI(t) {
  const g = sug, Wd = 1280, Hd = 800;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1d1d1f'; g.fillRect(0, 0, Wd, Hd);
  g.font = '600 15px Cairo'; g.textBaseline = 'middle';
  // menu bar + document tab
  g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, Wd, 30);
  g.fillStyle = '#b8b8bd'; ['File', 'Edit', 'Image', 'Layer', 'Type', 'Select', 'Filter', 'View', 'Window'].forEach((m, i) => g.fillText(m, 16 + i * 62, 15));
  g.fillStyle = '#26262a'; g.fillRect(48, 30, Wd - 48 - 270, 30);
  g.fillStyle = '#333338'; g.fillRect(52, 34, 330, 26); g.fillStyle = '#dcdce0'; g.font = '600 14px Cairo'; g.fillText('Vezeeta_family_campaign_v3.psd @ 66%', 64, 47);
  // tool strip
  g.fillStyle = '#28282b'; g.fillRect(0, 30, 48, Hd - 30);
  for (let i = 0; i < 14; i++) { g.fillStyle = i === 3 ? '#4a4a52' : '#38383d'; g.fillRect(10, 44 + i * 40, 28, 28); g.fillStyle = '#9a9aa2'; g.fillRect(18, 52 + i * 40, 12, 12); }
  // canvas area + artboard with the unfinished poster
  g.fillStyle = '#131315'; g.fillRect(48, 60, Wd - 48 - 270, Hd - 60);
  const ph = 640, pw = ph * 1080 / 1350, px = 48 + (Wd - 48 - 270 - pw) / 2, py = 60 + (Hd - 60 - ph) / 2 + 6;
  g.drawImage(PB, px, py, pw, ph);
  // marching-ants selection around the title (Sara stuck on it)
  g.save(); g.setLineDash([8, 6]); g.lineDashOffset = -t * 40; g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(px + pw * 0.12, py + ph * 0.07, pw * 0.76, ph * 0.2);
  g.strokeStyle = '#000'; g.lineDashOffset = -t * 40 + 7; g.strokeRect(px + pw * 0.12, py + ph * 0.07, pw * 0.76, ph * 0.2); g.restore();
  // cursor wandering over the title
  const cx = px + pw * (0.5 + 0.18 * Math.sin(t * 1.3)), cy = py + ph * (0.17 + 0.05 * Math.sin(t * 2.1));
  g.save(); g.translate(cx, cy); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.lineTo(6, 16); g.lineTo(11, 26); g.lineTo(15, 24); g.lineTo(10, 14); g.lineTo(18, 14); g.closePath(); g.fill(); g.stroke(); g.restore();
  // right panels: layers
  const rx = Wd - 270; g.fillStyle = '#26262a'; g.fillRect(rx, 30, 270, Hd - 30);
  g.fillStyle = '#303035'; g.fillRect(rx, 30, 270, 30); g.fillStyle = '#dcdce0'; g.font = '700 15px Cairo'; g.fillText('Layers', rx + 14, 45);
  ['Title — draft', 'Logo', 'Doctors', 'Family photo', 'Shape 1', 'Background'].forEach((n, i) => {
    const y = 70 + i * 46; g.fillStyle = i === 0 ? '#3d4a66' : '#2c2c31'; g.fillRect(rx + 6, y, 258, 40);
    g.fillStyle = '#55555c'; g.fillRect(rx + 14, y + 6, 36, 28); if (i === 3) g.drawImage(IM.V1, rx + 14, y + 6, 36, 28);
    g.fillStyle = '#d0d0d6'; g.font = '600 14px Cairo'; g.fillText(n, rx + 62, y + 20);
  });
  g.fillStyle = '#303035'; g.fillRect(rx, 360, 270, 30); g.fillStyle = '#dcdce0'; g.font = '700 15px Cairo'; g.fillText('Properties', rx + 14, 375);
  for (let i = 0; i < 5; i++) { g.fillStyle = '#34343a'; g.fillRect(rx + 14, 404 + i * 34, 242, 22); }
  // blinking "no idea yet" note on the artboard
  if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = 'rgba(255,90,60,0.9)'; g.font = '700 13px Cairo'; g.fillText('?? headline', px + pw * 0.14, py + ph * 0.3); }
}
function triDraw(src, s0, s1, s2, d0, d1, d2) {
  // affine map from source triangle to destination triangle; clip slightly enlarged to hide seams
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, grow = p => [p[0] + (p[0] - cx) * 0.02, p[1] + (p[1] - cy) * 0.02];
  const D0 = grow(d0), D1 = grow(d1), D2 = grow(d2);
  ctx.save(); ctx.beginPath(); ctx.moveTo(...D0); ctx.lineTo(...D1); ctx.lineTo(...D2); ctx.closePath(); ctx.clip();
  const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
  const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
  const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
  const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
  const e = d0[0] - a * s0[0] - c * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
  ctx.transform(a, b, c, d, e, f); ctx.drawImage(src, 0, 0); ctx.restore();
}
function drawScreenUI(t, Q) {
  paintUI(t);
  const N = 4, sw = SUI.width / N, sh = SUI.height / N;
  const L = (u, v) => [(1 - v) * ((1 - u) * Q.tl[0] + u * Q.tr[0]) + v * ((1 - u) * Q.bl[0] + u * Q.br[0]), (1 - v) * ((1 - u) * Q.tl[1] + u * Q.tr[1]) + v * ((1 - u) * Q.bl[1] + u * Q.br[1])];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p00 = L(i / N, j / N), p10 = L((i + 1) / N, j / N), p01 = L(i / N, (j + 1) / N), p11 = L((i + 1) / N, (j + 1) / N);
    const s00 = [i * sw, j * sh], s10 = [(i + 1) * sw, j * sh], s01 = [i * sw, (j + 1) * sh], s11 = [(i + 1) * sw, (j + 1) * sh];
    triDraw(SUI, s00, s10, s01, p00, p10, p01); triDraw(SUI, s10, s11, s01, p10, p11, p01);
  }
  // soft screen glow so it still reads as a lit display in a dark room
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowBlob(Q.cx, Q.cy, 380, 'rgba(140,170,255,0.10)', 1); ctx.restore();
}
// the room darkens from the edges inward while a warm glow holds the centre -> hands over to MARO's power-on
function fadeToGlow(t) {
  const a = eInOut(P(t, 3.62, 3.98)); if (a <= 0) return;
  const r = lerp(Math.hypot(W, H) * 0.7, 0, a);
  const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.35, W / 2, H / 2, r + 1);
  g.addColorStop(0, 'rgba(8,3,2,0)'); g.addColorStop(1, `rgba(8,3,2,${Math.min(1, a * 1.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(8,3,2,${eIn(a)})`; ctx.fillRect(0, 0, W, H);
  const gl = P(t, 3.72, 3.98); if (gl > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowBlob(W / 2, H / 2, 900, 'rgba(255,160,100,0.5)', gl); ctx.restore(); }
}
