"""Builds out/audio.wav: voice-over + synthesized music bed + light SFX.

The music is generated here (no licensed tracks): a minor-key pad that stays
dark and sparse for the "alone" intro, then a soft pulse comes in from the
turn (scene 3) and the bed ducks under the voice.
"""
import json
import subprocess

import numpy as np

SR = 48000
tl = json.load(open("timeline.json", encoding="utf-8"))
TOTAL = tl["total"] + 0.3
N = int(TOTAL * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
S = {s["id"]: s for s in tl["scenes"]}


def load(path):
    raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le",
                                   "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.float32).copy()


def place(buf, clip, start, gain=1.0):
    i = int(start * SR)
    j = min(N, i + len(clip))
    if i < N:
        buf[i:j] += clip[: j - i] * gain


def smooth(x, n):
    """Moving average via cumulative sum (O(N), unlike np.convolve with long kernels)."""
    c = np.cumsum(np.insert(x, 0, 0.0))
    y = (c[n:] - c[:-n]) / n
    pad_l = (len(x) - len(y)) // 2
    return np.pad(y, (pad_l, len(x) - len(y) - pad_l), mode="edge")


def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)


# ---------- voice-over ----------
vo = np.zeros(N, dtype=np.float32)
for s in tl["scenes"]:
    place(vo, load(f"vo/s{s['id']}.wav"), s["voStart"])
peak = np.max(np.abs(vo)) or 1
vo *= 0.89 / peak

# ---------- music: chord pad ----------
BPM = 96
beat = 60 / BPM
bar = beat * 4
# Am  F  C  G  (as MIDI triads, voiced around middle C)
CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]
pad = np.zeros(N)
turn = S[3]["start"]
nbars = int(TOTAL / bar) + 1
for b in range(nbars):
    st = b * bar
    seg = (t >= st) & (t < st + bar + 1.0)
    lt = t[seg] - st
    env = np.minimum(1, lt / 0.6) * np.exp(-np.maximum(0, lt - bar) * 3)
    chord = CHORDS[b % 4] if st >= turn else CHORDS[0]  # intro sits on one dark chord
    for k, m in enumerate(chord + [chord[0] - 12]):
        f = note(m)
        det = 1 + 0.003 * (k - 1.5)
        pad[seg] += env * (np.sin(2 * np.pi * f * det * t[seg]) + 0.3 * np.sin(2 * np.pi * 2 * f * t[seg])) / 4
# slow tremolo & lowpass-ish smoothing
pad *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.25 * t)
pad = smooth(pad, 24)

# ---------- music: pulse (kick + soft hat) from the turn onwards ----------
pulse = np.zeros(N)
klen = int(0.35 * SR)
kt = np.arange(klen) / SR
kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 9)
hlen = int(0.06 * SR)
hat = rng.standard_normal(hlen) * np.exp(-np.arange(hlen) / SR * 70)
hat = np.diff(hat, prepend=0)  # crude high-pass
end_music = tl["total"] - 2.5
b = 0
while b * beat < end_music:
    bt = b * beat
    if bt >= turn + 0.4:
        place(pulse, kick, bt, 0.55)
        place(pulse, hat, bt + beat / 2, 0.10)
    b += 1

music = pad * 0.30 + pulse
# intro is quieter, swell at the turn, fade out at the end
lvl = np.interp(t, [0, 1.5, turn - 0.5, turn, TOTAL - 4, TOTAL], [0, .55, .65, 1, 1, 0])
music *= lvl

# ---------- duck music under the voice ----------
win = int(0.05 * SR)
env = np.sqrt(smooth(vo.astype(float) ** 2, win))
env = smooth((env > 0.02).astype(float), int(0.25 * SR))
music *= 1 - 0.55 * np.clip(env, 0, 1)

# ---------- SFX ----------
sfx = np.zeros(N)


def whoosh(dur=0.7):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    y = np.convolve(x, np.ones(18) / 18, mode="same")
    return y * e


def ding(f=1320, dur=0.6):
    tt = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * f * tt) + .4 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 8)


for s in tl["scenes"][1:]:
    place(sfx, whoosh(), s["start"] - 0.35, 0.18)
# heartbeat in the hook
hb = np.arange(int(0.25 * SR)) / SR
beat_snd = np.sin(2 * np.pi * 55 * hb) * np.exp(-hb * 18)
for x in np.arange(0.2, S[1]["dur"], 0.9):
    place(sfx, beat_snd, x, 0.5)
    place(sfx, beat_snd, x + 0.22, 0.35)
# riser + impact at the turn
rn = int(1.2 * SR)
riser = rng.standard_normal(rn) * np.linspace(0, 1, rn) ** 2
place(sfx, np.convolve(riser, np.ones(10) / 10, mode="same"), turn - 1.2, 0.12)
place(sfx, kick, turn, 1.0)
# attendance confirmation + email
place(sfx, ding(990), S[5]["start"] + 0.85, 0.22)
place(sfx, whoosh(0.5), S[5]["start"] + 3.7, 0.15)
# evaluation rows
for i, s0 in enumerate([1.0, 1.9, 2.8, 3.7, 4.6]):
    place(sfx, ding(1180 + i * 90, 0.4), S[6]["start"] + s0 + .1, 0.14)
place(sfx, ding(880), S[6]["start"] + 11.45, 0.22)
# follow-up flag + recovery
place(sfx, ding(660, .5), S[7]["start"] + 3.35, 0.18)
place(sfx, ding(1320), S[7]["start"] + 11.4, 0.2)
# portal cards
for s0 in [3.2, 4.4, 5.5, 7.0, 8.6, 10.2]:
    place(sfx, whoosh(0.3), S[8]["start"] + s0, 0.10)
# certificate checks + celebration
for i in range(3):
    place(sfx, ding(1046 + i * 130, .5), S[9]["start"] + 1.8 + i * 1.6 + 1.21, 0.18)
place(sfx, kick, S[9]["start"] + 11.0, 0.8)
place(sfx, ding(1568, 1.0), S[9]["start"] + 11.1, 0.2)
# end logo impact
place(sfx, kick, S[10]["start"] + 7.2, 0.9)

mix = vo + music * 0.45 + sfx * 0.6
mix /= max(1.0, np.max(np.abs(mix)) / 0.97)
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
stereo = np.repeat(pcm[:, None], 2, axis=1)
import wave
import os
os.makedirs("out", exist_ok=True)
with wave.open("out/audio.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())
print("audio ok", round(TOTAL, 2), "s")
