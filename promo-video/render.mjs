// Usage:
//   node render.mjs stills 1.2 5.5 ...   -> stills/t_<sec>.png
//   node render.mjs video [fps]          -> out/video_silent.mp4
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const mode = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto('file://' + path.join(dir, 'index.html'));
await page.evaluate(() => window.READY);

if (mode === 'stills') {
  mkdirSync(path.join(dir, 'stills'), { recursive: true });
  for (const t of process.argv.slice(3)) {
    await page.evaluate(t => render(t), +t);
    await page.screenshot({ path: path.join(dir, 'stills', `t_${t}.png`) });
  }
} else {
  const fps = +(process.argv[3] || 30);
  const total = JSON.parse(readFileSync(path.join(dir, 'timeline.json'))).total;
  mkdirSync(path.join(dir, 'out'), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(dir, 'out', 'video_silent.mp4')],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.ceil(total * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => render(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
