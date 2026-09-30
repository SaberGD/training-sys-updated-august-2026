# Music-only and SFX-only stems for the app promo: re-run app_audio.py with the other bus muted, same gain as the full mix.
import numpy as np
from scipy.io import wavfile
src = open('app_audio.py').read()
def render(keep):
    s = src.replace("add = L.add", f"_add0 = L.add\ndef add(buf, *a, **k):\n    if buf is {'sfx' if keep == 'music' else 'music'}: return\n    return _add0(buf, *a, **k)")
    s = s[:s.index("mix = filt(mix, 'highpass', 25)")] + "np.save('app_stem_%s.npy', mix)\n" % keep
    exec(compile(s, 'app_audio.py', 'exec'), {'__name__': 'stem'})
    return np.load('app_stem_%s.npy' % keep)
m, x = render('music'), render('sfx')
full = m + x; g = 0.9 / np.abs(np.tanh(full * 1.35) / np.tanh(1.35)).max()
SR = 44100; fo = int(0.4 * SR)
for name, a in (('music', m), ('sfx', x)):
    a = a * g; a[-fo:] *= np.linspace(1, 0, fo)[:, None]
    wavfile.write(f'app_audio_{name}.wav', SR, (np.clip(a, -0.99, 0.99) * 32767).astype(np.int16))
print('stems ok')
