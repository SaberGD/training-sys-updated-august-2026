"""Soundtrack for the 8s MARO style test. Uses the showreel SFX library plus MARO's signature sounds."""
from sfxlib import *
from scipy.io import wavfile

# ---------- MARO signature sounds ----------
def maro_chirp(g=1.0, up=True):
    """MARO's 'bi-bip' voice: two FM-sweetened tones with a little glide."""
    out = np.zeros(int(0.32 * SR))
    for k, (f0, f1, st) in enumerate(((880, 1046.5, 0.0), (1318.5, 1760, 0.11)) if up else ((1318.5, 1046.5, 0.0), (880, 784, 0.11))):
        t = tt(0.16)
        f = f0 + (f1 - f0) * (1 - np.exp(-t * 40))
        mod = np.sin(2 * np.pi * f * 2 * t) * 0.8 * np.exp(-t * 20)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR + mod) * np.exp(-t * 14) * np.minimum(1, t * 600)
        i = int(st * SR)
        out[i:i + len(s)] += s
    return out * g

def power_on(g=1.0):
    t = tt(0.5)
    f = 90 * (12 ** (t / 0.5))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / 0.5) ** 1.5 * np.exp(-np.maximum(0, t - 0.42) * 30)
    hum = np.sin(2 * np.pi * 50 * t) * 0.3 * (t / 0.5)
    return (s + hum) * g

def thruster(length, g=1.0):
    n = rng.standard_normal(int(length * SR))
    y = filt(n, 'bandpass', [70, 700], 2)
    t = tt(length)
    y *= (0.7 + 0.3 * np.sin(2 * np.pi * 13 * t)) * np.minimum(1, t / 0.2) * np.minimum(1, (length - t) / 0.15)
    return y / (np.abs(y).max() + 1e-9) * g

def rip(g=1.0):
    t = tt(0.55)
    n = rng.standard_normal(len(t))
    crackle = (rng.random(len(t)) > 0.985) * rng.standard_normal(len(t)) * 3
    y = sweep_lp(n + crackle, 400, 9000) * np.exp(-((t - 0.25) / 0.2) ** 2)
    return y / (np.abs(y).max() + 1e-9) * g

# ---------- music bed (110 BPM, A minor) ----------
BEAT = 60 / 110
pad = np.zeros((N, 2))
t_all = np.arange(N) / SR
chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (196.0, 246.94, 293.66)]
for ci, (s0, s1) in enumerate(((2.83, 4.95), (4.95, 6.0), (6.0, 8.0))):
    i0, i1 = int(s0 * SR), int(s1 * SR)
    t = t_all[i0:i1] - s0
    ch = chords[ci]
    sig = sum(saw(f, t, -0.004) + saw(f, t, 0.004) for f in ch)
    fade = np.minimum(1, t / 0.08) * np.minimum(1, (s1 - s0 - t) / 0.05)
    pad[i0:i1, 0] += sig * fade
    pad[i0:i1, 1] += sig * fade
pad = filt(pad, 'lowpass', 1600) * 0.05
# swell pad under the boot
t = tt(2.8)
drone = (np.sin(2 * np.pi * 55 * t) + 0.4 * np.sin(2 * np.pi * 110 * t)) * np.minimum(1, t / 1.5) * 0.28
add(music, drone, 0.0)
music += pad
# pulse: kicks + hats from the hero shot, full drop on the ring
kicks = [2.83 + i * BEAT for i in range(5)] + [6.0 + i * BEAT for i in range(4)]
for k in kicks:
    add(music, kick(0.85), k)
for i in range(int((8.0 - 3.1) / (BEAT / 2))):
    tb = 3.1 + i * BEAT / 2
    if i % 2:
        add(music, hat(0.18), tb, pan=0.3)
# bass on the ring
for i in range(8):
    tb = 6.0 + i * BEAT / 2
    t = tt(BEAT / 2 - 0.02)
    b = (saw(55, t) + np.sin(2 * np.pi * 55 * t)) * np.exp(-t * 4)
    add(music, filt(b, 'lowpass', 380) * 0.28, tb)

# ---------- sound design ----------
add(sfx, rip(0.7), 0.05, pan=0.0)                         # the orange wall tears open
add(sfx, whoosh(0.7, 0.35), 0.1)
add(sfx, power_on(0.5), 0.5)                              # visor powers on
add(sfx, glitch(0.3, 0.35), 0.8, pan=-0.2)                # logo glitch in
add(sfx, glitch(0.25, 0.3), 1.6, pan=0.2)                 # logo glitch out
add(sfx, riser(0.3, 0.25, 900, 200), 1.85)                # logo collapses to a line
add(sfx, maro_chirp(0.55), 2.0, send=0.5)                 # eyes open: MARO says hi
add(sfx, bell([1318.5, 1975.5], 1.2, 0.12), 2.02, send=0.7)
add(sfx, click(0.35), 2.42)                               # blink
add(sfx, whoosh(0.5, 0.7), 2.52)                          # whip pan
add(sfx, impact(0.5), 2.83, send=0.3)
add(sfx, thruster(2.85, 0.16), 2.83, pan=-0.4)            # hovering
add(sfx, whoosh(0.55, 0.4, up=False), 3.15)               # 3D title swings in
add(sfx, impact(0.55), 3.45, send=0.4)
for k in range(8):                                        # cursor bars / type-on
    add(sfx, click(0.2), 4.2 + k * 0.06, pan=0.3)
add(sfx, bell([1567.98, 2093], 0.8, 0.08), 4.55, send=0.6)
add(sfx, maro_chirp(0.35, up=False), 4.3, send=0.4)       # wink
add(sfx, riser(0.5, 0.55, 150, 2400), 5.5, send=0.3)      # thrusters rev up and he launches
add(sfx, thruster(0.5, 0.45), 5.5)
add(sfx, boom(0.9, 1.8), 6.0, send=0.6)                   # burst
add(sfx, bell([523.25, 783.99, 1046.5], 1.8, 0.2), 6.0, send=0.8)
for i in range(8):                                        # tiles land and count 1..8
    add(sfx, pop(0.3, 700 + i * 110, 260), 6.02 + i * 0.07 + 0.25, pan=np.sin(i) * 0.6)
add(sfx, maro_chirp(0.5), 6.4, send=0.5)                  # MARO head pops in
add(sfx, maro_chirp(0.35, up=False), 7.35, send=0.4)      # wink

# ---------- mix ----------
ir_len = int(1.8 * SR)
ti = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len), rng.standard_normal(ir_len)], 1) * np.exp(-ti * 3.5)[:, None]
ir = filt(ir, 'lowpass', 6000)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = music * 0.8 + sfx + wet * 0.5
mix = filt(mix, 'highpass', 25)
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix[-int(0.25 * SR):] *= np.linspace(1, 0, int(0.25 * SR))[:, None]
mix = mix / np.abs(mix).max() * 0.89
wavfile.write('test_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok')
