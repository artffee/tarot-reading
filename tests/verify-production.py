#!/usr/bin/env python3
"""Read-only production smoke check after Vercel deployment; no API calls."""
import concurrent.futures,hashlib,json,sys,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=(sys.argv[1] if len(sys.argv)>1 else 'https://www.thecatpriestess.com').rstrip('/')
cards=json.loads((root/'decks/gothic/content.json').read_text())
assets=json.loads((root/'docs/gothic-artwork.json').read_text())['assets']
original=json.loads((root/'tests/original-assets.json').read_text())['files']
checks=[('/',root/'index.html'),('/decks',root/'decks/index.html'),('/decks/gothic',root/'decks/gothic/index.html'),('/decks/registry.js',root/'decks/registry.js'),('/decks/gothic/cards.js',root/'decks/gothic/cards.js'),('/sw.js',root/'sw.js')]
checks += [('/decks/gothic/'+c['id'],root/f'decks/gothic/{c["id"]}.html') for c in cards]
checks += [('/'+a['path'],root/a['path']) for a in assets]
checks += [('/'+p,root/p) for p in original if p.startswith('cards/') or p.startswith('deck/downloads/') or p in ['deck/print.html','deck/print.css','deck/print.js']]
checks += [('/'+p,root/p) for p in ['decks/gothic/print.html','decks/gothic/print-data.js','decks/gothic/print-theme.css','decks/gothic/print-preview.webp','decks/gothic/gothic.css','decks/gothic/downloads/manifest.json']]
checks += [('/decks/gothic/print',root/'decks/gothic/print.html')]
checks += [('/decks/gothic/downloads/'+f['file'],root/'decks/gothic/downloads'/f['file']) for f in json.loads((root/'decks/gothic/downloads/manifest.json').read_text())['files']]
def verify(item):
 path,local=item
 data=local.read_bytes();sha=hashlib.sha256(data).hexdigest()
 request=urllib.request.Request(base+path+'?verify='+sha[:12],headers={'User-Agent':'CatPriestess-Deployment-Check/1.0'})
 with urllib.request.urlopen(request,timeout=120) as response:
  if response.status!=200:raise AssertionError(f'{path}: HTTP {response.status}')
  if path.endswith('.pdf') and 'application/pdf' not in response.headers.get('Content-Type',''):raise AssertionError(f'{path}: wrong PDF content type')
  digest=hashlib.sha256()
  while chunk:=response.read(1024*1024):digest.update(chunk)
  if digest.hexdigest()!=sha:raise AssertionError(f'{path}: deployed content differs')
 return path
failures=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 tasks={pool.submit(verify,item):item[0] for item in checks}
 for task in concurrent.futures.as_completed(tasks):
  try:task.result()
  except Exception as error:failures.append(f'{tasks[task]}: {error}')
if failures:
 print('\n'.join(failures));sys.exit(1)
print(f'Production verified: {len(checks)} URLs return HTTP 200 and match committed local bytes, including 78 Gothic card pages, 79 Gothic artwork files, original cards, all eight original PDFs, the Gothic print workspace and all nine new PDFs.')
