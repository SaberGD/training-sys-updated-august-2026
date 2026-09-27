"""Alternative music beds. bed(style, dur, start, end, breaks, drop) -> stereo float array.
styles: 'trap' (cinematic trap, 140 BPM half-time) | 'house' (uplifting house, 124 BPM)."""
import numpy as np
import sfxlib as L
from sfxlib import tt, filt, kick, hat, clap, saw, rng, SR

def _add(buf, sig, t0, g=1.0, pan=0.0):
    if sig.ndim == 1:
        sig = np.stack([sig * np.sqrt((1 - pan) / 2) * 1.414, sig * np.sqrt((1 + pan) / 2) * 1.414], 1)
    i = int(t0 * SR)
    if i >= len(buf) or i < 0: return
    j = min(len(buf), i + len(sig)); buf[i:j] += sig[:j - i] * g

def _in_break(t, breaks):
    return any(a <= t < b for a, b in breaks)

def bass808(freq, dur, glide_to=None, g=1.0):
    t = tt(dur)
    f = np.full(len(t), freq) if glide_to is None else freq + (glide_to - freq) * np.clip((t - dur * 0.55) / (dur * 0.3), 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.25 * np.sin(2 * ph)
    env = np.minimum(1, t / 0.005) * np.exp(-t * 1.2) * np.minimum(1, (dur - t) / 0.03)
    click = np.sin(2 * np.pi * np.cumsum(90 + 300 * np.exp(-t * 60)) / SR) * np.exp(-t * 40) * 0.6
    return np.tanh((s * env + click) * 1.8) * 0.6 * g

def snare_trap(g=1.0):
    t = tt(0.35)
    n = filt(rng.standard_normal(len(t)), 'bandpass', [1500, 8000]) * np.exp(-t * 18)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.6
    return (n + body) * g

def pluck(freq, dur=0.3, g=1.0):
    t = tt(dur)
    s = saw(freq, t) * 0.6 + np.sin(2 * np.pi * freq * 2 * t) * 0.3
    return filt(s * np.exp(-t * 11), 'lowpass', 3200) * g

def piano(freqs, dur=0.5, g=1.0):
    t = tt(dur)
    s = sum(np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 9) for f in freqs)
    return s * np.exp(-t * 3.2) * np.minimum(1, t / 0.004) * g / len(freqs)

def bed(style, dur, start, end, breaks=(), drop=None):
    N = int(dur * SR); m = np.zeros((N, 2))
    if style == 'trap':
        BPM = 140; B = 60 / BPM; BAR = 4 * B
        roots = [55.0, 43.65, 49.0, 41.2]           # A1 F1 G1 E1  (A minor, dark)
        chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (196.0, 246.94, 293.66), (164.81, 207.65, 246.94)]
        nb = int((end - start) / B)
        for i in range(nb):
            tb = start + i * B
            if _in_break(tb, breaks): continue
            beat = i % 4; bar = i // 4
            if beat == 0 or (beat == 2 and bar % 2 == 1 and False): _add(m, kick(0.9), tb)
            if beat == 2: _add(m, snare_trap(0.5), tb); _add(m, clap(0.25), tb)
            if beat == 3 and bar % 2 == 0: _add(m, kick(0.7), tb + B / 2)
            # hats: 1/8 with 1/32 rolls on the last beat of every other bar
            if beat == 3 and bar % 2 == 1:
                for k in range(8): _add(m, hat(0.09 + 0.02 * k), tb + k * B / 8, pan=0.25)
            else:
                for k in range(2): _add(m, hat(0.12 if k else 0.08), tb + k * B / 2, pan=0.25)
            if beat == 0:                             # 808 per bar with a glide into the next root
                r = roots[bar % 4]; nxt = roots[(bar + 1) % 4]
                _add(m, bass808(r, BAR * 0.95, glide_to=nxt), tb, 0.8)
                ch = chords[bar % 4]; tq = tt(BAR)
                pad = sum(saw(f, tq, -0.004) + saw(f, tq, 0.004) for f in ch)
                fade = np.minimum(1, tq / 0.2) * np.minimum(1, (BAR - tq) / 0.2)
                _add(m, filt(pad * fade, 'lowpass', 1100) * 0.035, tb)
                # sparse bell melody
                for k, st in enumerate((0, 1.5, 2.5)):
                    f = ch[(k + bar) % 3] * 2; t2 = tt(0.6)
                    _add(m, np.sin(2 * np.pi * f * t2) * np.exp(-t2 * 5) * 0.05, tb + st * B, pan=0.3 * (1 if k % 2 else -1))
    elif style == 'house':
        BPM = 124; B = 60 / BPM; BAR = 4 * B
        roots = [55.0, 73.42, 61.74, 49.0]          # A D B G  (uplifting)
        chords = [(220.0, 277.18, 329.63, 415.3), (293.66, 369.99, 440.0, 554.37), (246.94, 311.13, 369.99, 466.16), (196.0, 246.94, 293.66, 369.99)]
        nb = int((end - start) / B)
        for i in range(nb):
            tb = start + i * B
            if _in_break(tb, breaks): continue
            beat = i % 4; bar = i // 4; ch = chords[bar % 4]; r = roots[bar % 4]
            _add(m, kick(0.85), tb)
            _add(m, hat(0.2, open_=True), tb + B / 2, pan=0.2)
            _add(m, hat(0.06), tb + B / 4, pan=-0.3); _add(m, hat(0.06), tb + 3 * B / 4, pan=-0.3)
            if beat in (1, 3): _add(m, clap(0.3), tb)
            tq = tt(B / 2 - 0.02)                    # off-beat bass
            _add(m, filt((saw(r * 2, tq) + np.sin(2 * np.pi * r * 2 * tq)) * np.exp(-tq * 5), 'lowpass', 600) * 0.22, tb + B / 2)
            if beat in (0, 2) or (beat == 3 and bar % 2): _add(m, piano(ch, 0.45, 0.22), tb + (B / 2 if beat == 3 else 0), pan=0.1)
            for k in range(2):                       # pluck arp 1/8
                _add(m, pluck(ch[(i * 2 + k) % 4] * 2, 0.25, 0.05), tb + k * B / 2, pan=(-0.4 if k else 0.4))
    # side-chain feel: gentle ducking already implied by kick transients; soften highs
    m = filt(m, 'highpass', 28)
    if drop:  # short riser into the drop
        a, b = drop; t = tt(b - a); n = filt(rng.standard_normal(len(t)), 'highpass', 1500) * (t / (b - a)) ** 2 * 0.25
        _add(m, n, a)
    return m
