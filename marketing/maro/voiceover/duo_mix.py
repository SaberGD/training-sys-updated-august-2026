# Places every voice clip in its scene slot, speeds up (pitch-safe atempo) only what overflows,
# then ducks the music bed under the voice. Output: vo_track.wav (voice only) + mix_60.wav.
import subprocess, json, os, numpy as np
from duo_gen import SCRIPT
SR = 44100; GAP = 0.12; MAXT = 1.25
def load(path, tempo=1.0):
    af = f'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
    if tempo > 1.0: af += f',atempo={tempo:.4f}'
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-af', af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
vo = np.zeros(int(61 * SR), np.float32); report = []
for i, (a, b, parts) in enumerate(SCRIPT, 1):
    clips = [load(f'duo/{i:02d}_{j}.mp3') for j in range(len(parts))]
    need = sum(len(c) for c in clips) / SR + GAP * (len(clips) - 1); slot = b - a
    tempo = min(MAXT, need / slot) if need > slot else 1.0
    if tempo > 1.0: clips = [load(f'duo/{i:02d}_{j}.mp3', tempo) for j in range(len(parts))]
    t = a
    for c in clips:
        s = int(t * SR); vo[s:s + len(c)] += c[:len(vo) - s]; t += len(c) / SR + GAP
    report.append((i, round(slot, 2), round(need, 2), round(tempo, 3), round(t - GAP - b, 2)))
for r in report: print('line %02d slot %.2f need %.2f tempo %.3f overflow %+.2f' % r)
vo *= 0.89 / max(1e-6, np.abs(vo).max())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-ac', '2', 'vo_track.wav'], input=vo.tobytes())
def mix(bed, out):
    # music ducks ~9 dB under the voice; voice gets light compression + presence
    fc = ('[1:a]highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,equalizer=f=3000:t=q:w=1:g=2,volume=1.35,asplit[v1][v2];'
          '[0:a][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350:makeup=1[duck];'
          '[duck][v2]amix=inputs=2:normalize=0,alimiter=limit=0.95[o]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', bed, '-i', 'vo_track.wav', '-filter_complex', fc, '-map', '[o]', '-t', '60', '-ar', '48000', out], check=True)
if __name__ == '__main__':
    import sys
    M = '../maro2/'
    for bed, out in [('launch_audio.wav', 'mix_60.wav'), ('launch_audio_trap.wav', 'mix_60_trap.wav'), ('launch_audio_house.wav', 'mix_60_house.wav')]:
        mix(M + bed, out); print('mixed', out)
