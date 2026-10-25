#!/usr/bin/env python3
"""Check the delivered book against the actual deck, not duplicated fixtures."""
import hashlib,json,re,unicodedata
from pathlib import Path
import fitz
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'decks/gothic/companion-manifest.json').read_text())
cards=json.loads((ROOT/'decks/gothic/content.json').read_text())
pdf=ROOT/m['file'].lstrip('/');doc=fitz.open(pdf)
norm=lambda s:re.sub(r'\s+',' ',unicodedata.normalize('NFKC',s)).strip()
assert len(doc)==m['pages']==192
assert hashlib.sha256(pdf.read_bytes()).hexdigest()==m['sha256']
assert pdf.stat().st_size==m['bytes']
assert hashlib.sha256((ROOT/'decks/gothic/content.json').read_bytes()).hexdigest()==m['source_content_sha256']
assets={a['path']:a for a in m['images']}
links=[];image_xrefs=set();font_xrefs=set()
for i,page in enumerate(doc):
    assert page.rect.width==504 and page.rect.height==720
    text=page.get_text();assert len(text)>40,(i+1,'empty page')
    assert '\ufffd' not in text and '\x00' not in text
    for b in page.get_text('dict')['blocks']:
        if b['type']!=0:continue
        for line in b['lines']:
            for span in line['spans']:
                x0,y0,x1,y1=span['bbox'];assert x0>=24 and x1<=480 and y0>=20 and y1<=710,(i+1,span)
    for l in page.get_links():
        if l['kind']==fitz.LINK_GOTO:assert 0<=l['page']<192
        elif l['kind']==fitz.LINK_URI:assert l['uri'].startswith('https://')
        elif l['kind']==fitz.LINK_NAMED:assert 1<=int(l['page'])<=192
        else:raise AssertionError((i+1,l))
        links.append(l)
    image_xrefs.update(im[0] for im in page.get_images())
    font_xrefs.update(f[0] for f in page.get_fonts())
for xref in font_xrefs:
    name,ext,kind,data=doc.extract_font(xref);assert data,(name,'font not embedded')
for i,c in enumerate(cards):
    art=doc[19+i*2];meaning=doc[20+i*2];a=assets[c['image']]
    assert norm(c['name']) in norm(art.get_text())
    for field in ['symbolism','up','rev','question']:
        assert norm(c[field]) in norm(meaning.get_text()),(c['id'],field)
    for t in c['aff']+c['keywords']:
        assert norm(t).lower() in norm(art.get_text()).lower(),(c['id'],t)
    assert len(art.get_images())==1
    embedded=doc.extract_image(art.get_images()[0][0]);assert (embedded['width'],embedded['height'])==(896,1344)
    assert hashlib.sha256(embedded['image']).hexdigest()==a['embedded_jpeg_sha256'],c['id']
    source=ROOT/c['image'].lstrip('/');assert hashlib.sha256(source.read_bytes()).hexdigest()==a['sha256']
    Image.open(source).verify()
    assert any(l.get('uri')=='https://www.thecatpriestess.com/decks/gothic/'+c['id'] for l in meaning.get_links())
assert len(image_xrefs)==79,len(image_xrefs)
assert len([x for x in doc.get_toc() if x[0]==2])==78
html=(ROOT/'decks/gothic/companion.html').read_text()
assert m['file'] in html and '192 pages' in html
for attr in re.findall(r'(?:href|src)="([^"]+)"',html):
    if not attr.startswith('/') or attr.startswith('/?'):continue
    path=ROOT/attr.split('#')[0].split('?')[0].lstrip('/')
    assert path.exists() or path.with_suffix('.html').exists(),attr
for path in ['decks/gothic/index.html','decks/index.html','decks/gothic/print.html']:
    assert '/decks/gothic/companion' in (ROOT/path).read_text(),path
assert 'https://www.thecatpriestess.com/decks/gothic/companion' in (ROOT/'sitemap.xml').read_text()
assert "url.pathname.endsWith('.pdf')" in (ROOT/'sw.js').read_text()
print(json.dumps({'pages':len(doc),'complete_card_sections':78,'original_illustrations':78,'additional_original_back':1,'links':len(links),'embedded_fonts':len(font_xrefs),'source_text':'all exact','website_links':'all local targets exist'},indent=2))
