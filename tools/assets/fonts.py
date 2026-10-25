#!/usr/bin/env python3
"""
Fetch the app's fonts from github.com/google/fonts (OFL) and write static
TTFs into apps/mobile/assets/fonts.

Manrope and Cinzel only exist there as variable fonts. Android cannot pick a
weight out of a variable TTF through fontFamily, so each weight is cut into
its own static instance (fontTools.varLib.instancer) with unique family /
PostScript names, which is what iOS registers fonts by.

    python3 tools/assets/fonts.py

Needs fontTools; when it is missing, run through tools/assets/fonts.sh,
which provides it in a throwaway venv.
"""
import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(REPO, 'apps', 'mobile', 'assets', 'fonts')
RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'

WEIGHT_NAMES = {400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black'}

# family -> (google/fonts dir, variable file or None, weights, static files)
FAMILIES = {
    # UI and body face; web loads 400–800.
    'Manrope': ('manrope', 'Manrope[wght].ttf', [400, 500, 600, 700, 800], []),
    # Latin display face; the axis spans 400–900 (the web uses 500–700).
    'Cinzel': ('cinzel', 'Cinzel[wght].ttf', [400, 500, 600, 700, 800, 900], []),
    # Cyrillic-capable display candidates for uk (Cinzel has no Cyrillic).
    # Saved as Forum.ttf: the file name must equal the PostScript name so one
    # fontFamily string works on both iOS (PostScript) and Android (file name).
    'Forum': ('forum', None, [], [('Forum-Regular.ttf', 'Forum.ttf')]),
    'CormorantSC': ('cormorantsc', None, [], [
        'CormorantSC-Light.ttf', 'CormorantSC-Regular.ttf', 'CormorantSC-Medium.ttf',
        'CormorantSC-SemiBold.ttf', 'CormorantSC-Bold.ttf']),
    'Prata': ('prata', None, [], ['Prata-Regular.ttf']),
}

UK_SAMPLE = 'ҐЄІЇґєії'  # Ukrainian-specific letters on top of basic Cyrillic


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def check_ttf(data, name):
    # TrueType outlines: 00 01 00 00, or 'true' (old Apple); OTTO would be CFF.
    if data[:4] not in (b'\x00\x01\x00\x00', b'true'):
        raise SystemExit(f'{name}: not a TrueType font (magic {data[:4]!r})')
    TTFont(io.BytesIO(data)).close()  # parses the table directory


def set_names(font, family, style, weight):
    """Unique names per static file: family 'Manrope-Bold' style 'Regular'.

    A distinct family per weight is what lets RN select a file by
    fontFamily alone on both platforms (no reliance on fontWeight)."""
    full = f'{family}-{style}'
    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25):  # typographic/WWS/variation names
            name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, full), (2, 'Regular'), (3, f'{full};tactictak'), (4, full), (6, full)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    font['OS/2'].usWeightClass = weight
    font['OS/2'].fsSelection = (font['OS/2'].fsSelection & ~0b1100001) | 0b1000000  # REGULAR bit only
    font['head'].macStyle = 0


def info(path):
    f = TTFont(path)
    cmap = f.getBestCmap()
    has_cyr = all(ord(c) in cmap for c in 'АБВабв' + UK_SAMPLE)
    ps = f['name'].getDebugName(6)
    out = {
        'postScriptName': ps,
        'weight': f['OS/2'].usWeightClass,
        'glyphs': f['maxp'].numGlyphs,
        'cyrillic': has_cyr,
        'bytes': os.path.getsize(path),
        'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest()[:16],
    }
    f.close()
    return out


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'licenses'))
    manifest = {}
    with tempfile.TemporaryDirectory() as tmp:
        for family, (folder, var, weights, statics) in FAMILIES.items():
            lic = fetch(RAW + folder + '/OFL.txt')
            if b'SIL OPEN FONT LICENSE' not in lic.upper():
                raise SystemExit(f'{family}: OFL.txt does not look like the OFL')
            with open(os.path.join(OUT, 'licenses', f'{family}-OFL.txt'), 'wb') as fh:
                fh.write(lic)
            if var:
                data = fetch(RAW + folder + '/' + urllib.request.quote(var))
                check_ttf(data, var)
                src = os.path.join(tmp, var)
                with open(src, 'wb') as fh:
                    fh.write(data)
                axis = next(a for a in TTFont(src)['fvar'].axes if a.axisTag == 'wght')
                for w in weights:
                    if not axis.minValue <= w <= axis.maxValue:
                        raise SystemExit(f'{family}: weight {w} outside {axis.minValue}–{axis.maxValue}')
                    font = instancer.instantiateVariableFont(TTFont(src), {'wght': w})
                    set_names(font, family, WEIGHT_NAMES[w], w)
                    font.recalcTimestamp = False  # keep head.modified from upstream: reruns are byte-identical
                    dst = os.path.join(OUT, f'{family}-{WEIGHT_NAMES[w]}.ttf')
                    font.save(dst)
                    manifest[os.path.basename(dst)] = {'family': family, 'source': f'ofl/{folder}/{var}@wght={w}', **info(dst)}
            for entry in statics:
                name, saved = entry if isinstance(entry, tuple) else (entry, entry)
                data = fetch(RAW + folder + '/' + name)
                check_ttf(data, name)
                dst = os.path.join(OUT, saved)
                with open(dst, 'wb') as fh:
                    fh.write(data)
                manifest[saved] = {'family': family, 'source': f'ofl/{folder}/{name}', **info(dst)}
    for path in os.listdir(OUT):
        if path.endswith('.ttf'):
            check_ttf(open(os.path.join(OUT, path), 'rb').read(), path)
    with open(os.path.join(OUT, 'fonts.json'), 'w') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')
    w = max(len(k) for k in manifest)
    for k, v in manifest.items():
        print(f"{k:<{w}}  {v['postScriptName']:<24} wght {v['weight']:<4} cyr {'yes' if v['cyrillic'] else 'NO ':<3} {v['bytes'] / 1024:6.0f} KB")


if __name__ == '__main__':
    sys.exit(main())
