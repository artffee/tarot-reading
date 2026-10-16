#!/usr/bin/env python3
"""Publish the existing Gothic artwork as native-resolution, home-printable PDFs.

No artwork is generated or edited. JPEG quality 98 / 4:4:4 keeps the original
896 x 1344 resolution while keeping each complete PDF below GitHub's 100 MiB
limit. Source WebPs remain byte-for-byte unchanged. See NOCTURNE-PRINT.md.
"""
import hashlib
import io
import json
from pathlib import Path

from PIL import Image
from reportlab import rl_config
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
rl_config.useA85 = 0  # JPEG streams are already binary-safe in PDF; avoid 25% ASCII overhead.
DEST = ROOT / 'decks/gothic/downloads'
MM = 72 / 25.4
PAPERS = {'letter': (215.9, 279.4), 'a4': (210, 297)}
CARDS = json.loads((ROOT / 'decks/gothic/content.json').read_text())
BACK = '/cards/gothic/back.webp'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def front_slot(sheet, slot):
    return CARDS[sheet * 6 + slot]


def image_readers():
    result, assets = {}, []
    for src in [*(c['image'] for c in CARDS), BACK]:
        path = ROOT / src.lstrip('/')
        image = Image.open(path).convert('RGB')
        assert image.size == (896, 1344), src
        buffer = io.BytesIO()
        image.save(buffer, 'JPEG', quality=98, subsampling=0, optimize=True)
        data = buffer.getvalue()
        result[src] = ImageReader(io.BytesIO(data))
        assets.append({'path': src.lstrip('/'), 'sourceSha256': sha(path.read_bytes()),
                       'embeddedSha256': sha(data), 'width': image.width, 'height': image.height})
    return result, assets


def line(c, x1, y1, x2, y2, height):
    c.line(x1 * MM, (height - y1) * MM, x2 * MM, (height - y2) * MM)


def text(c, value, x, y, height, size=8, font='Helvetica', center=True):
    c.setFont(font, size)
    method = c.drawCentredString if center else c.drawString
    method(x * MM, (height - y) * MM, value)


def cut_guides(c, x, y, height):
    c.setLineWidth(.18 * MM)
    p = c.beginPath()
    for a, b, d, e in [(x-2,y,x-.5,y), (x,y-2,x,y-.5),
                        (x+60.5,y,x+62,y), (x+60,y-2,x+60,y-.5),
                        (x-2,y+90,x-.5,y+90), (x,y+90.5,x,y+92),
                        (x+60.5,y+90,x+62,y+90), (x+60,y+90.5,x+60,y+92)]:
        p.moveTo(a * MM, (height-b) * MM)
        p.lineTo(d * MM, (height-e) * MM)
    c.drawPath(p)


def targets(c, width, height, side, flip):
    c.setLineWidth(.18 * MM)
    for name, x, y in [('A',12,34),('B',width-12,34),('C',12,height-34),('D',width-12,height-34)]:
        if side == 'back':
            x, y = (width-x, y) if flip == 'long' else (x, height-y)
        line(c,x-1.5,y,x+1.5,y,height)
        line(c,x,y-1.5,x,y+1.5,height)
        text(c,name,x+3,y+1,height,7)


