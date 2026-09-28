# Exports separate MUSIC / SFX / VOCAL stems for the V3 61.6 s cut (opening stretched to 5.6 s).
# Music and SFX are re-synthesised from launch_audio.py with the other bus muted, so nothing bleeds between stems.
import os, subprocess, numpy as np
from scipy.io import wavfile
SR = 44100
src = open('launch_audio.py').read()
def render(keep):
    s = src.replace("add = L.add", f"_add0 = L.add\ndef add(buf, *a, **k):\n    if buf is {'sfx' if keep == 'music' else 'music'}: return\n    return _add0(buf, *a, **k)")
    s = s.replace("wavfile.write('launch_audio' + (f'_{MUSIC}' if MUSIC else '') + '.wav', SR, (mix * 32767).astype(np.int16))",
                  f"np.save('stem_{keep}_lin.npy', music * 0.8 + sfx + wet * 0.5)")
    g = {'__name__': 'stem'}; exec(compile(s, 'launch_audio.py', 'exec'), g)
render('music'); render('sfx')
m, x = np.load('stem_music_lin.npy'), np.load('stem_sfx_lin.npy')
full = m + x
scale = 0.89 / np.abs(np.tanh(full * 1.2) / np.tanh(1.2)).max()      # same loudness as the delivered mix, kept linear so stems stay clean
_orig = wavfile.read('launch_audio.wav')[1]; _ext = wavfile.read('launch_audio_ext16.wav')[1]
INTRO_N = len(_ext) - (len(_orig) - int(4.0 * SR))       # intro length the delivered bed ended up with
def write(name, a):
    a = np.clip(a * scale, -0.99, 0.99); wavfile.write(f'_{name}.wav', SR, (a * 32767).astype(np.int16))
    # stretch the opening 4 s to exactly the same sample length the delivered V3 bed uses, so stems line up sample-accurately
    intro = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'_{name}.wav', '-af', 'atrim=0:4.0,asetpts=PTS-STARTPTS,atempo=0.7142857',
                            '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    intro = np.frombuffer(intro, np.float32).reshape(-1, 2)
    fixed = np.zeros((INTRO_N, 2), np.float32); k = min(INTRO_N, len(intro)); fixed[:k] = intro[:k]
    body = a[int(4.0 * SR):].astype(np.float32)
    y = np.concatenate([fixed, np.clip(body * scale, -0.99, 0.99)])
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', f'stems/MARO-V3-{name}.wav'],
                   input=y.astype(np.float32).tobytes(), check=True)
os.makedirs('stems', exist_ok=True)
write('music', m); write('sfx', x)
# vocal: same processing + level as in the V3 mix
v = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '../vo/v3mix_vo.wav', '-ac', '2', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout
v = np.frombuffer(v, np.float32).reshape(-1, 2).copy(); mono = np.abs(v).mean(1); sp = mono > 0.01
v *= 10 ** (-15 / 20) / np.sqrt(np.mean(v[sp] ** 2)); v = v[:int(61.6 * 48000)]
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', '-', '-ar', str(SR), '-c:a', 'pcm_s24le', 'stems/MARO-V3-vocal.wav'],
               input=np.clip(v, -0.99, 0.99).astype(np.float32).tobytes(), check=True)
for f in sorted(os.listdir('stems')):
    d = subprocess.run(['ffmpeg', '-i', 'stems/' + f], capture_output=True, text=True).stderr.split('Duration: ')[1][:11]
    print(f, d)
