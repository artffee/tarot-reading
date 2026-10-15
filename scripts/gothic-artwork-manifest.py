#!/usr/bin/env python3
"""Record the checked publication assets without bundling generation intermediates."""
from pathlib import Path
from PIL import Image
import json,hashlib
root=Path(__file__).resolve().parents[1]
cards=json.loads((root/'decks/gothic/content.json').read_text())
entries=[]
for name in [c['id'] for c in cards]+['back']:
 p=root/f'cards/gothic/{name}.webp'
 row={'id':name,'path':f'cards/gothic/{name}.webp','status':'pending'}
 if p.exists():
  with Image.open(p) as im:im.load();size=im.size
  row.update(status='finished',sha256=hashlib.sha256(p.read_bytes()).hexdigest(),width=size[0],height=size[1],bytes=p.stat().st_size)
 entries.append(row)
(root/'docs/gothic-artwork.json').write_text(json.dumps({'collection':'Nocturne Cathedral Tarot','method':'Original AI-assisted illustrations generated for The Cat Priestess; no external artist references or copied illustrations.','presentation':'896 × 1344 WebP; full compositions preserved. Titles and numbers use consistent live HTML typography.','assets':entries},indent=2)+'\n')
print(f'{sum(a["status"]=="finished" for a in entries)}/79 finished publication assets')
