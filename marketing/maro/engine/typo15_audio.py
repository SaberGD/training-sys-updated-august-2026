"""15s soundtrack for typo15.js (typography reel). 120 BPM, every event synced to the picture."""
import numpy as np
import sfxlib as L
from sfxlib import tt, filt, kick, hat, clap, saw, boom, impact, whoosh, riser, bell, click, pop, blip, glitch, rng, SR
from scipy.io import wavfile
from scipy.signal import fftconvolve

DUR = 15.0
N = L.N = int(SR * DUR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); L.verb_send = np.zeros((N, 2))
add = L.add
BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
prog = [(55.0, (220.0, 261.63, 329.63)), (43.65, (174.61, 220.0, 261.63)), (65.41, (196.0, 261.63, 329.63)), (49.0, (196.0, 246.94, 293.66))]

def groove(a, b, gain=1.0, hats=True):
    for i in range(int(round((b - a) / BEAT))):
        tb = a + i * BEAT
        add(music, kick(0.95 * gain), tb)
        if i % 2 == 1: add(music, clap(0.3 * gain), tb, send=0.2)
        if hats:
            for q in range(4): add(music, hat((0.11 if q == 2 else 0.05) * gain, open_=(q == 2)), tb + q * BEAT / 4, pan=0.25 if q % 2 else -0.25)
    for j in range(int(np.ceil((b - a) / BAR))):
        s0 = a + j * BAR; s1 = min(b, s0 + BAR); root, ch = prog[j % 4]; tq = tt(s1 - s0)
        env = np.zeros(len(tq))
        for e in range(int((s1 - s0) / (BEAT / 4))):
            st = e * BEAT / 4; env += ((tq >= st) & (tq < st + BEAT / 4)) * np.exp(-(tq - st).clip(0) * 9) * (0.35 if e % 4 == 0 else 1)
        add(music, filt((saw(root * 2, tq) + np.sin(2*np.pi*root*tq) * 1.2) * env, 'lowpass', 900) * 0.2 * gain, s0)
        duck = 0.35 + 0.65 * np.minimum(1, (tq % BEAT) / 0.18); fade = np.minimum(1, tq / 0.02) * np.minimum(1, (s1 - s0 - tq) / 0.02)
        padl = sum(saw(f, tq, -0.004) + saw(f, tq, 0.003) for f in ch); padr = sum(saw(f, tq, 0.004) + saw(f*2, tq, -0.002)*0.3 for f in ch)
        add(music, filt(np.stack([padl*fade*duck, padr*fade*duck], 1), 'lowpass', 2600) * 0.045 * gain, s0)

# intro (0-2): dot, line, title, swallow
add(sfx, pop(0.4, 1800, 900), 0.25, send=0.4)
add(sfx, whoosh(0.5, 0.35), 0.55)
t = tt(1.0); add(music, np.sin(2*np.pi*55*t) * np.minimum(1, t/0.3) * 0.25, 1.0)
add(sfx, impact(0.4), 1.05, send=0.4); add(sfx, bell([1318.5], 0.8, 0.07), 1.1, send=0.6)
add(sfx, riser(0.4, 0.5, 200, 4000), 1.62, send=0.2)
# beats (2-4): a hit per word
add(music, kick(1.0), 2.0); add(sfx, boom(0.8, 1.0), 2.0, send=0.4)
for k, tb in enumerate((2.0, 2.5, 3.0, 3.5)): add(sfx, impact(0.5), tb + 0.01, send=0.3)
add(sfx, whoosh(0.2, 0.5), 2.44); add(sfx, pop(0.35, 700, 200), 3.5)
groove(2.0, 4.0, 1.0, hats=False)
# grid (4-6.3)
groove(4.0, 12.0, 1.0)
R = np.random.default_rng(3)
for k in range(18): add(sfx, blip(880 * 2 ** (R.integers(0, 12) / 12), 0.05), 4.0 + k * 0.03, pan=R.random() * 1.6 - 0.8)
add(sfx, glitch(0.3, 0.25), 4.9); add(sfx, click(0.35), 5.1)
add(sfx, whoosh(0.45, 0.45, up=False), 5.85); add(sfx, bell([2093], 0.6, 0.12), 6.22, send=0.6)
# depth (6.3-8.4)
add(sfx, boom(0.9, 1.4), 6.3, send=0.5); add(sfx, riser(1.2, 0.3, 120, 1500), 6.5); add(sfx, click(0.3), 6.9)
# marquee (8.4-10.5)
add(sfx, whoosh(0.35, 0.5), 8.18); add(sfx, impact(0.55), 8.4, send=0.3); add(sfx, pop(0.45, 1300, 500), 8.9, send=0.3)
# counter (10.5-12.5)
add(sfx, whoosh(0.35, 0.45), 10.28); add(sfx, impact(0.5), 10.5, send=0.3)
for k in range(24): add(sfx, click(0.12 + 0.1 * k / 24), 10.6 + 1.0 * (1 - (1 - k / 24) ** 3))
add(sfx, whoosh(0.45, 0.4, up=False), 12.05)
# end (12.5-15): heartbeat dot, burst, lock-up
for k in range(3): t = tt(0.25); add(music, np.sin(2*np.pi*(60 - 30*t)*t) * np.exp(-t*12) * 0.6, 12.5 + k * 0.3)
add(sfx, riser(0.35, 0.4, 400, 6000), 13.05)
add(music, kick(1.0), 13.4); add(sfx, boom(1.0, 1.8), 13.4, send=0.6); add(sfx, impact(0.7), 13.4, send=0.4); add(sfx, glitch(0.25, 0.3), 13.4)
t = tt(1.6); chord = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0, 554.37))
add(music, filt(chord, 'lowpass', 2400) * np.minimum(1, t / 0.02) * np.exp(-t * 1.1) * 0.07, 13.4)
add(sfx, bell([880, 1108.7, 1318.5], 1.4, 0.2), 13.6, send=0.8); add(sfx, click(0.3), 13.95)

ir_len = int(1.6 * SR); ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.8)[:, None]
ir = filt(ir, 'lowpass', 6000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(L.verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = filt(music * 0.85 + sfx * 0.9 + wet * 0.45, 'highpass', 25)
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
fo = int(0.3 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / np.abs(mix).max() * 0.9
wavfile.write('typo15_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok, rms dB', round(20 * np.log10(np.sqrt((mix ** 2).mean())), 1))
