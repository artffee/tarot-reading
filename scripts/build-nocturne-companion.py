#!/usr/bin/env python3
"""Build the companion from preserved deck data and separately authored chapters.

Requires reportlab, Pillow and pypdf. Uses local Noto Serif and Liberation Sans
fonts (see --font-dir or NOCTURNE_FONT_DIR). No network or artwork generation.
"""
import argparse, csv, hashlib, io, json, os, re
from pathlib import Path
from xml.sax.saxutils import escape
from PIL import Image
from reportlab import rl_config
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph

# Binary streams avoid ASCII85 transport overhead without recompressing artwork.
rl_config.useA85 = False

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_FONT=str(ROOT/'companion/fonts')
p=argparse.ArgumentParser()
p.add_argument('--font-dir',default=os.environ.get('NOCTURNE_FONT_DIR',DEFAULT_FONT))
p.add_argument('--output',default='decks/gothic/downloads/nocturne-cathedral-companion.pdf')
args=p.parse_args()
FONT=Path(args.font_dir)
for name,file in [('Serif','NotoSerif-Regular.ttf'),('SerifB','NotoSerif-Bold.ttf'),('SerifI','NotoSerif-Italic.ttf'),('Sans','LiberationSans-Regular.ttf'),('SansB','LiberationSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONT/file)))
pdfmetrics.registerFontFamily('Serif',normal='Serif',bold='SerifB',italic='SerifI',boldItalic='SerifB')

cards=json.loads((ROOT/'decks/gothic/content.json').read_text())
chapters=json.loads((ROOT/'companion/chapters.json').read_text())
with (ROOT/'companion/guidance.tsv').open() as f:
    guidance={row[0]:dict(reading=row[1],action=row[2],pair=row[3]) for row in csv.reader(f,delimiter='\t')}
assert len(cards)==len(guidance)==78 and set(guidance)=={c['id'] for c in cards}
assert len(chapters['front'])==19 and len(chapters['back'])==17
W,H=504,720
INK='#222833'; NAVY='#111c2c'; GOLD='#82673c'; LIGHT='#f9f6ef'; MUTED='#57616c'; RULE='#c9b895'
output=ROOT/args.output;output.parent.mkdir(parents=True,exist_ok=True)
cv=canvas.Canvas(str(output),pagesize=(W,H),pageCompression=1,invariant=1,initialFontName='Serif')
cv.setTitle('Nocturne Cathedral Tarot: The Illustrated Companion')
cv.setAuthor('The Cat Priestess')
cv.setSubject('All 78 original cards, established meanings, history, spreads and reflective practice')
cv.setKeywords('Nocturne Cathedral, Tarot, The Cat Priestess, Gothic, illustrated companion')
cv.setViewerPreference('DisplayDocTitle','true')
cv._doc.Catalog.PageLayout='TwoPageRight'
cv.showOutline()
images={}; evidence=[]; bounds=[]

def image(path):
    if path not in images:
        source=ROOT/path.lstrip('/');im=Image.open(source).convert('RGB'); buf=io.BytesIO()
        im.save(buf,format='JPEG',quality=90,subsampling=0,optimize=True)
        data=buf.getvalue();images[path]=ImageReader(io.BytesIO(data))
        evidence.append(dict(path=path,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),width=im.width,height=im.height,embedded_jpeg_sha256=hashlib.sha256(data).hexdigest()))
    return images[path]

def para(text,x,y,w,size=10.7,leading=15.5,font='Serif',color=INK,align=0,gap=9):
    style=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading,textColor=HexColor(color),alignment=align,allowWidows=0,allowOrphans=0)
    # Plain authored source contains XML only for deliberately authored hyperlinks.
    text=re.sub(r'\[([HD]\d(?:, [HD]\d)*)\]',lambda m:'<link href="#sources" color="'+GOLD+'">['+m[1]+']</link>',text)
    obj=Paragraph(text,style);_,ht=obj.wrap(w,H)
    if y-ht<52: raise ValueError(f'Page {cv.getPageNumber()} overflow ({y-ht:.1f}): {text[:100]}')
    obj.drawOn(cv,x,y-ht);bounds.append(dict(page=cv.getPageNumber(),x=x,y=y-ht,w=w,h=ht))
    return y-ht-gap

def label(text,x,y,color=GOLD,size=8.2):
    cv.setFillColor(HexColor(color));cv.setFont('SansB',size);cv.drawString(x,y,text.upper())

def rule(y,x=48,w=408,color=RULE):
    cv.setStrokeColor(HexColor(color));cv.setLineWidth(.6);cv.line(x,y,x+w,y)

