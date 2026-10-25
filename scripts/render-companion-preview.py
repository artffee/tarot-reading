#!/usr/bin/env python3
"""Render actual book pages for the static website. Does not modify source art."""
from pathlib import Path
import fitz
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
doc=fitz.open(ROOT/'decks/gothic/downloads/nocturne-cathedral-companion.pdf')
def render(n):
    pix=doc[n-1].get_pixmap(matrix=fitz.Matrix(4/3,4/3),alpha=False)
    return Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
render(1).save(ROOT/'decks/gothic/companion-cover.webp',quality=93)
a,b=render(20),render(21)
spread=Image.new('RGB',(a.width+b.width,a.height),'white')
spread.paste(a,(0,0));spread.paste(b,(a.width,0))
spread.save(ROOT/'decks/gothic/companion-spread.webp',quality=92)
print('Rendered cover and pages 20-21 for the companion website.')
