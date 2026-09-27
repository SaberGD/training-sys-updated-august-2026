"""60s soundtrack for the MARO launch video. Every event is synced to launch.js."""
import numpy as np
import os
import sfxlib as L
from sfxlib import tt, filt, sweep_lp, kick, hat, clap, saw, boom, impact, whoosh, riser, bell, click, pop, blip, glitch, rng, SR
from scipy.io import wavfile
from scipy.signal import fftconvolve

DUR = 60.0
N = L.N = int(SR * DUR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); L.verb_send = np.zeros((N, 2))
add = L.add

# MARO signature sounds (shared with the style test)
src = open('maro_test_audio.py').read()
exec(src[src.index('# ---------- MARO signature sounds'):src.index('# ---------- music bed')])

BPM = 110; BEAT = 60 / BPM; BAR = 4 * BEAT
prog = [(55.0, (220.0, 261.63, 329.63)), (43.65, (174.61, 220.0, 261.63)), (65.41, (196.0, 261.63, 329.63)), (49.0, (196.0, 246.94, 293.66))]

# ---------------- music ----------------
t = tt(4.2)                                                     # 3AM tension: low drone + heartbeat
add(music, (np.sin(2*np.pi*41*t) + 0.5*np.sin(2*np.pi*82*t)) * np.minimum(1, t/1.2) * 0.3, 0.0)
for k in range(4):
    add(music, kick(0.35), 0.5 + k * 0.95); add(music, kick(0.22), 0.5 + k * 0.95 + 0.22)
t = tt(2.6); add(music, (np.sin(2*np.pi*55*t)+0.4*np.sin(2*np.pi*110*t))*np.minimum(1,t/1.0)*0.25, 4.0)

def groove(a, b, full=True, gain=1.0):
    nb = int((b - a) / BEAT)
    for i in range(nb):
        tb = a + i * BEAT
        add(music, kick(0.8 * gain), tb)
        add(music, hat(0.16 * gain), tb + BEAT / 2, pan=0.3)
        if full and i % 2 == 1: add(music, clap(0.28 * gain), tb, send=0.2)
        if full: add(music, hat(0.07 * gain), tb + BEAT / 4, pan=-0.3); add(music, hat(0.07 * gain), tb + 3 * BEAT / 4, pan=-0.3)
    # bass + pad per bar, ducked by the kick
    bars = int(np.ceil((b - a) / BAR))
    for j in range(bars):
        s0 = a + j * BAR; s1 = min(b, s0 + BAR); root, ch = prog[j % 4]
        tq = tt(s1 - s0)
        env = np.zeros(len(tq))
        for e in range(int((s1 - s0) / (BEAT / 2))):
            st = e * BEAT / 2 + BEAT / 4
            env += ((tq >= st) & (tq < st + BEAT / 4)) * np.exp(-(tq - st).clip(0) * 6)
        bass = filt((saw(root, tq) + np.sin(2*np.pi*root*tq) * 1.4) * env, 'lowpass', 420) * 0.22 * gain
        padl = sum(saw(f, tq, -0.004) + saw(f, tq, 0.003) for f in ch); padr = sum(saw(f, tq, 0.004) + saw(f*2, tq, -0.002)*0.3 for f in ch)
        fade = np.minimum(1, tq / 0.06) * np.minimum(1, (s1 - s0 - tq) / 0.06)
        pad = filt(np.stack([padl*fade, padr*fade], 1), 'lowpass', 1700) * 0.04 * gain
        add(music, bass, s0); add(music, pad, s0)

groove(6.4, 47.6, full=True)
t = tt(0.9); add(music, filt(rng.standard_normal(len(t)), 'lowpass', 900) * np.linspace(0, 0.25, len(t)), 47.1)   # filter build
groove(48.0, 53.2, full=True, gain=1.15)
add(sfx, riser(1.4, 0.55, 120, 3000), 52.2, send=0.3)
groove(53.6, 57.2, full=True, gain=1.1)
t = tt(3.0); chord = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0))
add(music, filt(chord, 'lowpass', 2000) * np.minimum(1, t/0.05) * np.exp(-t*0.7) * 0.06, 57.4)

# ---------------- transitions ----------------
for tb in (6.4, 9.4, 14.4, 18.4, 21.2, 23.4, 26.8, 32.8, 37.0, 43.0, 53.6):
    add(sfx, whoosh(0.5, 0.45), tb - 0.3)
