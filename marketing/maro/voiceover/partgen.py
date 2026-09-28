# Generates each paragraph separately (own request) with previous/next text as context so the delivery stays continuous.
# usage: VOICE=... MODEL=eleven_v4 TAG=dir python3 partgen.py [01 05 ...]
import os, re, sys, json, urllib.request
from solo import SCRIPT
K = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.xi')).read().strip()
VOICE, MODEL, TAG = os.environ['VOICE'], os.environ.get('MODEL', 'eleven_v4'), os.environ['TAG']
os.makedirs(TAG, exist_ok=True)
strip = lambda s: re.sub(r'\[[^\]]*\]\s*', '', s).strip()
parts = [strip(t) for _, _, t in SCRIPT]
only = set(sys.argv[1:])
for i, p in enumerate(parts):
    name = f'{i + 1:02d}'
    if only and name not in only: continue
    body = {'text': p, 'model_id': MODEL, 'language_code': 'ar',
            'voice_settings': {'stability': float(os.environ.get('STAB', '0.5')), 'similarity_boost': 0.85}}
    if i > 0: body['previous_text'] = parts[i - 1]
    if i < len(parts) - 1: body['next_text'] = parts[i + 1]
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
                                 data=json.dumps(body).encode(), headers={'xi-api-key': K, 'Content-Type': 'application/json'})
    try:
        open(f'{TAG}/{name}.mp3', 'wb').write(urllib.request.urlopen(req, timeout=180).read()); print('ok', name)
    except urllib.error.HTTPError as e:
        print(name, e.code, e.read()[:200])
