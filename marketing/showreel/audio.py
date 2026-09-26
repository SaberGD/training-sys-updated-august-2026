"""Synthesized score + SFX for the 30s SABER GROUP reel. 120 BPM, events synced to reel.html."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
verb_send = np.zeros((N, 2))


def tt(d):
    return np.arange(int(d * SR)) / SR


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x, axis=0)


def add(buf, sig, t0, gain=1.0, pan=0.0, send=0.0):
    if sig.ndim == 1:
        l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], axis=1)
    i = int(t0 * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    buf[i:j] += sig[: j - i] * gain
    if send:
        verb_send[i:j] += sig[: j - i] * gain * send


def sweep_lp(x, f0, f1):
    """time-varying one-pole lowpass, exponential cutoff sweep"""
    n = len(x)
    fc = f0 * (f1 / f0) ** (np.arange(n) / n)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for k in range(n):
        s += a[k] * (x[k] - s)
        y[k] = s
    return y


# ---------------- instruments ----------------
def kick(g=1.0):
    t = tt(0.45)
    f = 45 + 120 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7)
    click = filt(rng.standard_normal(len(t)), 'highpass', 2500) * np.exp(-t * 180) * 0.25
    return np.tanh((s + click) * 1.6) * g


def hat(g=1.0, open_=False):
    t = tt(0.25 if open_ else 0.06)
    s = filt(rng.standard_normal(len(t)), 'highpass', 7000) * np.exp(-t * (12 if open_ else 70))
    return s * g


def clap(g=1.0):
    t = tt(0.3)
    env = np.zeros(len(t))
    for d in (0, 0.011, 0.022):
        env += (t >= d) * np.exp(-(t - d).clip(0) * 60)
    env += np.exp(-t * 14) * 0.4
    return filt(rng.standard_normal(len(t)), 'bandpass', [900, 4000]) * env * g


def saw(freq, t, detune=0.0):
    ph = (freq * (1 + detune) * t) % 1.0
    return 2 * ph - 1


def boom(g=1.0, length=2.5):
    t = tt(length)
    f = 25 + 70 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    crack = filt(rng.standard_normal(len(t)), 'lowpass', 5000) * np.exp(-t * 16) * 0.7
    body = filt(rng.standard_normal(len(t)), 'lowpass', 300) * np.exp(-t * 4) * 0.8
    return np.tanh((s * 1.3 + crack + body) * 1.4) * g


def impact(g=1.0):
    t = tt(1.0)
    f = 40 + 90 * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    n = filt(rng.standard_normal(len(t)), 'bandpass', [200, 3000]) * np.exp(-t * 25) * 0.6
    return np.tanh((s + n) * 1.5) * g


def whoosh(length=0.7, g=1.0, up=True):
    n = rng.standard_normal(int(length * SR))
    t = tt(length)
    env = np.sin(np.pi * (t / length) ** (0.8 if up else 1.4)) ** 2
    y = sweep_lp(n, 300, 7000) if up else sweep_lp(n, 7000, 300)
    y = y * env
    y /= np.abs(y).max() + 1e-9
    # stereo movement right -> left (matches the wipe direction)
    pan = np.linspace(0.8, -0.8, len(y))
    return np.stack([y * np.sqrt((1 - pan) / 2), y * np.sqrt((1 + pan) / 2)], 1) * 1.414 * g


def riser(length, g=1.0, f0=150, f1=1800):
    t = tt(length)
    n = sweep_lp(rng.standard_normal(len(t)), 200, 9000)
    f = f0 * (f1 / f0) ** (t / length)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.15
    env = (t / length) ** 2.2
    y = (n * 0.8 + tone) * env
    return y / (np.abs(y).max() + 1e-9) * g


def bell(freqs, length=2.0, g=1.0):
    t = tt(length)
    y = np.zeros(len(t))
    for i, f in enumerate(freqs):
        for m, a, d in ((1, 1, 2.5), (2.76, 0.4, 5), (5.4, 0.2, 8)):
            y += a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * d * (1 + i * 0.1))
    y *= np.minimum(1, t * 400)
    return y / (np.abs(y).max() + 1e-9) * g


def click(g=1.0):
    t = tt(0.018)
    return filt(rng.standard_normal(len(t)), 'bandpass', [2500, 7000]) * np.exp(-t * 350) * g


def pop(g=1.0, f0=1200, f1=300):
    t = tt(0.09)
    f = f1 + (f0 - f1) * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40) * g


def blip(freq, g=1.0):
    t = tt(0.05)
    return np.sign(np.sin(2 * np.pi * freq * t)) * np.exp(-t * 60) * g


def glitch(length=0.35, g=1.0):
    y = np.zeros(int(length * SR))
    pos = 0
    while pos < len(y):
        seg = int(SR * rng.uniform(0.012, 0.04))
        n = rng.standard_normal(seg)
        n = np.round(n * 3) / 3  # bitcrush
        n = n[:: rng.integers(2, 8)].repeat(8)[:seg] if rng.random() < 0.6 else n
        if len(n) < seg:
            n = np.pad(n, (0, seg - len(n)))
        y[pos:pos + seg] = n[: len(y) - pos] * (rng.random() > 0.25)
        pos += seg
    return filt(y, 'highpass', 400) * np.linspace(1, 0.2, len(y)) * g


# ---------------- score ----------------
BPM = 120
BEAT = 60 / BPM
# Am - F - C - G (one chord per bar = 2s)
prog = [(55.0, [220.0, 261.63, 329.63]), (43.65, [174.61, 220.0, 261.63]),
        (65.41, [196.0, 261.63, 329.63]), (49.0, [196.0, 246.94, 293.66])]
kicks = [3.0 + i * BEAT for i in range(int((25.75 - 3.0) / BEAT))] + [26.0 + i * BEAT for i in range(6)]

# sidechain envelope from kicks
duck = np.ones(N)
for k in kicks:
    i = int(k * SR)
    t = tt(0.4)
    d = 1 - 0.75 * np.exp(-t * 11)
    j = min(N, i + len(t))
    duck[i:j] = np.minimum(duck[i:j], d[: j - i])

# intro drone 0-2s
t = tt(2.2)
drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.5 * t)) * (t / 2.2) ** 1.5 * 0.35
add(music, drone, 0.0)

for k in kicks:
    add(music, kick(0.95), k)
# hats on offbeats from 5.0, 16ths in the build
for i in range(int((25.75 - 5.0) / (BEAT / 2))):
    tb = 5.0 + i * BEAT / 2
    if i % 2 == 1:
        add(music, hat(0.22, open_=(i % 8 == 7)), tb, pan=0.3)
    elif tb >= 12.5:
        add(music, hat(0.1), tb, pan=-0.3)
for i in range(6):
    add(music, hat(0.2), 26.0 + BEAT / 2 + i * BEAT, pan=0.3)
# claps on 2 & 4 from 7.0
for i in range(int((25.0 - 7.0) / BEAT)):
    if i % 2 == 1:
        add(music, clap(0.4), 7.0 + i * BEAT, send=0.25)
for i in range(3):
    add(music, clap(0.4), 26.0 + BEAT + i * 2 * BEAT, send=0.25)
# snare roll build 24-25.75
tr = 24.0
step = 0.125
while tr < 25.75:
    g = 0.12 + 0.35 * (tr - 24.0) / 1.75
    add(music, clap(g), tr, send=0.2)
    step = 0.125 if tr < 25.0 else 0.0625
    tr += step

# bass + pads, bar-locked from 2.0
bass = np.zeros(N)
pad = np.zeros((N, 2))
bar0 = 2.0
for b in range(14):
    tb = bar0 + b * 2.0
    if tb >= 29.0:
        break
    root, chord = prog[b % 4]
    if 25.75 <= tb < 26.0:
        continue
    blen = 2.0 if tb + 2.0 <= 25.75 or tb >= 26.0 else 25.75 - tb
    if tb >= 26.0:
        blen = min(2.0, 29.0 - tb)
    t = tt(blen)
    # rolling 8th-note bass (off-beat pump)
    env = np.zeros(len(t))
    for e in range(int(blen / (BEAT / 2))):
        s0 = e * BEAT / 2
        env += ((t >= s0) & (t < s0 + BEAT / 2 - 0.02)) * np.exp(-(t - s0).clip(0) * 5)
    bs = (saw(root, t) + saw(root, t, 0.006) + np.sin(2 * np.pi * root * t) * 1.5) * env
    i = int(tb * SR)
    j = min(N, i + len(t))
    bass[i:j] += bs[: j - i]
    # pad
    pl = np.zeros(len(t))
    pr = np.zeros(len(t))
    for f in chord:
        pl += saw(f, t, -0.004) + saw(f, t, 0.003)
        pr += saw(f, t, 0.004) + saw(f * 2, t, -0.002) * 0.3
    fade = np.minimum(1, t / 0.05) * np.minimum(1, (blen - t) / 0.08)
    pad[i:j, 0] += (pl * fade)[: j - i]
    pad[i:j, 1] += (pr * fade)[: j - i]

bass = filt(bass, 'lowpass', 420) * 0.2
pad = filt(pad, 'lowpass', 1800) * 0.045
pad_gain = np.clip((np.arange(N) / SR - 2.0) / 3.0, 0, 1)  # pads swell in
music[:, 0] += (bass + pad[:, 0] * pad_gain) * duck
music[:, 1] += (bass + pad[:, 1] * pad_gain) * duck
# lead arp stab in CTA section (26-29)
arp = [880, 1046.5, 1318.5, 1046.5]
for i in range(12):
    tb = 26.0 + i * BEAT / 2
    f = arp[i % 4] * (1 if i < 8 else 0.75 if i < 10 else 1)
    t = tt(0.22)
    s = (saw(f, t) * 0.5 + np.sin(2 * np.pi * f * t)) * np.exp(-t * 12)
    add(music, filt(s, 'lowpass', 3500) * 0.1, tb, pan=(0.4 if i % 2 else -0.4), send=0.4)

# ---------------- sound design ----------------
add(sfx, riser(1.95, 0.55, 80, 900), 0.05, send=0.3)          # ember particles converging
add(sfx, whoosh(1.2, 0.35), 0.8)                                  # swirl
add(sfx, boom(1.0, 2.8), 2.0, send=0.6)                           # LOGO SLAM
add(sfx, bell([440, 659.25, 880], 2.5, 0.25), 2.02, send=0.8)     # shimmer on reveal
add(sfx, whoosh(0.5, 0.5), 2.55)                                  # zoom into logo
for w in (3.0, 7.0, 12.5, 17.0, 22.0):
    add(sfx, whoosh(0.62, 0.55), w - 0.34)                        # ember wipes
# kinetic type slams
add(sfx, impact(0.55), 3.0, send=0.3)
add(sfx, impact(0.55), 3.5, send=0.3)
add(sfx, impact(0.8), 4.0, send=0.4)
add(sfx, glitch(0.3, 0.3), 4.0, pan=0.2)
add(sfx, whoosh(0.4, 0.3), 4.85)
add(sfx, pop(0.25, 600, 180), 5.0)
add(sfx, pop(0.3, 700, 200), 5.5)
add(sfx, bell([1318.5, 1760], 1.2, 0.08), 5.75, send=0.6)
# prompt typing
prompt_len = len('بوستر إعلاني لمشروب طاقة بإضاءة سينمائية ونار')
for k in range(prompt_len):
    tk = 7.35 + (k + 1) / prompt_len * 1.45
    add(sfx, click(rng.uniform(0.18, 0.32)), tk + rng.uniform(-0.006, 0.006), pan=rng.uniform(-0.3, 0.3))
add(sfx, pop(0.4, 1500, 500), 9.0)                                # generate button
add(sfx, click(0.5), 9.0)
# AI generation: data bleeps + riser
pent = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5]
tb = 9.1
while tb < 10.95:
    add(sfx, blip(rng.choice(pent) * rng.choice([1, 2]), 0.035), tb, pan=rng.uniform(-0.7, 0.7), send=0.3)
    tb += 0.0625
add(sfx, riser(1.9, 0.4, 200, 2400), 9.1, send=0.3)
add(sfx, impact(0.7), 11.0, send=0.5)                             # reveal
add(sfx, bell([659.25, 987.77, 1318.5], 2.0, 0.2), 11.0, send=0.8)
add(sfx, whoosh(0.5, 0.2), 11.1)                                  # shimmer sweep
for i, t0 in enumerate((11.3, 11.4, 11.5, 11.6)):
    add(sfx, pop(0.3, 900 + i * 150, 300), t0, pan=(-0.5 if i in (0, 1) else 0.5))
# software tiles slam
for i, t0 in enumerate((12.5, 13.0, 13.5)):
    add(sfx, impact(0.5), t0 + 0.08)
    add(sfx, bell([880 * (1.25 ** i)], 0.5, 0.08), t0 + 0.08, send=0.4)
add(sfx, boom(0.65, 1.8), 14.0, send=0.5)                         # AI tile
add(sfx, bell([523.25, 783.99, 1046.5, 1567.98], 2.0, 0.2), 14.0, send=0.8)
add(sfx, whoosh(0.8, 0.3), 14.45)                                  # marquee in
add(sfx, pop(0.35, 1100, 400), 15.3)
add(sfx, bell([1567.98], 0.8, 0.1), 15.35, send=0.5)
# counters
tc = 17.05
while tc < 18.4:
    add(sfx, click(0.22), tc, pan=rng.uniform(-0.6, 0.6))
    tc += 0.045 + (tc - 17.0) * 0.03
add(sfx, bell([1318.5, 1975.53], 1.0, 0.14), 18.35, send=0.6)
add(sfx, whoosh(0.4, 0.3), 19.2)
add(sfx, impact(0.6), 19.5, send=0.5)                             # ADS OF THE WORLD
add(sfx, bell([783.99, 1174.66, 1567.98, 2349.3], 2.4, 0.22), 19.5, send=0.9)
for i in range(8):
    add(sfx, bell([2093 * (1.122 ** (i % 5))], 0.4, 0.035), 19.7 + i * 0.12, pan=rng.uniform(-0.8, 0.8), send=0.7)
# track cards
add(sfx, whoosh(0.45, 0.35, up=False), 22.0)
add(sfx, whoosh(0.45, 0.35, up=False), 22.5)
for t0 in (23.6, 23.9, 24.2, 24.5):
    add(sfx, pop(0.3, 1000, 350), t0)
add(sfx, riser(1.75, 0.6, 120, 3000), 24.0, send=0.3)             # build to CTA
add(sfx, boom(1.0, 3.0), 26.0, send=0.6)                          # DROP
add(sfx, bell([440, 554.37, 659.25, 880], 2.5, 0.2), 26.0, send=0.9)
add(sfx, pop(0.35, 800, 250), 26.2)
add(sfx, impact(0.5), 26.5, send=0.4)                             # "مجانًا"
add(sfx, impact(0.7), 27.0, send=0.3)                             # coupon stamp
add(sfx, bell([2093, 2637], 0.9, 0.18), 27.06, send=0.5)          # cha-
add(sfx, bell([2637, 3136], 1.2, 0.18), 27.16, send=0.5)          # -ching
for s in (28.0, 29.0):                                            # countdown ticks
    add(sfx, click(0.35), s)
url_len = len('ai.sabergroupacademy.com')
for k in range(url_len):
    add(sfx, click(rng.uniform(0.15, 0.27)), 27.9 + (k + 1) / url_len * 0.7, pan=rng.uniform(-0.3, 0.3))
add(sfx, pop(0.3, 900, 300), 28.6)
add(sfx, boom(0.9, 1.0), 29.0, send=0.7)                          # final hit
add(sfx, bell([220, 329.63, 440, 659.25], 1.0, 0.22), 29.0, send=1.0)

# ---------------- reverb + master ----------------
ir_len = int(2.2 * SR)
ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.2)[:, None]
ir = filt(ir, 'lowpass', 6000)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)

mix = music * 0.8 + sfx * 0.95 + wet * 0.5
mix = filt(mix, 'highpass', 25)
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
fade = np.ones(N)
fo = int(0.3 * SR)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = mix / np.abs(mix).max() * 0.89
wavfile.write('audio.wav', SR, (mix * 32767).astype(np.int16))
print('peak ok, rms dB:', 20 * np.log10(np.sqrt((mix ** 2).mean())))