add(sfx, boom(0.8, 1.6), 48.0, send=0.5)                        # zoom into the USP
add(sfx, boom(1.0, 2.2), 53.6, send=0.6)                        # drop into the CTA
for tb in (9.45, 14.45, 18.45, 26.85, 32.85, 37.05, 43.05):     # chapter numbers
    add(sfx, impact(0.4), tb + 0.08, send=0.3)

def typing(t0, dur, step=0.05, g=0.2):
    k = 0
    while k * step < dur:
        add(sfx, click(g * rng.uniform(0.7, 1.1)), t0 + k * step + rng.uniform(-0.006, 0.006), pan=rng.uniform(-0.3, 0.3)); k += 1
def msg_typing(t0, text):
    typing(t0 + 0.15, min(1.0, len(text) * 0.02))
    add(sfx, pop(0.25, 900, 400), t0)

# ---------------- hook ----------------
add(sfx, rip(0.7), 0.05); add(sfx, whoosh(0.7, 0.3), 0.1)
for k in range(4): add(sfx, click(0.45), 0.6 + k)               # clock seconds
for t0 in (0.7, 1.35, 2.0): typing(t0 + 0.2, 0.4)
add(sfx, riser(1.0, 0.4, 100, 1200), 2.9)                       # push into the laptop
# ---------------- boot + hello ----------------
add(sfx, power_on(0.5), 4.1)
add(sfx, glitch(0.3, 0.35), 4.4, pan=-0.2); add(sfx, glitch(0.25, 0.3), 5.0, pan=0.2)
add(sfx, riser(0.2, 0.25, 900, 200), 5.3)
add(sfx, maro_chirp(0.55), 5.46, send=0.5); add(sfx, bell([1318.5, 1975.5], 1.2, 0.12), 5.48, send=0.7)
add(sfx, click(0.3), 5.95)
add(sfx, thruster(3.0, 0.1), 6.4, pan=-0.4)
add(sfx, impact(0.5), 6.9, send=0.4); typing(7.9, 0.5)
add(sfx, maro_chirp(0.35, up=False), 8.3, send=0.4)
# ---------------- 01 brainstorm ----------------
msg_typing(9.7, 'عندي كامبين لفيزيتا لازم يحسس العيلة بالأمان.. ومش لاقي فكرة')
for k in range(5): add(sfx, blip(660 + k * 110, 0.05), 10.75 + k * 0.1, send=0.3)
for i in range(3): add(sfx, pop(0.32, 800 + i * 150, 300), 11.35 + i * 0.28)
add(sfx, maro_chirp(0.4), 11.35, send=0.4)
add(sfx, impact(0.35), 12.8); add(sfx, bell([1046.5, 1568], 1.0, 0.14), 12.85, send=0.6); add(sfx, maro_chirp(0.35), 13.0, send=0.4)
# ---------------- 02 brief ----------------
add(sfx, whoosh(0.4, 0.25), 14.5)
for i in range(5): typing(15.25 + i * 0.38, 0.3, 0.045, 0.17); add(sfx, pop(0.18, 700, 350), 15.0 + i * 0.38)
add(sfx, bell([1318.5, 1760], 0.9, 0.12), 17.3, send=0.6)
# ---------------- 03 image tools ----------------
add(sfx, whoosh(0.8, 0.25, up=False), 19.0)                     # scan
typing(19.7, 1.4, 0.035, 0.13)
msg_typing(21.35, 'موبايل نايم على أرض الصالة وطالع منه عيادة صغيرة.. والعيلة حواليه')
typing(22.2, 1.2, 0.035, 0.13)
add(sfx, maro_chirp(0.35), 22.9, send=0.4)
pent = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]
tb = 23.7
while tb < 25.0: add(sfx, blip(float(rng.choice(pent)) * 2, 0.03), tb, pan=rng.uniform(-0.6, 0.6), send=0.3); tb += 0.06
add(sfx, riser(1.3, 0.35, 200, 2400), 23.7)
add(sfx, impact(0.6), 25.0, send=0.5); add(sfx, bell([659.25, 987.77, 1318.5], 1.6, 0.18), 25.0, send=0.8)
add(sfx, maro_chirp(0.4), 25.05, send=0.4); add(sfx, whoosh(0.5, 0.3), 25.3)
# ---------------- 04 critique ----------------
for i in range(3): add(sfx, pop(0.3, 1000, 380), 27.7 + i * 0.45)
for k in range(6): add(sfx, click(0.2), 28.9 + k * 0.08)
add(sfx, whoosh(0.5, 0.35, up=False), 29.6)
for k in range(8): add(sfx, click(0.22), 30.1 + k * 0.1)
add(sfx, bell([1046.5, 1318.5, 1568], 1.2, 0.18), 30.9, send=0.7); add(sfx, maro_chirp(0.4), 30.25, send=0.4)
# ---------------- 05 analyze ----------------
add(sfx, whoosh(0.6, 0.3), 33.25)
add(sfx, bell([2093], 0.6, 0.06), 33.8, send=0.6)
for i in range(3): add(sfx, pop(0.25, 900, 300), 34.1 + i * 0.15)
for i in range(5): add(sfx, pop(0.2, 1100 + i * 80, 500), 34.3 + i * 0.08)
for i in range(3): add(sfx, pop(0.25, 700, 350), 34.8 + i * 0.4)
# ---------------- 06 always on ----------------
add(sfx, impact(0.35), 37.1)
msg_typing(37.4, 'الصورة بتبوظ وتتكسر لما أكبّرها في البوستر!')
for k in range(4): add(sfx, blip(700 + k * 90, 0.04), 38.0 + k * 0.12)
add(sfx, pop(0.3, 1200, 500), 38.5); add(sfx, bell([1318.5, 1760], 0.8, 0.12), 38.7, send=0.6)
for k in range(5): add(sfx, click(0.35), 39.7 + k * 0.1)       # clock roll
msg_typing(40.5, 'لو فاتتني محاضرة؟')
for k in range(4): add(sfx, blip(700 + k * 90, 0.04), 41.0 + k * 0.12)
add(sfx, pop(0.3, 1200, 500), 41.5); add(sfx, bell([1318.5, 1760], 0.8, 0.12), 41.7, send=0.6); add(sfx, maro_chirp(0.35), 41.6, send=0.4)
# ---------------- 07 coach ----------------
add(sfx, whoosh(0.5, 0.3), 43.1)
for i in range(3): add(sfx, riser(0.6, 0.18, 300, 1400), 44.2 + i * 0.3); add(sfx, pop(0.2, 900, 400), 44.9 + i * 0.3)
add(sfx, pop(0.35, 1000, 350), 45.6); add(sfx, bell([1568, 2093], 0.8, 0.1), 45.7, send=0.6)
add(sfx, riser(0.4, 0.3, 300, 2000), 46.3); add(sfx, maro_chirp(0.4), 46.45, send=0.4)
# ---------------- USP ----------------
add(sfx, impact(0.6), 48.7, send=0.5)
typing(49.7, 0.55); typing(50.8, 0.55)
add(sfx, bell([880, 1318.5], 1.2, 0.08), 48.3, send=0.8)
add(sfx, whoosh(1.2, 0.6), 52.4); add(sfx, thruster(1.1, 0.25), 52.4)
# ---------------- CTA + end ----------------
add(sfx, impact(0.55), 54.3, send=0.4)
add(sfx, riser(0.4, 0.3, 300, 2000), 54.9); add(sfx, maro_chirp(0.45), 55.0, send=0.4)
add(sfx, impact(0.7), 55.2, send=0.3); add(sfx, bell([2093, 2637], 0.9, 0.18), 55.26, send=0.5); add(sfx, bell([2637, 3136], 1.2, 0.18), 55.36, send=0.5)
for k in range(2): add(sfx, click(0.35), 56.2 + k)
typing(56.1, 0.7, 0.04, 0.15)
add(sfx, whoosh(0.6, 0.45), 56.9); add(sfx, whoosh(0.7, 0.4, up=False), 57.5)
add(sfx, bell([440, 554.37, 659.25, 880], 2.2, 0.22), 58.0, send=0.9)
add(sfx, maro_chirp(0.45), 59.0, send=0.5)

MUSIC = os.environ.get('MUSIC')
if MUSIC:
    from music_styles import bed
    music[int(6.4 * SR):] = 0
    music += bed(MUSIC, DUR, 6.4, 57.2, breaks=[(47.4, 48.0), (53.1, 53.6)], drop=(52.2, 53.6)) * 0.95
    t = tt(3.0); chord = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0))
    add(music, filt(chord, 'lowpass', 2000) * np.minimum(1, t/0.05) * np.exp(-t*0.7) * 0.06, 57.4)
# ---------------- mix ----------------
ir_len = int(1.9 * SR); ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.4)[:, None]
ir = filt(ir, 'lowpass', 6000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(L.verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = music * 0.8 + sfx + wet * 0.5
mix = filt(mix, 'highpass', 25)
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
fo = int(0.35 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / np.abs(mix).max() * 0.89
wavfile.write('launch_audio' + (f'_{MUSIC}' if MUSIC else '') + '.wav', SR, (mix * 32767).astype(np.int16))
print('ok, rms dB', 20 * np.log10(np.sqrt((mix ** 2).mean())))
