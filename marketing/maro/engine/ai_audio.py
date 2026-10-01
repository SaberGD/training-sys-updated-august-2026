"""Score + SFX for aireel.js, mixed under Mohamed Saber's voice-over (reel2/vo.mp3). Bed ducks ~10 dB under speech."""
import numpy as np, subprocess
import sfxlib as L
from sfxlib import tt, filt, kick, hat, clap, saw, boom, impact, whoosh, riser, bell, click, pop, blip, glitch, rng, SR
from scipy.io import wavfile
from scipy.signal import fftconvolve
DUR = 46.5
N = L.N = int(SR * DUR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); L.verb_send = np.zeros((N, 2))
add = L.add
BPM = 100; BEAT = 60 / BPM; BAR = 4 * BEAT
prog = [(55.0, (220.0, 261.63, 329.63)), (43.65, (174.61, 220.0, 261.63)), (65.41, (196.0, 261.63, 329.63)), (49.0, (196.0, 246.94, 293.66))]
r = open('reel15_audio.py').read(); exec(r[r.index('def groove'):r.index('groove(2.0, 11.5, 1.0)')])
def pad(t0, t1, g=0.05, cut=1600, ch=(220.0, 261.63, 329.63, 440.0)):
    t = tt(t1 - t0); env = np.minimum(1, t / 0.6) * np.minimum(1, (t1 - t0 - t) / 0.6)
    add(music, filt(np.stack([sum(saw(f, t, -0.003) for f in ch), sum(saw(f, t, 0.003) for f in ch)], 1), 'lowpass', cut) * env[:, None] * g, t0, send=0.4)
