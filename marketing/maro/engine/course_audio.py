"""Soundtrack for the course sales videos. Reads the beat timeline straight from course.js.
usage: python3 course_audio.py <vid>  ->  course_<vid>.wav
"""
import re, sys, os
import numpy as np
import sfxlib as L
from sfxlib import tt, filt, sweep_lp, kick, hat, clap, saw, boom, impact, whoosh, riser, bell, click, pop, blip, glitch, rng, SR
from scipy.io import wavfile
from scipy.signal import fftconvolve

VID = sys.argv[1]
SRC = os.environ.get('SRC', 'course.js'); SOFT = SRC != 'course.js'
src = open(SRC).read()
block = src[src.index(f' {VID}:['):]
nxt = re.search(r'\n \w+:\[', block[5:])
block = block[:nxt.start() + 5] if nxt else block[:block.index('};')]
beats = []
for m in re.finditer(r'\[([\d.]+),([\d.]+),t=>(b\w+)\(', block):
    t0, t1, kind = float(m.group(1)), float(m.group(2)), m.group(3)
    seg = block[m.end():block.find('\n', m.end())]
    beats.append((t0, t1, kind, seg.count('{ar:') + seg.count('{p:') + seg.count('{title:')))
DUR = beats[-1][1]
N = L.N = int(SR * DUR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); L.verb_send = np.zeros((N, 2))
add = L.add
exec('#'+open('maro_test_audio.py').read().split('# ---------- MARO signature sounds')[1].split('# ---------- music bed')[0])

BPM = 110; BEAT = 60 / BPM; BAR = 4 * BEAT
prog = [(55.0, (220.0, 261.63, 329.63)), (43.65, (174.61, 220.0, 261.63)), (65.41, (196.0, 261.63, 329.63)), (49.0, (196.0, 246.94, 293.66))]
def groove(a, b, gain=1.0):
    for i in range(int((b - a) / BEAT)):
        tb = a + i * BEAT
        add(music, kick(0.8 * gain), tb); add(music, hat(0.15 * gain), tb + BEAT / 2, pan=0.3)
        if i % 2: add(music, clap(0.26 * gain), tb, send=0.2)
        add(music, hat(0.06 * gain), tb + BEAT / 4, pan=-0.3); add(music, hat(0.06 * gain), tb + 3 * BEAT / 4, pan=-0.3)
    for j in range(int(np.ceil((b - a) / BAR))):
        s0 = a + j * BAR; s1 = min(b, s0 + BAR); root, ch = prog[j % 4]; tq = tt(s1 - s0)
        env = np.zeros(len(tq))
        for e in range(int((s1 - s0) / (BEAT / 2))):
            st = e * BEAT / 2 + BEAT / 4; env += ((tq >= st) & (tq < st + BEAT / 4)) * np.exp(-(tq - st).clip(0) * 6)
        add(music, filt((saw(root, tq) + np.sin(2*np.pi*root*tq) * 1.4) * env, 'lowpass', 420) * 0.22 * gain, s0)
        fade = np.minimum(1, tq / 0.06) * np.minimum(1, (s1 - s0 - tq) / 0.06)
        pl = sum(saw(f, tq, -0.004) + saw(f, tq, 0.003) for f in ch); pr = sum(saw(f, tq, 0.004) + saw(f*2, tq, -0.002)*0.3 for f in ch)
        add(music, filt(np.stack([pl*fade, pr*fade], 1), 'lowpass', 1700) * 0.04 * gain, s0)
def typing(t0, dur, step=0.05, g=0.18):
    k = 0
    while k * step < dur:
        add(sfx, click(g * rng.uniform(0.7, 1.1)), t0 + k * step, pan=rng.uniform(-0.3, 0.3)); k += 1

# music: tense drone under the hook, groove after it, resolve on the end card
hook_end = beats[0][1]
t = tt(hook_end + 0.3); add(music, (np.sin(2*np.pi*41*t) + 0.5*np.sin(2*np.pi*82*t)) * np.minimum(1, t/1.0) * 0.3, 0.0)
end_card = DUR - 2.6
groove(hook_end, end_card)
t = tt(3.0); chord = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0))
add(music, filt(chord, 'lowpass', 2000) * np.minimum(1, t/0.05) * np.exp(-t*0.8) * 0.06, end_card)

