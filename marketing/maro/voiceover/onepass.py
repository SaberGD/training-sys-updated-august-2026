# Generates the whole script in ONE request (consistent voice/tone across all paragraphs),
# then splits it into per-paragraph clips using the character timestamps, so solo.py fit can place them.
# usage: VOICE=... MODEL=eleven_v4 TAG=dir python3 onepass.py
import os, re, json, base64, subprocess, urllib.request
from solo import SCRIPT
K = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.xi')).read().strip()
VOICE, MODEL, TAG = os.environ['VOICE'], os.environ.get('MODEL', 'eleven_v4'), os.environ['TAG']
SPEED = float(os.environ.get('SPEED', '1.0'))
os.makedirs(TAG, exist_ok=True)
strip = lambda s: re.sub(r'\[[^\]]*\]\s*', '', s).strip()
parts = [strip(t) for _, _, t in SCRIPT]
sep = '\n\n'
full = sep.join(parts)
starts, pos = [], 0
for p in parts: starts.append(pos); pos += len(p) + len(sep)
body = {'text': full, 'model_id': MODEL, 'language_code': 'ar',
        'voice_settings': {'stability': float(os.environ.get('STAB', '0.5')), 'similarity_boost': 0.85, 'speed': SPEED}}
req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128',
                             data=json.dumps(body).encode(), headers={'xi-api-key': K, 'Content-Type': 'application/json'})
d = json.loads(urllib.request.urlopen(req, timeout=300).read())
open(f'{TAG}/full.mp3', 'wb').write(base64.b64decode(d['audio_base64']))
al = d.get('normalized_alignment') or d['alignment']
chars, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
text = ''.join(chars)
# map each paragraph to [start of its first char, end of its last char]; tolerate normalisation by searching
bounds, cursor = [], 0
for p in parts:
    head, tail = p[:12], p[-6:]
    i = text.find(head, cursor)
    if i < 0: i = cursor
    j = text.find(tail, i); j = (j + len(tail) - 1) if j >= 0 else min(len(chars) - 1, i + len(p) - 1)
    bounds.append((st[i], en[j])); cursor = j + 1
total = float(subprocess.run(['ffmpeg', '-i', f'{TAG}/full.mp3', '-f', 'null', '-'], capture_output=True, text=True).stderr.split('time=')[-1][:11].split(':')[-1]) \
    if False else None
for k, (a, b) in enumerate(bounds, 1):
    a0 = max(0.0, a - 0.06); b1 = b + 0.12
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{a0:.3f}', '-to', f'{b1:.3f}', '-i', f'{TAG}/full.mp3',
                    '-c:a', 'libmp3lame', '-b:a', '128k', f'{TAG}/{k:02d}.mp3'], check=True)
    print(f'part {k}: {a:.2f}-{b:.2f}s ({b - a:.2f}s)')
print('full length', round(max(e for _, e in bounds), 2), 's')