def deck_pdf(paper, flip, calibration, readers):
    width, height = PAPERS[paper]
    name = f'nocturne-cathedral-{paper}-{flip}-edge{"-calibration" if calibration else ""}.pdf'
    path = DEST / name
    c = canvas.Canvas(str(path), pagesize=(width*MM,height*MM), pageCompression=1,
                      invariant=1, pdfVersion=(1,4))
    c.setTitle(f'Nocturne Cathedral Tarot - {paper.upper()} - {flip}-edge - {"Calibration" if calibration else "78 cards"}')
    c.setAuthor('The Cat Priestess')
    c.setSubject('60 x 90 mm cards. Print portrait at actual size / 100%. Match the duplex edge. Calibrate your physical printer first.')
    c.setViewerPreference('PrintScaling', 'None')
    c.setViewerPreference('Duplex', 'DuplexFlipLongEdge' if flip == 'long' else 'DuplexFlipShortEdge')
    placements = []
    for sheet in range(1 if calibration else 13):
        for side in ['front','back']:
            text(c,'NOCTURNE CATHEDRAL TAROT',width/2,15,height,10,'Times-Roman')
            text(c,f'TOP  |  {side.upper()}  |  {flip.upper()}-EDGE DUPLEX  |  SHEET {sheet+1} OF 13',width/2,21,height,8)
            for slot in range(6):
                # Independent reflected placement, without mirroring any illustration.
                source_slot = slot if side == 'front' else ([2,1,0,5,4,3] if flip == 'long' else [3,4,5,0,1,2])[slot]
                card = front_slot(sheet, source_slot)
                src = card['image'] if side == 'front' else BACK
                x = (width-188)/2 + (slot % 3)*64
                y = (height-184)/2 + (slot // 3)*94
                # 2:3 art contained inside a 56 x 86 mm safe area: 2 mm sides, 3 mm top/bottom.
                c.drawImage(readers[src],(x+2)*MM,(height-y-87)*MM,width=56*MM,height=84*MM)
                cut_guides(c,x,y,height)
                placements.append({'page':sheet*2+(1 if side=='front' else 2),'sheet':sheet+1,
                                   'side':side,'slot':slot,'card':card['id'],'image':src})
            if calibration:
                targets(c,width,height,side,flip)
                text(c,'CALIBRATION: A/B/C/D crosshairs should coincide when held to the light.',width/2,height-30,height,8)
            text(c,f'Sheet {sheet+1} of 13  |  {side.upper()}  |  Cards {sheet*6+1}-{sheet*6+6}  |  {paper.upper()}',width/2,height-23,height,8)
            text(c,'Actual size / 100%  |  Cut size 60 x 90 mm  |  Measure line below: 50 mm',width/2,height-18,height,8)
            c.setLineWidth(.2*MM)
            p = c.beginPath()
            for a,b,d,e in [(width/2-25,height-14,width/2-25,height-11),
                            (width/2-25,height-12.5,width/2+25,height-12.5),
                            (width/2+25,height-14,width/2+25,height-11)]:
                p.moveTo(a*MM,(height-b)*MM);p.lineTo(d*MM,(height-e)*MM)
            c.drawPath(p)
            c.showPage()
    c.save()
    assert path.stat().st_size < 100*1024*1024, 'Keep full downloads compatible with standard GitHub storage.'
    return {'file':name,'paper':paper,'flip':flip,'calibration':calibration,
            'pages':2 if calibration else 26,'bytes':path.stat().st_size,
            'sha256':sha(path.read_bytes()),'placements':placements}


def guide():
    name = 'nocturne-cathedral-printing-guide.pdf'
    c = canvas.Canvas(str(DEST/name),pagesize=(210*MM,297*MM),invariant=1)
    c.setTitle('Nocturne Cathedral Tarot - Home-printing guide')
    c.setAuthor('The Cat Priestess')
    c.setViewerPreference('PrintScaling','None')
    text(c,'THE CAT PRIESTESS',18,19,297,9,'Helvetica',False)
    text(c,'Nocturne Cathedral Tarot',18,34,297,25,'Times-Roman',False)
    text(c,'Home-printing guide  /  78 cards  /  60 x 90 mm',18,44,297,11,'Helvetica',False)
    sections = [
        ('1. Choose the matching files', ['Choose US Letter (8.5 x 11 in) or A4 (210 x 297 mm) to match your paper.',
         'Each complete PDF has 26 pages: front 1, back 1, through front 13, back 13.',
         'Six cards per sheet; 13 double-sided sheets. The guide is a separate file.']),
        ('2. Set your print dialog', ['Portrait; actual size / 100%; one PDF page per sheet. Turn OFF fit, shrink,',
         'booklet mode, borderless expansion, and browser headers/footers.',
         'For automatic duplex, match the file name: long edge = book turn;',
         'short edge = notepad turn. PDF preferences are hints; check the driver.']),
        ('3. Calibrate on one sheet of plain paper', ['Print BOTH pages of the matching calibration PDF with the same settings.',
         'Measure the 50 mm line and a card: 60 x 90 mm. If the scale is wrong, fix',
         'the print settings before proceeding. Hold the sheet up to a bright light:',
         'A/B/C/D crosshairs and corner cutting guides should line up.',
         'If registration drifts, check feed and duplex edge, then adjust the printer',
         'driver registration offset if supported. Retest. Do not resize just one side.']),
        ('4. Printing both sides by hand', ['Use the website print workspace: fronts only, then backs only. Reinsert',
         'the paper for the chosen edge. Match front 1 to back 1 through sheet 13.',
         'Use reverse back order only if your printer feeds the last front first.',
         'Alternatively, print odd PDF pages, then the matching even pages.',
         'Paper face, feed direction and stack order vary: establish them with the',
         'two-page calibration test first. There is no universal reinsert direction.']),
        ('5. Print and finish', ['Use stock within your printer\'s paper-weight and duplex limits; for heavier',
         'stock, print one side at a time or use card sleeves. Let the ink dry.',
         'Cut at the OUTER corner guides to 60 x 90 mm. Do not cut at the art edge.',
         'The white border is intentional: at least 2 mm protects the entire image.',
         'All existing illustrations are reused at native resolution (about 406 ppi).']),
        ('What has been verified', ['Software verifies artwork references, all 78 front/back placements, page',
         'size, cut geometry, safe borders, PDF integrity, and both duplex mappings.',
         'Physical printer calibration requires your real printed test; no software',
         'check can guarantee the registration or scaling of a particular printer.'])]
    y=59
    for heading,lines in sections:
        text(c,heading,18,y,297,12,'Helvetica-Bold',False);y+=7
        for value in lines:
            text(c,value,18,y,297,9,'Helvetica',False);y+=4.5
        y+=5
    text(c,'www.thecatpriestess.com/decks/gothic/print',105,287,297,9)
    c.save()
    path=DEST/name
    return {'file':name,'pages':1,'bytes':path.stat().st_size,'sha256':sha(path.read_bytes())}


def main():
    assert len(CARDS)==78 and len({c['id'] for c in CARDS})==78
    DEST.mkdir(parents=True,exist_ok=True)
    readers,assets = image_readers()
    files = [deck_pdf(paper,flip,calibration,readers) for paper in PAPERS
             for flip in ['long','short'] for calibration in [False,True]]
    files.append(guide())
    manifest={'deck':'nocturne-gothic','cardCount':78,'cardsPerSheet':6,'sheets':13,
              'cutMm':[60,90],'artMm':[56,84],'gutterMm':4,'minSafeBorderMm':2,
              'encoding':{'format':'JPEG','quality':98,'subsampling':0,'resized':False},
              'assets':assets,'files':files}
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    data={'id':'nocturne-gothic','name':'Nocturne Cathedral Tarot','back':BACK,'cards':[
        {'id':c['id'],'name':c['name'],'image':c['image'],'label':str(i+1)} for i,c in enumerate(CARDS)]}
    (ROOT/'decks/gothic/print-data.js').write_text('/* Generated by scripts/build-gothic-print.py. */\nwindow.PrintDeck = '+json.dumps(data,separators=(',',':'))+';\n')
    print('Built 4 complete decks, 4 two-page calibration PDFs and a printing guide.')
    for entry in files: print(f"{entry['file']}: {entry['pages']} pages, {entry['bytes']/1e6:.1f} MB")


if __name__=='__main__':
    main()