add(sfx, rip(0.7), 0.05); add(sfx, whoosh(0.7, 0.3), 0.1)
for i, (t0, t1, kind, n) in enumerate(beats):
    if i and not SOFT: add(sfx, whoosh(0.5, 0.45), t0 - 0.3)
    if i and SOFT:   # gentle swell for soft transitions
        add(sfx, riser(0.7, 0.14, 300, 1600), t0 - 0.55); add(sfx, whoosh(0.9, 0.18), t0 - 0.5)
        add(sfx, bell([880 * (1.122 ** (i % 5))], 1.2, 0.05), t0, send=0.8)
    if kind == 'bHook':
        for k in range(2): add(sfx, impact(0.5), t0 + 0.3 + k * 0.8, send=0.35); add(sfx, whoosh(0.4, 0.25, up=False), t0 + 0.15 + k * 0.8)
        if i: add(sfx, maro_chirp(0.35), t0 + 1.3, send=0.4)
    elif kind == 'bTitle':
        add(sfx, maro_chirp(0.45), t0 + 0.2, send=0.5); add(sfx, impact(0.5), t0 + 0.45, send=0.4); typing(t0 + 1.2, 0.5)
    elif kind == 'bSteps':
        dt = min(0.55, (t1 - t0 - 1.6) / max(1, n))
        for k in range(n): add(sfx, pop(0.35, 700 + k * 120, 280), t0 + 0.3 + k * dt); add(sfx, click(0.2), t0 + 0.4 + k * dt)
        add(sfx, bell([1318.5, 1760], 0.9, 0.1), t0 + 0.4 + dt * n, send=0.6)
    elif kind == 'bOrbit':
        add(sfx, boom(0.7, 1.5), t0 + 0.2, send=0.5); add(sfx, bell([523.25, 783.99, 1046.5], 1.6, 0.16), t0 + 0.2, send=0.8)
        for k in range(5): add(sfx, pop(0.3, 800 + k * 110, 300), t0 + 0.5 + k * 0.12)
        if 'badge' in block: add(sfx, impact(0.5), t1 - 1.6, send=0.4); add(sfx, bell([1568, 2093], 0.8, 0.1), t1 - 1.55, send=0.6)
    elif kind == 'bGifts':
        for k in range(2): add(sfx, pop(0.35, 900, 300), t0 + 0.3 + k * 0.35)
        add(sfx, riser(0.2, 0.25, 400, 1500), t0 + 1.6); add(sfx, impact(0.6), t0 + 1.8, send=0.3)
        add(sfx, bell([2093, 2637], 0.9, 0.16), t0 + 1.85, send=0.5); add(sfx, bell([2637, 3136], 1.1, 0.16), t0 + 1.95, send=0.5)
        for k in range(10): add(sfx, click(0.2), t0 + 2.3 + k * 0.07)
    elif kind == 'bBenefits':
        add(sfx, boom(0.5, 1.2), t0 + 0.2, send=0.4)
        for k in range(6): add(sfx, pop(0.28, 750 + k * 90, 300), t0 + 0.4 + k * 0.1, pan=np.sin(k) * 0.6)
    elif kind == 'bAIPro':
        add(sfx, impact(0.6), t0 + 0.15, send=0.5); add(sfx, bell([659.25, 987.77, 1318.5], 1.4, 0.18), t0 + 0.2, send=0.8)
        for k in range(12): add(sfx, click(0.2), t0 + 0.5 + k * 0.065)
        add(sfx, pop(0.3, 1000, 400), t0 + 0.95); add(sfx, pop(0.3, 1100, 400), t0 + 1.15)
    elif kind == 'bPrice':
        add(sfx, maro_chirp(0.4), t0 + 0.1, send=0.4); add(sfx, impact(0.55), t0 + 0.3, send=0.4)
        add(sfx, riser(0.25, 0.25, 400, 1500), t0 + 0.8)
        for k in range(10): add(sfx, click(0.22), t0 + 1.1 + k * 0.07)
        add(sfx, bell([2093, 2637], 0.9, 0.18), t0 + 1.8, send=0.5); add(sfx, bell([2637, 3136], 1.2, 0.18), t0 + 1.9, send=0.5)
    elif kind == 'bOffer':
        add(sfx, impact(0.55), t0 + 0.4, send=0.4); add(sfx, impact(0.5), t0 + 0.6, send=0.4); typing(t0 + 1.2, 0.55)
        add(sfx, maro_chirp(0.4), t0 + 0.8, send=0.5)
    elif kind == 'bEquation':
        add(sfx, pop(0.35, 900, 300), t0 + 0.2); add(sfx, pop(0.35, 1000, 300), t0 + 0.7); add(sfx, whoosh(0.4, 0.3), t0 + 1.1)
        add(sfx, impact(0.6), t0 + 1.5, send=0.5); add(sfx, bell([1046.5, 1318.5, 1568], 1.2, 0.16), t0 + 1.55, send=0.7)
    elif kind == 'bFlips':
        n = n or block.count('{p:')
        dt = (t1 - t0) / n
        for k in range(n):
            ti = t0 + k * dt
            add(sfx, whoosh(0.35, 0.3, up=False), ti); add(sfx, blip(660, 0.05), ti + 0.4)
            add(sfx, whoosh(0.3, 0.35), ti + 0.78); add(sfx, pop(0.35, 1100, 400), ti + 1.0); add(sfx, maro_chirp(0.3), ti + 1.05, send=0.4)
    elif kind == 'bScatter':
        for k in range(5): add(sfx, blip(520 + k * 60, 0.03), t0 + 0.15 + k * 0.06, send=0.3)
        add(sfx, whoosh(0.8, 0.3), t0 + 1.4)
        for k in range(5): add(sfx, pop(0.3, 700 + k * 120, 280), t0 + 2.4 + k * 0.08)
        typing(t0 + 2.4, 0.6); add(sfx, bell([1318.5, 1760], 0.9, 0.1), t0 + 3.0, send=0.6)
    elif kind == 'bGaps':
        for k in range(5): add(sfx, riser(0.7, 0.12, 300, 1200), t0 + 0.5 + k * 0.18)
        for k in range(3): add(sfx, blip(440, 0.06), t0 + 2.0 + k * 0.05)
        add(sfx, maro_chirp(0.35), t0 + 2.1, send=0.4); add(sfx, bell([1046.5, 1568], 0.9, 0.1), t0 + 2.8, send=0.6)
    elif kind == 'bMarquee':
        add(sfx, impact(0.45), t0 + 0.25, send=0.4); add(sfx, whoosh(1.2, 0.25), t0 + 0.4)
        for k in range(6): add(sfx, pop(0.2, 800 + k * 70, 350), t0 + 0.5 + k * 0.12)
    elif kind == 'bCTA':
        add(sfx, maro_chirp(0.45), t0 + 0.2, send=0.5); add(sfx, impact(0.5), t0 + 0.45, send=0.4)
        add(sfx, pop(0.4, 1200, 400), t0 + 1.25); add(sfx, bell([1568, 2093], 0.8, 0.1), t0 + 1.3, send=0.6)
        add(sfx, whoosh(0.7, 0.45), t1 - 2.7); add(sfx, boom(0.6, 1.6), t1 - 2.1, send=0.5)
        add(sfx, bell([440, 554.37, 659.25, 880], 2.0, 0.2), t1 - 2.05, send=0.9)

MUSIC = os.environ.get('MUSIC')
if MUSIC:
    from music_styles import bed
    music[int(hook_end * SR):] = 0
    music += bed(MUSIC, DUR, hook_end, end_card) * 0.95
    t = tt(3.0); chord = sum(saw(f, t, 0.003) for f in (220.0, 277.18, 329.63, 440.0))
    add(music, filt(chord, 'lowpass', 2000) * np.minimum(1, t/0.05) * np.exp(-t*0.8) * 0.06, end_card)
ir_len = int(1.9 * SR); ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.4)[:, None]
ir = filt(ir, 'lowpass', 6000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(L.verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = filt(music * 0.8 + sfx + wet * 0.5, 'highpass', 25)
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
fo = int(0.35 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / np.abs(mix).max() * 0.89
wavfile.write(f'course_{VID}' + (f'_{MUSIC}' if MUSIC else '') + '.wav', SR, (mix * 32767).astype(np.int16))
print(VID, 'beats', [(b[0], b[2], b[3]) for b in beats], 'dur', DUR)