def base(title='',dark=False):
    page=cv.getPageNumber();cv.setFillColor(HexColor(NAVY if dark else LIGHT));cv.rect(0,0,W,H,fill=1,stroke=0)
    x=54 if page%2 else 44;right=460 if page%2 else 450
    if page>1:
        label('The Cat Priestess' if page%2==0 else 'Nocturne Cathedral',x,687,color='#d3c29f' if dark else MUTED,size=7.8)
        rule(674,x,right-x,color='#4d5460' if dark else RULE)
        rule(43,x,right-x,color='#4d5460' if dark else RULE)
        cv.setFillColor(HexColor('#d3c29f' if dark else MUTED));cv.setFont('Sans',8)
        cv.drawString(x,28,'CONTENTS');cv.linkRect('', 'contents',(x,24,x+52,38),relative=0,thickness=0)
        cv.drawRightString(right,28,str(page))
    return x,right-x

def heading(title,eyebrow='',dark=False):
    x,w=base(title,dark)
    if eyebrow:label(eyebrow,x,647,color='#cdbd9b' if dark else GOLD)
    y=para(escape(title),x,628,w,size=26,leading=31,color=LIGHT if dark else NAVY,font='Serif',gap=20)
    return x,w,y

def end():cv.showPage()

toc=[('Enter by the quiet door',3),('Card index',5),('Tarot history and occult traditions',8),('Arcana, suits and symbols',10),('Reading with care',15),('The illustrated archive',19),('Major Arcana · 22 cards',20),('Wands · 14 cards',64),('Cups · 14 cards',92),('Swords · 14 cards',120),('Pentacles · 14 cards',148),('Spreads and worked reading',176),('Reflective exercises and journal',184),('Creative rituals',186),('Glossary',188),('Sources and website links',189),('Future print preparation',191)]

def chapter(d):
    page=cv.getPageNumber();cv.bookmarkPage('page-'+str(page))
    title=d['title'];kind=d.get('kind','prose')
    if d.get('bookmark'):cv.bookmarkPage(d['bookmark'])
    cv.addOutlineEntry(title if kind!='index' else title+' '+str(page-4),'page-'+str(page),level=0,closed=False)
    if kind=='cover':
        base(dark=True);rule(682,32,440,'#a58d62');rule(39,32,440,'#a58d62')
        para('THE CAT PRIESTESS',40,659,424,size=10,font='Sans',color='#d3c29f',align=1)
        para('NOCTURNE<br/>CATHEDRAL',35,625,434,size=32,leading=37,color=LIGHT,align=1)
        para('TAROT · THE ILLUSTRATED COMPANION',30,536,444,size=9.2,font='Sans',color='#d3c29f',align=1)
        cv.drawImage(image('/cards/gothic/the-high-priestess.webp'),132,153,240,360)
        para('Seventy-eight original illustrations<br/>History · meanings · reflective practice',40,126,424,size=10.7,leading=17,color=LIGHT,align=1)
        para('FIRST EDITION · 2026',40,68,424,size=8,leading=10,font='Sans',color='#d3c29f',align=1)
    elif kind=='contents':
        cv.bookmarkPage('contents');x,w,y=heading(title,'A navigable book · click a title or page number')
        for name,num in toc:
            cv.setFillColor(HexColor(INK));cv.setFont('Serif',11);cv.drawString(x,y-11,name);cv.setFont('Sans',10);cv.drawRightString(x+w,y-11,str(num))
            cv.linkRect('', 'page-'+str(num),(x,y-18,x+w,y+2),relative=0,thickness=0);rule(y-23,x,w);y-=28
    elif kind=='index':
        x,w,y=heading(title,'Image page / interpretation page · click any entry')
        groups=[(d['start'],d['end'])] if d['start']==0 else [(d['start'],d['start']+14),(d['start']+14,d['end'])]
        columnw=w if len(groups)==1 else (w-26)/2
        top=y
        for col,(start,stop) in enumerate(groups):
            bx=x+col*(columnw+26);y=top
            label(cards[start]['suit'] or 'Major Arcana',bx,y);y-=28
            for i in range(start,stop):
                c=cards[i];num=20+2*i
                cv.setFont('Serif',10.3);cv.setFillColor(HexColor(INK));cv.drawString(bx,y-10,c['name'])
                if len(groups)==1:
                    cv.setFont('Sans',9.5);cv.drawRightString(bx+columnw,y-10,f'{num} / {num+1}')
                else:
                    cv.setFont('Sans',8.5);cv.setFillColor(HexColor(GOLD));cv.drawString(bx,y-24,f'{num} / {num+1}')
                step=21 if len(groups)==1 else 35
                cv.linkRect('',c['id'],(bx,y-step+3,bx+columnw,y+2),relative=0,thickness=0);y-=step
        assert y>50
    elif kind in ('divider','closing'):
        x,w,y=heading(title,d.get('eyebrow','The Cat Priestess'),dark=True)
        cv.drawImage(image(d['image']),168,213,168,252)
        para(escape(d['text']).replace('\n','<br/>'),x,169,w,12,20,color=LIGHT,align=1)
    elif kind=='spread':
        x,w,y=heading(title,d['eyebrow']);y=para(d['intro'],x,y,w)
        # Exact vector layout. Labels in the diagram are position numbers only.
        positions=d['layout'];maxx=max(t[1] for t in positions);maxy=max(t[2] for t in positions)
        cardw,cardh=34,49;stepx,stepy=70,57
        center=x+w/2;top=y-9;totalw=maxx*stepx+cardw
        for n,cx,cy in positions:
            bx=center-totalw/2+cx*stepx;by=top-cardh-cy*stepy
            cv.setFillColor(HexColor('#efe9db'));cv.setStrokeColor(HexColor(GOLD));cv.roundRect(bx,by,cardw,cardh,3,fill=1,stroke=1)
            cv.setFillColor(HexColor(NAVY));cv.setFont('SerifB',13);cv.drawCentredString(bx+cardw/2,by+cardh/2-5,str(n))
        y=top-cardh-maxy*stepy-17
        for i,s in enumerate(d['positions']):y=para(f'<b>{i+1}.</b> '+s,x,y,w,10.4,14,gap=4)
        y-=8
        for h,s in d['sections']:
            if h:y=para(escape(h),x,y,w,12.1,16,font='SerifB',color=GOLD,gap=4)
            y=para(s,x,y,w,10.5,15,gap=10)
    elif kind=='journal':
        x,w,y=heading(title,d['eyebrow']);y=para('Copy these prompts into a notebook, or print this page for personal reflection. Leave room for uncertainty and for a later correction.',x,y,w)
        for prompt in d['prompts']:
            label(prompt,x,y-6,size=7.8);y-=24
            rule(y,x,w);rule(y-18,x,w);y-=44
    else:
        x,w,y=heading(title,d.get('eyebrow',''))
        for h,s in d['sections']:
            if h:y=para(escape(h),x,y,w,12.2,16.2,font='SerifB',color=GOLD,gap=5)
            y=para(s,x,y,w,gap=12)
    end()

