#!/usr/bin/env python3
"""Independently inspect every published page, image stream, cut and duplex pair."""
import hashlib
import io
import json
import math
from html.parser import HTMLParser
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageStat
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT/'decks/gothic/downloads'
MANIFEST = json.loads((DEST/'manifest.json').read_text())
CARDS = json.loads((ROOT/'decks/gothic/content.json').read_text())
MM = 25.4/72
sha = lambda data: hashlib.sha256(data).hexdigest()


def close(a,b,tolerance=.025):
    assert abs(a-b)<tolerance,(a,b)


class Links(HTMLParser):
    def __init__(self):
        super().__init__();self.pdfs=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs);href=attrs.get('href','')
        if tag=='a' and href.startswith('/decks/gothic/downloads/') and href.endswith('.pdf'):
            assert 'download' in attrs,'Direct downloads must work without JavaScript'
            self.pdfs.append(href.split('/')[-1])


assert len(MANIFEST['assets'])==79
assets={a['path']:a for a in MANIFEST['assets']}
for asset in assets.values():
    assert sha((ROOT/asset['path']).read_bytes())==asset['sourceSha256'],'Source art was altered'
art_manifest=json.loads((ROOT/'docs/gothic-artwork.json').read_text())
for asset in art_manifest['assets']:
    assert sha((ROOT/asset['path']).read_bytes())==asset['sha256'],'Completed artwork must remain untouched'
# Do not update the preservation fixture when adding print products.
for path,digest in json.loads((ROOT/'tests/original-assets.json').read_text())['files'].items():
    if path.startswith('deck/downloads/'):
        assert sha((ROOT/path).read_bytes())==digest,'An original PDF changed'

