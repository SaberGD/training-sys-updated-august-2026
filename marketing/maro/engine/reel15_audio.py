"""15s soundtrack for the Beginner Diploma reel (reel15.js). 120 BPM, every event synced to the picture."""
import numpy as np
import sfxlib as L
from sfxlib import tt, filt, kick, hat, clap, saw, boom, impact, whoosh, riser, bell, click, pop, blip, glitch, rng, SR
from scipy.io import wavfile
from scipy.signal import fftconvolve

DUR = 15.0
N = L.N = int(SR * DUR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); L.verb_send = np.zeros((N, 2))
add = L.add
src = open('maro_test_audio.py').read()
exec(src[src.index('# ---------- MARO signature sounds'):src.index('# ---------- music bed')])

BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
prog = [(55.0, (220.0, 261.63, 329.63)), (43.65, (174.61, 220.0, 261.63)), (65.41, (196.0, 261.63, 329.63)), (49.0, (196.0, 246.94, 293.66))]

# ---------------- music ----------------
# 0-2: tension. sub pulse on every beat + a riser into the drop
for k in range(4):
    t = tt(0.45); add(music, np.sin(2*np.pi*(55 - 20*t)*t) * np.exp(-t*7) * 0.55, k * BEAT)
add(music, filt(rng.standard_normal(int(2.0*SR)), 'bandpass', [300, 3000]) * np.linspace(0, 0.18, int(2.0*SR)), 0.0)
add(sfx, riser(1.0, 0.5, 200, 4000), 1.0, send=0.3)

def groove(a, b, gain=1.0):
    nb = int(round((b - a) / BEAT))
    for i in range(nb):
        tb = a + i * BEAT
        add(music, kick(0.95 * gain), tb)
        if i % 2 == 1: add(music, clap(0.33 * gain), tb, send=0.2)
        for q in range(4):
            add(music, hat((0.12 if q == 2 else 0.06) * gain, open_=(q == 2)), tb + q * BEAT / 4, pan=0.25 if q % 2 else -0.25)
    bars = int(np.ceil((b - a) / BAR))
    for j in range(bars):
        s0 = a + j * BAR; s1 = min(b, s0 + BAR); root, ch = prog[j % 4]; tq = tt(s1 - s0)
        env = np.zeros(len(tq))
        for e in range(int((s1 - s0) / (BEAT / 4))):                     # 16th-note pumping bass, ducked by the kick
            st = e * BEAT / 4
            env += ((tq >= st) & (tq < st + BEAT / 4)) * np.exp(-(tq - st).clip(0) * 9) * (0.35 if e % 4 == 0 else 1)
        bass = filt((saw(root * 2, tq) + np.sin(2*np.pi*root*tq) * 1.2) * env, 'lowpass', 900) * 0.2 * gain
        padl = sum(saw(f, tq, -0.004) + saw(f, tq, 0.003) for f in ch); padr = sum(saw(f, tq, 0.004) + saw(f*2, tq, -0.002)*0.3 for f in ch)
        duck = 0.35 + 0.65 * np.minimum(1, ((tq % BEAT) / 0.18))
        fade = np.minimum(1, tq / 0.02) * np.minimum(1, (s1 - s0 - tq) / 0.02)
        pad = filt(np.stack([padl*fade*duck, padr*fade*duck], 1), 'lowpass', 2600) * 0.05 * gain
        add(music, bass, s0); add(music, pad, s0)

groove(2.0, 11.5, 1.0)
t = tt(0.5); add(music, filt(rng.standard_normal(len(t)), 'highpass', 2000) * np.linspace(0, 0.2, len(t)), 11.5)   # snare-roll lift
for k in range(8): add(music, clap(0.12 + 0.03 * k), 11.5 + k * BEAT / 8)
# 12-13.5: MARO break: filtered pad + light hats
t = tt(1.5); chord = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0))
add(music, filt(chord, 'lowpass', 1400) * np.minimum(1, t / 0.05) * 0.05, 12.0)
for k in range(3): add(music, hat(0.08), 12.0 + k * BEAT + BEAT / 2, pan=0.2)
add(sfx, riser(0.6, 0.45, 300, 3500), 12.9, send=0.3)
# 13.5: final hit + resolve chord
add(music, kick(1.0), 13.5); add(sfx, boom(1.0, 1.8), 13.5, send=0.6)
t = tt(1.5); chord = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0, 554.37))
add(music, filt(chord, 'lowpass', 2400) * np.minimum(1, t / 0.02) * np.exp(-t * 1.2) * 0.07, 13.5)
add(sfx, bell([880, 1108.7, 1318.5], 1.4, 0.2), 13.55, send=0.8)