def cardspread(c,i):
    page=cv.getPageNumber();assert page==20+i*2
    cv.bookmarkPage('page-'+str(page));cv.bookmarkPage(c['id'])
    if i in [0,22,36,50,64]:
        cv.addOutlineEntry(c['suit'] or 'Major Arcana', 'page-'+str(page),level=0,closed=False)
    cv.addOutlineEntry(c['name'],c['id'],level=1,closed=False)
    x,w=base();label((c['suit'] or 'Major Arcana')+' · '+c['rn'],x,648)
    para(escape(c['name']),x,630,w,size=25,leading=29,gap=0)
    cv.drawImage(image(c['image']),108,151,288,432)
    cv.setStrokeColor(HexColor(RULE));cv.setLineWidth(.5);cv.rect(104,147,296,440,fill=0,stroke=1)
    para(' · '.join(c['keywords']).upper(),x,132,w,8.2,12,font='SansB',color=GOLD,align=1)
    para('“'+escape(' '.join(c['aff']))+'”',x+6,110,w-12,11.6,17,font='SerifI',color=NAVY,align=1)
    end()
    cv.bookmarkPage('page-'+str(page+1));x,w,y=heading(c['name'],'Interpretation · '+(c['suit'] or 'Major Arcana'))
    for h,s in [('Within the image',c['symbolism']),('Upright',c['up']),('Reversed',c['rev']),('Reflection',c['question'])]:
        y=para(h,x,y,w,11.2,14.4,font='SerifB',color=GOLD,gap=3)
        y=para(escape(s),x,y,w,10.5,15,gap=10)
    rule(y+2,x,w);y-=13
    label('Companion practice · modern interpretation',x,y,size=7.7);y-=14
    g=guidance[c['id']]
    for h,s in [('Reading guidance',g['reading']),('Try this',g['action']),('Read in conversation with',g['pair'])]:
        y=para(h,x,y,w,11.2,14.4,font='SerifB',color=GOLD,gap=3)
        y=para(escape(s),x,y,w,10.5,15,gap=10)
    para('<link href="https://www.thecatpriestess.com/decks/gothic/'+c['id']+'" color="'+GOLD+'">Open this card on The Cat Priestess</link>',x,y-1,w,8.5,12,font='Sans',gap=0)
    end()

for d in chapters['front']:chapter(d)
for i,c in enumerate(cards):cardspread(c,i)
for d in chapters['back']:chapter(d)
assert cv.getPageNumber()==193
cv.save()
manifest=dict(title='Nocturne Cathedral Tarot: The Illustrated Companion',edition='2026-10-25',pages=192,width_inches=7,height_inches=10,source_commit='dd8de47',source_content_sha256=hashlib.sha256((ROOT/'decks/gothic/content.json').read_bytes()).hexdigest(),file='/'+str(output.relative_to(ROOT)),bytes=output.stat().st_size,sha256=hashlib.sha256(output.read_bytes()).hexdigest(),cards=[dict(id=c['id'],name=c['name'],image_page=20+i*2,meaning_page=21+i*2) for i,c in enumerate(cards)],images=evidence)
(ROOT/'decks/gothic/companion-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'tmp/pdfs').mkdir(parents=True,exist_ok=True)
(ROOT/'tmp/pdfs/layout-bounds.json').write_text(json.dumps(bounds))
print(json.dumps(dict(path=str(output),pages=192,megabytes=round(output.stat().st_size/1048576,2),images=len(images))))
