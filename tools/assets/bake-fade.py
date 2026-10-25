#!/usr/bin/env python3
"""
Bake the "Ember on stone" global fade into colours and images.

The fade used to be a full-screen overlay (backdrop-filter + blend layers)
that the browser had to re-composite every frame. Its effect is a fixed
colour transform, so we apply it ahead of time instead:

    contrast(0.962) saturate(0.892) brightness(1.02) sepia(0.035)
    then lighten with rgb(38,34,40) at 35 %

Usage
    bake-fade.py color "#b03a3a"            -> prints the baked colour
    bake-fade.py image SRC DST             -> bakes one image (keeps alpha)
    bake-fade.py text FILE [FILE ...]      -> rewrites every #hex / rgb() / rgba()
                                              literal in the files IN PLACE

`text` is NOT idempotent: run it once, on un-baked sources. Original
images live in apps/frontend/design-src/ so they can be re-baked if the
fade is ever retuned (change the constants below, re-run `image`).
"""
import re
import sys

CONTRAST = 0.962
SATURATE = 0.892
BRIGHTNESS = 1.02
SEPIA = 0.035
LIFT = (38 / 255, 34 / 255, 40 / 255)
LIFT_ALPHA = 0.35


def _clamp(v):
    return 0.0 if v < 0 else 1.0 if v > 1 else v


def _mat(m, c):
    r, g, b = c
    return tuple(_clamp(m[i][0] * r + m[i][1] * g + m[i][2] * b) for i in range(3))


def _sat_matrix(s):
    return (
        (0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s),
        (0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s),
        (0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s),
    )


def _sepia_matrix(a):
    k = 1 - a
    return (
        (0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k),
        (0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k),
        (0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k),
    )


SAT = _sat_matrix(SATURATE)
SEP = _sepia_matrix(SEPIA)


def bake_rgb01(c):
    c = tuple(_clamp((v - 0.5) * CONTRAST + 0.5) for v in c)
    c = _mat(SAT, c)
    c = tuple(_clamp(v * BRIGHTNESS) for v in c)
    c = _mat(SEP, c)
    return tuple(v + LIFT_ALPHA * (max(v, l) - v) for v, l in zip(c, LIFT))


def bake_rgb255(r, g, b):
    out = bake_rgb01((r / 255, g / 255, b / 255))
    return tuple(int(round(v * 255)) for v in out)


def _hex(rgb):
    return '#%02x%02x%02x' % rgb


HEX_RE = re.compile(r'(?<![\w&])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])')
RGB_RE = re.compile(r'rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+%?)\s*)?\)')


def _sub_hex(m):
    h = m.group(1)
    if len(h) == 3:
        r, g, b = (int(x * 2, 16) for x in h)
        return _hex(bake_rgb255(r, g, b))
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    out = _hex(bake_rgb255(r, g, b))
    return out + (h[6:8] if len(h) == 8 else '')


def _sub_rgb(m):
    r, g, b = bake_rgb255(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    a = m.group(4)
    if a is None:
        return f'rgb({r},{g},{b})'
    return f'rgba({r},{g},{b},{a})'


def bake_text(s):
    s = RGB_RE.sub(_sub_rgb, s)
    s = HEX_RE.sub(_sub_hex, s)
    return s


def bake_image(src, dst):
    import numpy as np
    from PIL import Image
    im = Image.open(src)
    has_alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    im = im.convert('RGBA' if has_alpha else 'RGB')
    a = np.asarray(im).astype(np.float64) / 255.0
    rgb = a[..., :3]
    rgb = np.clip((rgb - 0.5) * CONTRAST + 0.5, 0, 1)
    rgb = np.clip(rgb @ np.array(SAT).T, 0, 1)
    rgb = np.clip(rgb * BRIGHTNESS, 0, 1)
    rgb = np.clip(rgb @ np.array(SEP).T, 0, 1)
    lift = np.array(LIFT)
    rgb = rgb + LIFT_ALPHA * (np.maximum(rgb, lift) - rgb)
    a[..., :3] = rgb
    out = Image.fromarray(np.round(a * 255).astype(np.uint8), 'RGBA' if has_alpha else 'RGB')
    kw = {}
    ext = dst.lower().rsplit('.', 1)[-1]
    if ext in ('jpg', 'jpeg'):
        kw = {'quality': 90}
    elif ext == 'webp':
        kw = {'quality': 90, 'method': 6}
    out.save(dst, **kw)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'color':
        print(bake_text(sys.argv[2]))
    elif cmd == 'image':
        bake_image(sys.argv[2], sys.argv[3])
    elif cmd == 'text':
        for f in sys.argv[2:]:
            with open(f, encoding='utf-8') as fh:
                src = fh.read()
            out = bake_text(src)
            if out != src:
                with open(f, 'w', encoding='utf-8') as fh:
                    fh.write(out)
                print('baked', f)
    else:
        print(__doc__)
        sys.exit(1)
