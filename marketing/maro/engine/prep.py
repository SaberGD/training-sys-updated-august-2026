"""Prepare MARO sprites for maro.html from ../assets/maro.

Makes the body fully opaque, finds the visor (-> *_vmask.png plus visors.js/json)
and locates the feet for the thrusters. Run from this folder: python3 prep.py
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = '../assets/maro/'
NAMES = ['M1_maro_standing_front', 'M2_maro_waving', 'M3_maro_thinking',
         'M4_maro_presenting', 'M5_maro_head_closeup']

info = {}
for n in NAMES:
    im = np.array(Image.open(SRC + n + '.png').convert('RGBA')).astype(np.int32)
    a = im[..., 3]
    im[..., 3] = np.where(a >= 200, 255, np.where(a < 8, 0, a))  # generator left the body ~99% opaque
    Image.fromarray(im.astype(np.uint8)).save(n + '.png')
    alpha = im[..., 3]

    # visor = largest dark blob in the upper part of the sprite
    dark = (im[..., :3].max(-1) < 60) & (alpha == 255)
    lab, nl = ndimage.label(dark)
    sizes = ndimage.sum(dark, lab, range(1, nl + 1))
    best = next(i + 1 for i in np.argsort(-sizes)
                if np.where(lab == i + 1)[0].mean() < im.shape[0] * 0.6 and sizes[i] > 20000)
    m = ndimage.binary_erosion(ndimage.binary_fill_holes(lab == best), iterations=6)
    m = ndimage.binary_opening(m, structure=ndimage.generate_binary_structure(2, 1), iterations=28)
    lab, _ = ndimage.label(m)
    m = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    ys, xs = np.where(m)
    v = dict(x0=int(xs.min()), y0=int(ys.min()), x1=int(xs.max()), y1=int(ys.max()),
             cx=round(float(xs.mean()), 1), cy=round(float(ys.mean()), 1))
    crop = (m[v['y0']:v['y1'] + 1, v['x0']:v['x1'] + 1] * 255).astype(np.uint8)
    white = np.full(crop.shape, 255, np.uint8)
    Image.fromarray(np.dstack([white, white, white, crop])).save(n + '_vmask.png')

    # feet = column clusters in the bottom 45px of the silhouette
    solid = alpha > 128
    yb = int(np.where(solid.any(1))[0].max())
    cols = np.where(solid[yb - 45:yb + 1].any(0))[0]
    groups = np.split(cols, np.where(np.diff(cols) > 25)[0] + 1)
    v['feet'] = [[int(g.mean()), yb] for g in groups if len(g) > 40]
    v['bottom'] = yb
    info[n] = v
    print(n, v)

json.dump(info, open('visors.json', 'w'), indent=1)
open('visors.js', 'w').write('window.VIS=' + json.dumps(info) + ';')
