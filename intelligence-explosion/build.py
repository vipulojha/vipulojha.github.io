#!/usr/bin/env python3
"""Concatenate src/*.js into one inline <script type=module> in index.html."""
import re, pathlib
src = pathlib.Path(__file__).parent / 'src'
parts = []
for f in sorted(src.glob('*.js')):
    code = f.read_text()
    code = re.sub(r"^import .* from '\./[^']+';\n", '', code, flags=re.M)
    code = re.sub(r"^export \{[^}]*\};?\n?", '', code, flags=re.M)
    parts.append(f'// ---- {f.name} ----\n' + code)
html = (src / 'shell.html').read_text().replace('%%SCRIPT%%', '\n'.join(parts))
(pathlib.Path(__file__).parent / 'index.html').write_text(html)
print('index.html', len(html), 'bytes')
