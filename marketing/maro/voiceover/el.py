import sys,json,os,urllib.request
K=os.environ.get('XI') or open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'.xi')).read().strip()
def tts(voice,text,out,model='eleven_v3',stab=0.5,lang='ar'):
    body={'text':text,'model_id':model,'voice_settings':{'stability':stab,'similarity_boost':0.8}}
    if lang: body['language_code']=lang
    r=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',data=json.dumps(body).encode(),headers={'xi-api-key':K,'Content-Type':'application/json'})
    try:
        open(out,'wb').write(urllib.request.urlopen(r,timeout=120).read());return True
    except urllib.error.HTTPError as e:print(out,e.code,e.read()[:300]);return False
if __name__=='__main__':
    tts(sys.argv[1],sys.argv[2],sys.argv[3],*(sys.argv[4:5] or []))