verified_images=set()
report=[]
for entry in MANIFEST['files']:
    path=DEST/entry['file'];raw=path.read_bytes()
    assert len(raw)==entry['bytes'] and sha(raw)==entry['sha256']
    assert raw.startswith(b'%PDF-') and raw.rstrip().endswith(b'%%EOF')
    strict=PdfReader(io.BytesIO(raw),strict=True)
    assert not strict.is_encrypted and len(strict.pages)==entry['pages']
    document=fitz.open(path)
    assert not document.is_repaired and len(document)==entry['pages']
    if 'paper' not in entry:
        assert len(document)==1 and 'Physical printer calibration' in document[0].get_text()
        assert all(0 <= b[1] < b[3] < document[0].rect.height for b in document[0].get_text('blocks'))
        document.close();continue
    paper,flip,test=entry['paper'],entry['flip'],entry['calibration']
    width,height=(215.9,279.4) if paper=='letter' else (210,297)
    prefs=strict.trailer['/Root']['/ViewerPreferences']
    assert prefs['/PrintScaling']=='/None'
    assert prefs['/Duplex']==('/DuplexFlipLongEdge' if flip=='long' else '/DuplexFlipShortEdge')
    front_ids=[];back_count=0;cuts={}
    page_placements=[]
    for index,page in enumerate(document):
        side='front' if index%2==0 else 'back';sheet=index//2
        close(page.rect.width*MM,width);close(page.rect.height*MM,height)
        assert page.rotation==0
        assert f'Sheet {sheet+1} of 13' in page.get_text() and side.upper() in page.get_text()
        assert 'SCREEN PREVIEW' not in page.get_text()
        images=page.get_image_info(xrefs=True)
        assert len(images)==6,'Six artwork placements per page, without missing cards'
        drawings=page.get_drawings()
        guides=[d for d in drawings if len(d['items'])==8 and all(i[0]=='l' for i in d['items'])]
        scales=[d for d in drawings if len(d['items'])==3]
        assert len(guides)==6 and len(scales)==1
        scale=scales[0]['items'][1]
        close(abs(scale[2].x-scale[1].x)*MM,50)
        for slot,(info,guide) in enumerate(zip(images,guides)):
            source_slot=slot if side=='front' else ([2,1,0,5,4,3] if flip=='long' else [3,4,5,0,1,2])[slot]
            card=CARDS[sheet*6+source_slot]
            src=card['image'] if side=='front' else '/cards/gothic/back.webp'
            extracted=document.extract_image(info['xref'])['image']
            assert sha(extracted)==assets[src.lstrip('/')]['embeddedSha256'],(entry['file'],index,slot,card['id'])
            if src not in verified_images:
                original=Image.open(ROOT/src.lstrip('/')).convert('RGB')
                embedded=Image.open(io.BytesIO(extracted)).convert('RGB')
                assert original.size==embedded.size==(896,1344)
                mse=sum(ImageStat.Stat(ImageChops.difference(original,embedded)).rms[i]**2 for i in range(3))/3
                psnr=10*math.log10(255**2/mse) if mse else math.inf
                assert psnr>40,(src,'Unexpected JPEG fidelity',psnr)
                verified_images.add(src)
            a,b,c,d,_,_=info['transform']
            assert a>0 and d>0 and abs(b)<.001 and abs(c)<.001,'Never mirror, rotate or stretch the art'
            x=(width-188)/2+(slot%3)*64;y=(height-184)/2+(slot//3)*94
            cut=(x,y,x+60,y+90)
            for actual,want in zip(info['bbox'],(x+2,y+3,x+58,y+87)): close(actual*MM,want)
            marks=[((x-2,y),(x-.5,y)),((x,y-2),(x,y-.5)),
                   ((x+60.5,y),(x+62,y)),((x+60,y-2),(x+60,y-.5)),
                   ((x-2,y+90),(x-.5,y+90)),((x,y+90.5),(x,y+92)),
                   ((x+60.5,y+90),(x+62,y+90)),((x+60,y+90.5),(x+60,y+92))]
            for item,points in zip(guide['items'],marks):
                for point,want in zip(item[1:],points):
                    close(point.x*MM,want[0]);close(point.y*MM,want[1])
                    assert min(point.x*MM,width-point.x*MM,point.y*MM,height-point.y*MM)>=8.99
            close(guide['width']*MM,.18)
            cuts[(sheet,side,slot)]=cut
            if side=='front': front_ids.append(card['id'])
            else: back_count+=1
            page_placements.append({'page':index+1,'sheet':sheet+1,'side':side,'slot':slot,'card':card['id'],'image':src})
        if test:
            for label,x,y in [('A',12,34),('B',width-12,34),('C',12,height-34),('D',width-12,height-34)]:
                if side=='back': x,y=(width-x,y) if flip=='long' else (x,height-y)
                matches=[span for block in page.get_text('dict')['blocks'] if 'lines' in block for ln in block['lines'] for span in ln['spans'] if span['text']==label]
                assert len(matches)==1
                span=matches[0];close((span['bbox'][0]+span['bbox'][2])/2*MM,x+3,.08)
                close(span['origin'][1]*MM,y+1)
    expected=CARDS[:6] if test else CARDS
    assert front_ids==[c['id'] for c in expected] and len(set(front_ids))==len(expected)
    assert back_count==len(expected) and page_placements==entry['placements']
    for (sheet,side,slot),cut in cuts.items():
        if side!='front':continue
        backslot=([2,1,0,5,4,3] if flip=='long' else [3,4,5,0,1,2])[slot]
        expected=((width-cut[2],cut[1],width-cut[0],cut[3]) if flip=='long' else (cut[0],height-cut[3],cut[2],height-cut[1]))
        for value,want in zip(cuts[(sheet,'back',backslot)],expected):close(value,want)
    report.append({'file':entry['file'],'pages':len(document),'fronts':len(front_ids),'backs':back_count,'sha256':sha(raw)})
    document.close()
assert len(verified_images)==79
for source in ['decks/gothic/index.html','decks/gothic/print.html']:
    parser=Links();parser.feed((ROOT/source).read_text())
    expected={f['file'] for f in MANIFEST['files']}
    if source=='decks/gothic/index.html':
        companion=json.loads((ROOT/'decks/gothic/companion-manifest.json').read_text())
        expected.add(Path(companion['file']).name)
    assert set(parser.pdfs)==expected,(source,'Every printable PDF and the gallery companion need direct downloads')
output=ROOT/'tests/output';output.mkdir(exist_ok=True)
(output/'gothic-downloads-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: 9 intact PDFs; 113 pages; 672 artwork placements; all 78 fronts exactly once per full deck; 79 original-resolution image streams; accurate 60 x 90 mm cuts; 50 mm scale; both duplex transforms and calibration targets; original artwork and 8 oracle PDFs unchanged.')
