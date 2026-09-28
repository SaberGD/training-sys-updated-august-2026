# Narrated voice-over (one narrator) for the MARO launch, fitted to the 60s timeline.
# usage: python3 solo.py gen [files...] | fit
import sys, subprocess, numpy as np
from concurrent.futures import ThreadPoolExecutor
import el
import os
VOICE = os.environ.get('VOICE', 'cgSgspJ2msm6clMCkdW9')  # default Jessica
TAG = os.environ.get('TAG', 'solo')
# (slot_start, slot_end, text): slots follow the scenes; a paragraph may span two scenes
SCRIPT = [
 (0.05, 4.2, 'دي سارة.. عَنْدَها تَسْليم الصُّبْح، ودماغها فاصْلَة خالِص.. ومَفيش وَلا فِكْرَة!'),
 (4.3, 9.3, '[excited] ودَه مارو.. مُساعِدْها الذَّكي مِن صابر جروب، وجاي يِنْقِذ المَوْقِف!'),
 (9.5, 18.3, 'سارة كان عَنْدَها كامْبين لـ Vezeeta، فمارو دَخَل ساعِدْها يِطَلَّعوا الفِكْرَة الصَّح مِن الصِّفْر، وجَهِّزْلَها بْريف إعْلاني احْتِرافي يِحُطَّها عَلى أوِّل الطَّريق.'),
 (18.5, 26.7, 'ولِأن فِكْرِتْها كانِت مِحْتاجَة صُوَر قَوِيَّة، مارو كَتَبْلَها برومبت احْتِرافي ومَظْبوط بالمِلّي، تاخْدُه وتْطَلَّع بيه أحْسَن صُوَر تِساعِدْها في شُغْلَها.'),
 (26.9, 36.9, 'وأوِّل ما خلصِتْ، عَرَضِت التَّصْميم عَلى مارو.. قيّمهولها، وحَلِّل الـ Palette بِتاعِة الألْوان والتَّكْوين، وقالْها عَلى التْريكات اللي تْطَلَّعُه بيرفكت.. ومَفيهوش وَلا غَلْطَة!'),
 (37.1, 47.9, 'سارة مِش لِوَحْدَها في السَّهْرَة.. مارو صاحي مَعاها أرْبَعَة وعِشْرين ساعَة بيرُد عَلى أي سُؤال، وهَيِفْضَل مُدَرِّبْها الشَّخْصي لِحَد ما تْسَلِّم مَشْروع تَخَرُّجْها وتِكَسَّر الدِّنْيا!'),
 (48.1, 53.5, '[excited] صابر جروب هو المَكان الوَحيد اللي بيْقَدِّمْلَك مُساعِد ذَكي شَخْصي، بيْكَمِّل مَعاك المِشْوار.'),
 (53.7, 59.95, '[excited] عايِز تِنْجِز زَي سارة؟ احْجِز تَجْرُبْتَك المجانية مَعَ مارو، واسْتَفيد بِخَصْم إضافي رُبْعُمِيت جِنيه عَلى أي كورس في صابر جروب.. مَعاك عَلى طول!'),
]
# SHIFT: the opening scene is stretched by SHIFT seconds (video re-rendered with ?tm=4+SHIFT); every later slot moves with it
SHIFT = float(os.environ.get('SHIFT', '0'))
if SHIFT:
    SCRIPT = [(a, b + SHIFT, t) if i == 0 else (a + SHIFT, b + SHIFT, t) for i, (a, b, t) in enumerate(SCRIPT)]
BED = os.environ.get('BED', '../maro2/launch_audio.wav')
SR = 48000; MAXT = 1.3
def clip(i): return f'{TAG}/{i:02d}.mp3'
def load(path, tempo=1.0):
    af = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-58dB,areverse,apad=pad_dur=0.08'
    if tempo > 1.0: af += f',atempo={tempo:.4f}'
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-af', af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def rd(f, ch=2):
    x = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    return x.reshape(-1, ch).copy()
