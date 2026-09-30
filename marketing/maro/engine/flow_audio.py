"""54s calm, premium score for flow.js: slow pads + soft plucks, a gentle beat from the generation scene, subtle UI clicks/keys."""
import numpy as np
import sfxlib as L
from sfxlib import tt, filt, kick, hat, clap, saw, boom, impact, whoosh, riser, bell, click, pop, blip, glitch, rng, SR
from scipy.io import wavfile
from scipy.signal import fftconvolve
DUR = 54.0
N = L.N = int(SR * DUR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); L.verb_send = np.zeros((N, 2))
add = L.add
BPM = 96; BEAT = 60 / BPM; BAR = 4 * BEAT
CH = [(146.83, (293.66, 349.23, 440.0, 523.25)), (116.54, (233.08, 293.66, 349.23, 440.0)), (87.31, (261.63, 349.23, 440.0, 523.25)), (130.81, (261.63, 329.63, 392.0, 493.88))]  # Dm9 Bb F C
def pad(t0, t1, ci, g=0.05, bright=1800):
    root, ch = CH[ci % 4]; t = tt(t1 - t0 + 1.5)
    env = np.minimum(1, t / 0.9) * np.minimum(1, np.maximum(0, (t1 - t0 + 1.5 - t)) / 1.5)
    l = sum(saw(f, t, -0.003) for f in ch) + saw(root, t) * 0.6; r = sum(saw(f, t, 0.003) for f in ch) + saw(root, t, 0.002) * 0.6
    add(music, filt(np.stack([l * env, r * env], 1), 'lowpass', bright) * g, t0, send=0.5)
def pluck(f, t0, g=0.12, pan=0.0): add(music, bell([f, f * 2.0], 1.4, g), t0, pan=pan, send=0.6)
# sections
bars = int(np.ceil(DUR / BAR))
for b in range(bars):
    t0 = b * BAR
    if t0 >= 51.0: break
    bright = 1400 if t0 < 28.8 else (2600 if t0 < 47.7 else 2000)
    pad(t0, min(t0 + BAR, 51.0), b, 0.045 if t0 < 28.8 else 0.05, bright)
    root, ch = CH[b % 4]
    for k in range(8):                                        # soft arpeggio, 8ths
        tk = t0 + k * BEAT / 2
        if tk < 1.0 or tk > 50.8: continue
        g = 0.05 if tk < 11 else 0.075
        pluck(ch[[0, 2, 1, 3, 2, 1, 3, 2][k]] * 2, tk, g, pan=-0.3 if k % 2 else 0.3)
    add(music, np.sin(2 * np.pi * root / 2 * tt(BAR)) * np.exp(-tt(BAR) * 1.2) * 0.18, t0)   # sub note per bar
# gentle beat from the generation scene until the tunnel
b0 = 28.8
for i in range(int((47.7 - b0) / BEAT)):
    tb = b0 + i * BEAT
    add(music, kick(0.55), tb)
    if i % 2 == 1: add(music, clap(0.12), tb, send=0.3)
    add(music, hat(0.05, open_=False), tb + BEAT / 2, pan=0.25)
add(sfx, riser(3.0, 0.25, 200, 3000), 25.8, send=0.4)
add(sfx, riser(3.2, 0.3, 200, 5000), 47.8, send=0.5)
# end chord
t = tt(4.0); ch = sum(saw(f, t, 0.003) for f in (146.83, 293.66, 349.23, 440.0, 587.33))
add(music, filt(ch, 'lowpass', 2200) * np.minimum(1, t / 0.05) * np.exp(-t * 0.7) * 0.07, 51.0, send=0.7)
add(sfx, bell([587.33, 880, 1174.66], 3.0, 0.22), 51.05, send=0.9); add(sfx, boom(0.45, 2.0), 51.0, send=0.5)
# ---------- UI ----------
def keys(t0, t1, n, g=0.13, seed=3):
    R = np.random.default_rng(seed)
    for k in range(n): add(sfx, click(g * (0.7 + 0.5 * R.random())), t0 + (t1 - t0) * k / max(1, n - 1) + R.random() * 0.01, pan=R.random() * 0.4 - 0.2)
keys(8.7, 10.0, 22); keys(19.1, 20.2, 18, seed=4); keys(24.8, 25.1, 5, seed=5); keys(26.5, 26.8, 4, seed=6); keys(27.5, 28.3, 12, seed=7); keys(43.8, 44.9, 18, seed=8)
for c in (10.35, 15.3, 20.55, 23.35, 26.2, 27.2, 40.9, 45.2): add(sfx, pop(0.28, 1500, 800), c)
for c in (4.9, 8.3, 11.0, 16.8, 18.5, 24.5, 28.8, 34.5, 36.3, 38.7, 43.4, 47.7): add(sfx, whoosh(0.9, 0.16, up=True), c - 0.35, send=0.4)
for i in range(9): add(sfx, blip(1046.5 * 2 ** ([0, 2, 4, 7, 9, 12, 14, 16, 19][i] / 12), 0.05), 29.9 + i * 0.28, send=0.5)
for k in range(12): add(sfx, click(0.05), 12.2 + k * 0.4)            # answer streaming, very soft
t = tt(1.2); add(sfx, filt(rng.standard_normal(len(t)), 'bandpass', [3000, 9000]) * np.sin(np.pi * t / 1.2) * 0.05, 45.3, send=0.5)
# ---------- mix ----------
ir_len = int(2.4 * SR); ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 2.6)[:, None]
ir = filt(ir, 'lowpass', 5500); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(L.verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = music * 0.85 + sfx * 0.9 + wet * 0.5
if __name__ == '__main__' or True:
    np.save('flow_mix_lin.npy', mix)
mix = filt(mix, 'highpass', 30); mix = np.tanh(mix * 1.2) / np.tanh(1.2)
fi = int(0.8 * SR); mix[:fi] *= np.linspace(0, 1, fi)[:, None]
fo = int(0.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / np.abs(mix).max() * 0.88
wavfile.write('flow_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok, rms dB', round(20 * np.log10(np.sqrt((mix ** 2).mean())), 1))
