# Music-only and SFX-only stems for flow_audio.py, same gain and fades as the full mix.
import numpy as np
from scipy.io import wavfile
from sfxlib import filt
src = open('flow_audio.py').read()
def render(keep):
    s = src.replace("add = L.add", f"_add0 = L.add\ndef add(buf, *a, **k):\n    if buf is {'sfx' if keep == 'music' else 'music'}: return\n    return _add0(buf, *a, **k)")
    s = s[:s.index("if __name__ == '__main__' or True:")] + "np.save('flow_stem_%s.npy', mix)\n" % keep
    exec(compile(s, 'flow_audio.py', 'exec'), {'__name__': 'stem'})
    return np.load('flow_stem_%s.npy' % keep)
m, x = render('music'), render('sfx')
SR = 44100
def post(a):
    a = filt(a, 'highpass', 30); fi = int(0.8 * SR); a[:fi] *= np.linspace(0, 1, fi)[:, None]; fo = int(0.5 * SR); a[-fo:] *= np.linspace(1, 0, fo)[:, None]; return a
full = post(m + x); g = 0.88 / np.abs(np.tanh(full * 1.2) / np.tanh(1.2)).max()
for name, a in (('music', m), ('sfx', x)):
    wavfile.write(f'flow_audio_{name}.wav', SR, (np.clip(post(a) * g, -0.99, 0.99) * 32767).astype(np.int16))
print('stems ok')