def smooth(x, att, rel):
    y = np.zeros_like(x); a = np.exp(-1 / (att * SR)); r = np.exp(-1 / (rel * SR)); p = 0.0
    for i in range(0, len(x), 64):
        v = x[i:i + 64].max(); c = a if v > p else r; p = c * p + (1 - c) * v; y[i:i + 64] = p
    return y
def plan(T, need, GAP=0.2, LEAD=2.6, END=None):
    END = END if END is not None else 59.8 + SHIFT
    d = [n / T for n in need]; L = [0] * len(d); L[-1] = END - d[-1]
    for i in range(len(d) - 2, -1, -1): L[i] = L[i + 1] - GAP - d[i]      # latest start that keeps the rest fitting
    t = None; starts = []; ok = True
    for i, (a, b, _) in enumerate(SCRIPT):
        st = min(a, L[i]); st = max(st, (t + GAP) if t is not None else a)
        if st < a - LEAD or st > L[i] + 1e-6: ok = False
        starts.append(st); t = st + d[i]
    return starts, ok
def fit():
    raw = [load(clip(i)) for i in range(1, len(SCRIPT) + 1)]; need = [len(c) / SR for c in raw]
    T = float(os.environ.get('MINT', '1.0'))
    while not plan(T, need)[1] and T < 1.7: T += 0.005
    starts, ok = plan(T, need); print('uniform tempo %.3f fits=%s' % (T, ok))
    vo = np.zeros(int((61 + SHIFT) * SR), np.float32)
    for i, (st, (a, b, _)) in enumerate(zip(starts, SCRIPT), 1):
        c = load(clip(i), T) if T > 1.0 else raw[i - 1]
        s = int(st * SR); vo[s:s + len(c)] += c[:len(vo) - s]
        print('part %d scene %.1f starts %.2f ends %.2f (scene ends %.1f)' % (i, a, st, st + len(c) / SR, b))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-af', 'highpass=f=90,acompressor=threshold=-24dB:ratio=3.5:attack=4:release=110:makeup=2,equalizer=f=3200:t=q:w=1:g=2.5',
                    f'{TAG}_vo.wav'], input=vo.tobytes(), check=True)
    v = rd(f'{TAG}_vo.wav'); mono = np.abs(v).mean(1); sp = mono > 0.01
    v *= 10 ** (-15 / 20) / np.sqrt(np.mean(v[sp] ** 2))
    duck = 1 - 0.72 * smooth((smooth(mono, 0.005, 0.05) > 0.01).astype(np.float32), 0.06, 0.45)
    b = rd(BED); n = min(len(b), len(v), int((60 + SHIFT) * SR))
    m = b[:n] * duck[:n, None] + v[:n]
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', 'alimiter=limit=0.93:attack=3:release=60', '-c:a', 'pcm_s16le', f'{TAG}_mix.wav'],
                   input=m.astype(np.float32).tobytes(), check=True)
    print('mixed', TAG)
if __name__ == '__main__':
    if sys.argv[1] == 'edge':      # Microsoft Egyptian neural voices (no performance tags)
        import re, asyncio, certifi
        certifi.where = lambda: '/root/.ccr/ca-bundle.crt'
        import edge_tts
        async def run():
            for i, (_, _, t) in enumerate(SCRIPT, 1):
                t = re.sub(r'\[[a-z ]+\]\s*', '', t)
                await edge_tts.Communicate(t, VOICE, rate=os.environ.get('RATE', '+8%')).save(clip(i))
        asyncio.run(run()); print('edge ok')
    elif sys.argv[1] == 'gen':
        jobs = [(t, clip(i)) for i, (_, _, t) in enumerate(SCRIPT, 1)]
        only = set(sys.argv[2:])
        if only: jobs = [j for j in jobs if j[1] in only]
        print(len(jobs), 'clips', sum(len(t) for t, _ in jobs), 'chars')
        with ThreadPoolExecutor(2) as ex: print(list(ex.map(lambda j: el.tts(VOICE, j[0], j[1], stab=float(os.environ.get('STAB', '0.5'))), jobs)))
    else: fit()
