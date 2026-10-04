#!/usr/bin/env python3
"""Build a fully offline, single-file edition using only the Python standard library."""
from pathlib import Path
import base64, hashlib, json, mimetypes, re
ROOT = Path(__file__).resolve().parents[1]
def data(path):
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()
assets = {p.relative_to(ROOT).as_posix(): data(p) for p in (ROOT/'assets/img').rglob('*.jpg')}
source = (ROOT/'index.html').read_text(encoding='utf-8')
hashes=[]
def script(body):
    body=body.replace('</script', '<\\/script')
    hashes.append("'sha256-"+base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()+"'")
    return '<script>'+body+'</script>'
def js(match):
    name=match[1]
    body=(ROOT/name).read_text(encoding='utf-8')
    if name.endswith('boot.js'):
        body='window.PRUTA_ASSETS='+json.dumps(assets)+';\n'+body
    if name.endswith('posters.js'):
        body=body.replace("'assets/img/months/' + String(idx(key) + 1).padStart(2, '0') + '.jpg'", "asset('assets/img/months/' + String(idx(key) + 1).padStart(2, '0') + '.jpg')")
        body=body.replace("'assets/img/cats/' + photoKey(cat) + '.jpg'", "asset('assets/img/cats/' + photoKey(cat) + '.jpg')")
        body=body.replace("'assets/img/life/' + name + '.jpg'", "asset('assets/img/life/' + name + '.jpg')")
        body=body.replace("const el = P.kit.el, fmt = P.fmt;", "const el = P.kit.el, fmt = P.fmt;\n  const asset = p => window.PRUTA_ASSETS[p];")
    return script(body)
def css(match):
    path=ROOT/match[1]
    body=path.read_text(encoding='utf-8')
    body=re.sub(r'url\(["\']?([^\)"\']+)["\']?\)', lambda m:'url("'+data((path.parent/m[1]).resolve())+'")' if not m[1].startswith(('data:', '#')) else m[0], body)
    return '<style>'+body+'</style>'
source=re.sub(r'<script src="([^"]+)"></script>', js, source)
source=re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, source)
policy="default-src 'none'; script-src "+' '.join(hashes)+"; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"
source=re.sub(r'(<meta http-equiv="Content-Security-Policy" content=")[^"]+', lambda m:m[1]+policy,source)
credits='\n'.join((ROOT/p).read_text(encoding='utf-8') for p in ['CREDITS.md','assets/fonts/OFL-Heebo.txt','assets/fonts/OFL-FrankRuhlLibre.txt'])
source += '\n<!-- Bundled attribution and licenses\n'+credits.replace('--','—')+'\n-->\n'
(ROOT/'Pruta.html').write_text(source, encoding='utf-8', newline='\n')
print('Built Pruta.html:', (ROOT/'Pruta.html').stat().st_size, 'bytes')
