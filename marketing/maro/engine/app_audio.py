"""32s soundtrack for the MARO app promo (appreel.js). 120 BPM groove + UI sounds synced to every tap, keystroke and move."""
import numpy as np
import sfxlib as L
from sfxlib import tt, filt, kick, hat, clap, saw, boom, impact, whoosh, riser, bell, click, pop, blip, glitch, rng, SR
from scipy.io import wavfile
from scipy.signal import fftconvolve

DUR = 32.0
N = L.N = int(SR * DUR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); L.verb_send = np.zeros((N, 2))
add = L.add
src = open('maro_test_audio.py').read()
exec(src[src.index('# ---------- MARO signature sounds'):src.index('# ---------- music bed')])
BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
prog = [(55.0, (220.0, 261.63, 329.63)), (43.65, (174.61, 220.0, 261.63)), (65.41, (196.0, 261.63, 329.63)), (49.0, (196.0, 246.94, 293.66))]
r = open('reel15_audio.py').read(); exec(r[r.index('def groove'):r.index('groove(2.0, 11.5, 1.0)')])

# ---------------- music ----------------
add(music, filt(rng.standard_normal(int(0.9*SR)), 'bandpass', [300, 3000]) * np.linspace(0, 0.16, int(0.9*SR)), 0.0)
groove(0.9, 13.9, 0.85)
t = tt(1.5); ch = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0))          # highlight lift
add(music, filt(ch, 'lowpass', 1600) * np.minimum(1, t / 0.05) * np.exp(-t * 0.8) * 0.06, 13.9)
for k in range(3): add(music, hat(0.08), 13.9 + k * BEAT + BEAT / 2, pan=0.2)
groove(15.4, 22.9, 0.9)
groove(23.0, 27.5, 1.0)
t = tt(0.3); add(music, filt(rng.standard_normal(len(t)), 'highpass', 2000) * np.linspace(0, 0.2, len(t)), 27.5)
add(music, kick(1.0), 27.8)
t = tt(4.2); ch = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0, 554.37))
add(music, filt(ch, 'lowpass', 2400) * np.minimum(1, t / 0.02) * np.exp(-t * 0.55) * 0.08, 27.8)
for k in range(8): add(music, hat(0.06), 28.3 + k * BEAT, pan=0.2 if k % 2 else -0.2)

# ---------------- sfx ----------------
def keys(t0, t1, n, g=0.22, seed=3):
    R = np.random.default_rng(seed)
    for k in range(n): add(sfx, click(g * (0.8 + 0.4 * R.random())), t0 + (t1 - t0) * k / max(1, n - 1) + R.random() * 0.012, pan=R.random() * 0.4 - 0.2)
add(sfx, whoosh(0.8, 0.5, up=True), 0.1); add(sfx, impact(0.5), 0.9, send=0.3); add(sfx, boom(0.7, 1.2), 0.9, send=0.4)
add(sfx, maro_chirp(0.35), 1.6, send=0.3)
for tp in (1.0, 1.95, 2.6, 6.95, 7.75, 9.5, 16.2, 16.55, 19.65, 22.0): add(sfx, pop(0.35, 1500, 700), tp)
keys(1.15, 1.8, 7); keys(2.05, 2.45, 8, 0.18, 4); keys(7.9, 9.2, 21, 0.2, 5); keys(16.75, 18.1, 26, 0.18, 6)
add(sfx, bell([1318.5, 1760], 0.6, 0.12), 2.62, send=0.4)                              # login ok
for c in (3.0, 7.15, 15.6): add(sfx, whoosh(0.4, 0.45), c - 0.12)                         # in-app page pushes
for c in (3.1, 7.1, 9.6, 13.9, 15.4, 16.0, 18.2, 19.6, 22.3): add(sfx, whoosh(0.5, 0.22, up=True), c)   # camera moves
for c in (4.45, 12.55, 18.35): add(sfx, whoosh(0.9, 0.16, up=False), c)                   # scrolls
for i in range(8): add(sfx, pop(0.26, 900 + i * 110, 350), 4.7 + i * 0.1)                  # tool chips
add(sfx, pop(0.45, 1100, 400), 9.55)                                                      # message sent
for k in range(4): add(sfx, blip(1046.5 * (1 + 0.25 * (k % 2)), 0.07), 9.85 + k * 0.18)  # MARO typing
add(sfx, riser(1.7, 0.18, 600, 5000), 10.55)
add(sfx, bell([880, 1108.7, 1318.5], 1.2, 0.2), 14.15, send=0.6); add(sfx, impact(0.35), 14.12, send=0.3)
add(sfx, glitch(0.3, 0.25), 19.7); add(sfx, riser(0.5, 0.2, 400, 4000), 19.7)
R = np.random.default_rng(9)
for k in range(36): add(sfx, click(0.1 + 0.05 * R.random()), 19.95 + k * 0.051)            # prompt streaming out
for i in range(4): add(sfx, pop(0.25, 1200 + i * 120, 400), 20.0 + i * 0.1)
add(sfx, blip(1568, 0.14), 22.12)                                                          # copied toast
add(sfx, whoosh(0.5, 0.5, up=False), 22.7); add(sfx, whoosh(0.5, 0.45), 22.95)
for k in range(5): add(sfx, whoosh(0.35, 0.22), 23.45 + k * 0.78 + 0.38)                  # carousel steps
add(sfx, whoosh(0.32, 0.5), 27.56); add(sfx, impact(0.7), 27.8, send=0.4); add(sfx, boom(0.9, 1.8), 27.8, send=0.6)
add(sfx, bell([880, 1108.7, 1318.5, 1760], 1.6, 0.18), 27.9, send=0.8)
add(sfx, pop(0.35, 1400, 500), 28.7); add(sfx, maro_chirp(0.45), 28.5, send=0.4)

# ---------------- mix ----------------
ir_len = int(1.6 * SR); ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.8)[:, None]
ir = filt(ir, 'lowpass', 6000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(L.verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = music * 0.8 + sfx * 0.95 + wet * 0.45
mix = filt(mix, 'highpass', 25)
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
fo = int(0.4 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / np.abs(mix).max() * 0.9
wavfile.write('app_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok, rms dB', round(20 * np.log10(np.sqrt((mix ** 2).mean())), 1))
