"""Synthesized score + SFX for the 30s SABER GROUP reel. 120 BPM, events synced to reel.html."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
DUR = 8.0
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