# 0-3.55 intro: pad + riser, door, "20"
pad(0.0, 3.7, 0.045); add(sfx, riser(1.4, 0.25, 150, 2000), 0.1, send=0.4)
add(sfx, whoosh(0.8, 0.5, up=True), 1.4, send=0.3); add(sfx, boom(0.6, 1.6), 1.5, send=0.5); add(sfx, bell([659.25, 987.77], 1.5, 0.12), 1.6, send=0.7)
add(sfx, impact(0.75), 2.98, send=0.3); add(sfx, boom(0.5, 1.0), 2.98, send=0.4)
# 3.55-14.26 groove
groove(3.55, 14.26, 0.6)
for k in range(10): add(sfx, click(0.12), 4.7 + k * 0.055)                         # year ticker
for t0 in (6.72, 7.5, 7.86, 8.6): add(sfx, pop(0.35, 1100, 400), t0)                 # chip + skill cards
for t0 in (9.6, 11.44, 11.92, 12.32): add(sfx, whoosh(0.4, 0.2, up=True), t0 - 0.05)  # bars grow
for t0, f in ((11.44, 523.25), (11.92, 659.25), (12.32, 783.99)): add(sfx, blip(f, 0.14), t0 + 0.5)
# 14.26-15.36 the AI orb charges in, 15.36 RESET hit, music cut for a beat
add(sfx, riser(1.1, 0.35, 300, 6000), 14.26, send=0.4); add(sfx, glitch(0.25, 0.25), 15.2)
add(sfx, impact(1.0), 15.36, send=0.5); add(sfx, boom(1.0, 2.2), 15.36, send=0.6)
for k in range(12): add(sfx, click(0.12), 15.45 + k * 0.04)                          # counter rolls to 00
# 16.38-32.05
groove(16.38, 32.05, 0.65)
for t0 in (18.26, 18.86, 19.42): add(sfx, pop(0.4, 900, 300), t0)
for t0 in (21.7, 21.9, 22.1): add(sfx, pop(0.3, 1400, 600), t0)
add(sfx, glitch(0.3, 0.3), 22.44)
for t0 in (22.95, 23.03, 23.11, 23.19, 23.27): add(sfx, blip(1046.5, 0.08), t0)
for i in range(5): add(sfx, whoosh(0.35, 0.12, up=True), 23.6 + i * 0.12)
for k in range(10): add(sfx, click(0.15), 25.5 + k * 0.08)                          # clock hands
add(sfx, pop(0.4, 1200, 400), 26.0); add(sfx, boom(0.5, 1.2), 26.62, send=0.5)
for t0 in (29.18, 29.76, 30.3, 31.66): add(sfx, pop(0.4, 1000, 350), t0); add(sfx, blip(1318.5, 0.1), t0 + 0.45)
# 32.05-36.05 build into the wave
groove(32.05, 36.05, 0.75); add(sfx, riser(2.1, 0.3, 200, 5000), 32.1, send=0.4); add(sfx, whoosh(1.2, 0.5, up=True), 34.1, send=0.4)
t = tt(1.0); add(music, filt(rng.standard_normal(len(t)), 'highpass', 3000) * np.linspace(0, 0.12, len(t)), 35.05)
# 36.1 regret: drop to a dark drone
add(sfx, impact(0.6), 36.1, send=0.4); t = tt(1.7); add(music, filt(saw(55.0, t) + saw(55.4, t), 'lowpass', 300) * np.exp(-t * 1.0)[:, None].squeeze() [:, None] * 0.12 if False else np.stack([filt(saw(55.0, t), 'lowpass', 300), filt(saw(55.4, t), 'lowpass', 300)], 1) * np.exp(-t * 1.0)[:, None] * 0.12, 36.1)
add(sfx, pop(0.35, 700, 200), 36.9)
# 37.8-40.85 light CTA bed
pad(37.75, 40.9, 0.04, 2200, (261.63, 329.63, 392.0, 523.25))
for k in range(6): add(music, bell([523.25 * [1, 1.25, 1.5, 2, 1.5, 1.25][k]], 0.6, 0.05), 37.9 + k * BEAT / 2, send=0.5)
for k in range(14): add(sfx, click(0.14), 39.3 + k * 0.043)
add(sfx, pop(0.4, 1500, 700), 39.95); add(sfx, bell([1046.5, 1568], 0.9, 0.14), 40.05, send=0.6)
# 40.88 name card
add(sfx, impact(0.7), 40.88, send=0.4); add(sfx, boom(0.7, 2.0), 40.88, send=0.6)
groove(41.02, 45.2, 0.55)
for t0 in (41.64, 43.18, 44.02): add(sfx, pop(0.35, 1200, 500), t0)
t = tt(2.6); ch = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0, 554.37))
add(music, filt(ch, 'lowpass', 2400) * np.minimum(1, t / 0.02) * np.exp(-t * 1.0) * 0.07, 45.2); add(sfx, bell([880, 1108.7, 1318.5], 1.8, 0.18), 44.6, send=0.8)
for c in (3.55, 9.24, 16.36, 25.2, 32.05, 37.75, 40.85): add(sfx, whoosh(0.3, 0.35), c - 0.22)
# ---------- mix ----------
ir_len = int(1.6 * SR); ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.8)[:, None]; ir = filt(ir, 'lowpass', 6000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(L.verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
bed = filt(music * 0.8 + sfx * 0.75 + wet * 0.45, 'highpass', 30)
vo = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '../reel2/vo.mp3', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).reshape(-1, 2).astype(float)
v = np.zeros((N, 2)); v[:min(N, len(vo))] = vo[:N]
mono = np.abs(v).mean(1); sp = mono > 0.01; v *= 10 ** (-15 / 20) / np.sqrt(np.mean(v[sp] ** 2))
def smooth(x, att, rel):
    y = np.zeros_like(x); a = np.exp(-1 / (att * SR)); r_ = np.exp(-1 / (rel * SR)); p = 0.0
    for i in range(0, len(x), 64):
        val = x[i:i + 64].max(); c = a if val > p else r_; p = c * p + (1 - c) * val; y[i:i + 64] = p
    return y
env = smooth((smooth(np.abs(v).mean(1), 0.005, 0.05) > 0.012).astype(float), 0.05, 0.35)
bed_n = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 10 ** (-19 / 20)
duck = 1 - 0.68 * env
mix = v + bed_n * duck[:, None]
fo = int(0.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
np.save('ai_parts.npy', np.stack([v, bed_n * duck[:, None]]))
peak = np.abs(mix).max(); mix = np.tanh(mix / peak * 1.1) / np.tanh(1.1) * 0.93
wavfile.write('ai_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok, rms dB', round(20 * np.log10(np.sqrt((mix ** 2).mean())), 1), 'peak in', round(peak, 2))