# ---------------- sfx synced to reel15.js ----------------
for tw_ in (0.02, 0.16, 0.32, 0.46): add(sfx, impact(0.42), tw_ + 0.03, send=0.2)       # hook words slam
add(sfx, impact(0.45), 1.05, send=0.25); add(sfx, boom(0.9, 1.2), 1.24, send=0.5); add(sfx, glitch(0.25, 0.3), 1.22)
for c in (1, 2, 4, 6, 8, 10, 12, 13.5):                                                # wipes land on each cut
    add(sfx, whoosh(0.32, 0.5), c - 0.24)
for c in (2, 4, 6, 8, 10): add(sfx, impact(0.5), c + 0.03, send=0.3)                    # step numbers
# 01 programs: layers split, pen tool stroke
add(sfx, whoosh(0.5, 0.35, up=True), 2.25)
for i in range(4): add(sfx, pop(0.25, 900 + i * 180, 300), 2.3 + i * 0.05)
t = tt(0.8); add(sfx, filt(rng.standard_normal(len(t)), 'bandpass', [2500, 6000]) * np.sin(np.pi * t / 0.8) * 0.08, 2.9)
for k in (2.9, 3.35, 3.62): add(sfx, click(0.35), k)
# 02 academic: colour wheel segments + grid dots
for i in range(12): add(sfx, blip(523.25 * 2 ** (i / 12), 0.12), 4.15 + i * 0.03)
for k in range(4): add(sfx, click(0.3), 4.7 + k * 0.1)
add(sfx, pop(0.35, 1400, 500), 5.1)
# 03 AI: prompt typing, pixel resolve, reveal flash
for k in range(14): add(sfx, click(0.16 + 0.04 * (k % 2)), 6.15 + k * 0.047)
add(sfx, glitch(0.7, 0.28), 6.8); add(sfx, riser(0.75, 0.25, 400, 5000), 6.8)
add(sfx, bell([1318.5, 1760], 1.0, 0.16), 7.55, send=0.7); add(sfx, impact(0.4), 7.55, send=0.3)
# 04 market: six cards snap into the portfolio, counters tick
for i in range(6): add(sfx, pop(0.3, 1100 + i * 90, 350), 8.4 + i * 0.07)
for k in range(10): add(sfx, click(0.1), 8.9 + k * 0.08)
# 05 graduation: cards merge, stamp slam, confetti
add(sfx, whoosh(0.45, 0.4, up=False), 10.05)
add(sfx, impact(0.75), 10.65, send=0.4); add(sfx, boom(0.6, 1.0), 10.65, send=0.4)
R = np.random.default_rng(12)
for k in range(10): add(sfx, pop(0.12, 1500 + R.random() * 1500, 600), 10.7 + R.random() * 0.8, pan=R.random() * 1.6 - 0.8)
# MARO
add(sfx, thruster(0.9, 0.3), 12.0); add(sfx, maro_chirp(0.5), 12.6, send=0.4); add(sfx, impact(0.5), 12.57, send=0.3)
for k in range(2): add(sfx, blip(1046.5 * (1 + k * 0.5), 0.12), 12.25 + k * 0.12)

# ---------------- mix ----------------
ir_len = int(1.6 * SR); ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.8)[:, None]
ir = filt(ir, 'lowpass', 6000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(L.verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = music * 0.85 + sfx * 0.9 + wet * 0.45
mix = filt(mix, 'highpass', 25)
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
fo = int(0.3 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / np.abs(mix).max() * 0.9
wavfile.write('reel15_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok, rms dB', round(20 * np.log10(np.sqrt((mix ** 2).mean())), 1))
