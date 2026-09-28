# Loud-and-clear mix: voice at a fixed target level, music envelope-ducked ~11 dB while anyone speaks.
import subprocess, numpy as np, sys
SR=48000
def rd(f,ch=2):
    x=np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-ac',str(ch),'-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout,np.float32)
    return x.reshape(-1,ch).copy()
def smooth(x,att,rel):
    y=np.zeros_like(x);a=np.exp(-1/(att*SR));r=np.exp(-1/(rel*SR));p=0.0
    for i in range(0,len(x),64):
        v=x[i:i+64].max(); c=a if v>p else r; p=c*p+(1-c)*v; y[i:i+64]=p
    return y
# voice chain: highpass + compression + presence, then normalise speech RMS to -15 dBFS
subprocess.run(['ffmpeg','-y','-loglevel','error','-i','vo_track.wav','-af','highpass=f=90,acompressor=threshold=-24dB:ratio=3.5:attack=4:release=110:makeup=2,equalizer=f=3200:t=q:w=1:g=2.5','-ar',str(SR),'vo_proc.wav'],check=True)
v=rd('vo_proc.wav')
mono=np.abs(v).mean(1); speech=mono>0.01
rms=np.sqrt(np.mean(v[speech]**2)); v*=10**(-15/20)/rms
gate=smooth((smooth(mono,0.005,0.05)>0.01).astype(np.float32),0.06,0.45)
duck=1-0.72*gate                     # ~ -11 dB under the voice
for bed,out in [('launch_audio.wav','mix_60.wav'),('launch_audio_trap.wav','mix_60_trap.wav'),('launch_audio_house.wav','mix_60_house.wav')]:
    b=rd('../maro2/'+bed); n=min(len(b),len(v),60*SR)
    m=b[:n]*duck[:n,None]+v[:n]
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-af','alimiter=limit=0.93:attack=3:release=60','-c:a','pcm_s16le',out],input=m.astype(np.float32).tobytes(),check=True)
    db=lambda x:20*np.log10(np.sqrt(np.mean(x**2))+1e-9)
    s,t=int(48.1*SR),int(53*SR); print(out,'voice',round(db(v[s:t]),1),'music',round(db(b[s:t]*duck[s:t,None]),1))
