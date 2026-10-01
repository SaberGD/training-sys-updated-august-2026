"""Talking-head montage (9:16, 60fps): Mohamed's graded footage + full-screen inserts from the AI motion reel (same voice, same timeline)
+ transparent overlay layer (ovl/), jump-cut zooms, punch-in and light flash on every cut. usage: python3 montage.py [test t1 t2 ...]"""
import numpy as np, cv2, subprocess, os, sys, math
W, H, FPS, DUR = 1080, 1920, 60, 46.5
BW, BH = 1620, 2880                                   # footage decoded at 1.5x for zoom headroom
SRC, ANIM, OVL = '../montage/after_coloring.mp4', 'ai-reel-46s-9x16.mp4', 'ovl'
EDL = [('A',0,3.55),('F',3.55,7.4),('A',7.4,9.24),('F',9.24,11.3),('A',11.3,16.36),('F',16.36,18.2),('A',18.2,20.1),('F',20.1,21.4),('A',21.4,22.8),('F',22.8,23.5),('A',23.5,25.2),
       ('F',25.2,28.9),('A',28.9,32.05),('F',32.05,34.2),('A',34.2,37.75),('F',37.75,39.3),('A',39.3,40.85),('F',40.85,45.2),('A',45.2,46.5)]
ZK = [(0,1,1,3.55,.45),(3.55,1.0,1.06,5.25,.45),(5.25,1.3,1.36,7.4,.40),(9.24,1.2,1.28,11.3,.40),(16.36,1.0,1.06,18.2,.45),(20.1,1.3,1.35,21.4,.40),(22.8,1.15,1.2,23.5,.40),
      (25.2,1.0,1.05,26.72,.45),(26.72,1.3,1.36,28.9,.40),(32.05,1.15,1.3,34.2,.40),(37.75,1.0,1.08,39.3,.45),(40.85,1.0,1.06,45.2,.45)]
CUTS = sorted({s[1] for s in EDL[1:]} | {z[0] for z in ZK if z[0] > 0})
def seg(t): return next((s for s in EDL if s[1] <= t < s[2]), EDL[-1])
def zoom(t):
    z = max((k for k in ZK if k[0] <= t), key=lambda k: k[0]); p = min(1, max(0, (t - z[0]) / (z[3] - z[0])))
    return z[1] + (z[2] - z[1]) * (p * p * (3 - 2 * p)), z[4], z[0]
def reader(cmd, w, h):
    pr = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=10**8); n = w * h * 3
    def nxt():
        b = pr.stdout.read(n); return None if len(b) < n else np.frombuffer(b, np.uint8).reshape(h, w, 3)
    return nxt
yy, xx = np.mgrid[0:H, 0:W]; vig = (1 - 0.32 * np.clip(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.7)) ** 2, 0, 1)).astype(np.float32)[..., None]
def frame_F(img, t):
    z, cy, z0 = zoom(t); z *= 1 + 0.07 * math.exp(-(t - z0) * 14)
    cw, ch = BW / z, BH / z; cx0 = BW / 2 - cw / 2; cy0 = min(max(cy * BH - ch / 2, 0), BH - ch)
    M = np.float32([[W / cw, 0, -cx0 * W / cw], [0, H / ch, -cy0 * H / ch]])
    out = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_AREA if z < 1.5 else cv2.INTER_LINEAR)
    return (out.astype(np.float32) * vig).clip(0, 255)
def frame_A(img, t):
    s = seg(t); k = 1 + 0.06 * math.exp(-(t - s[1]) * 14)
    if k > 1.001: img = cv2.warpAffine(img, np.float32([[k, 0, W / 2 * (1 - k)], [0, k, H / 2 * (1 - k)]]), (W, H), flags=cv2.INTER_LINEAR)
    return img.astype(np.float32)
def composite(f, fr_f, fr_a):
    t = f / FPS; s = seg(t)
    out = frame_F(fr_f, t) if s[0] == 'F' else frame_A(fr_a, t)
    p = os.path.join(OVL, f'o_{f:05d}.png')
    if s[0] == 'F' and os.path.exists(p):
        o = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        if o is not None and o.shape[2] == 4:
            a = o[..., 3:4].astype(np.float32) / 255; out = out * (1 - a) + o[..., 2::-1].astype(np.float32) * a
    for c in CUTS:
        d = t - c
        if -0.05 < d < 0.15:
            a = (1 - abs(d) / (0.05 if d < 0 else 0.15)) * (0.55 if any(abs(c - e[1]) < 1e-6 for e in EDL) else 0.22)
            out = out * (1 - a) + np.array([255, 205, 160], np.float32) * a
    return out.clip(0, 255).astype(np.uint8)
def main(test=None):
    rf = reader(['ffmpeg', '-loglevel', 'error', '-i', SRC, '-vf', f'scale={BW}:{BH}:flags=lanczos,format=rgb24', '-f', 'rawvideo', '-'], BW, BH)
    ra = reader(['ffmpeg', '-loglevel', 'error', '-i', ANIM, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], W, H)
    nF = int(DUR * FPS); fi = -1; cf = None; ca = None; lastf = None
    enc = None if test else subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', 'ai_audio.wav',
        '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'montage-46s-9x16.mp4'], stdin=subprocess.PIPE)
    want = set(round(x * FPS) for x in test) if test else None
    for f in range(nF):
        t = f / FPS; need = min(int(t * 30 + 1e-6), 1363)
        while fi < need:
            nx = rf()
            if nx is None: break
            cf = nx; fi += 1
        nxa = ra(); ca = nxa if nxa is not None else ca
        if want is not None:
            if f in want: cv2.imwrite(f'out/mt_{t:.2f}.jpg', cv2.cvtColor(composite(f, cf, ca), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
            if f > max(want): break
            continue
        enc.stdin.write(composite(f, cf, ca).tobytes())
        if f % 300 == 0: print('frame', f, flush=True)
    if enc: enc.stdin.close(); enc.wait()
    print('DONE')
if __name__ == '__main__':
    main([float(x) for x in sys.argv[2:]] if len(sys.argv) > 1 and sys.argv[1] == 'test' else None)
