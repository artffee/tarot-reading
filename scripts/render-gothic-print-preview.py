#!/usr/bin/env python3
"""Render the published PDF and existing back as a small gallery preview."""
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
with fitz.open(ROOT/'decks/gothic/downloads/nocturne-cathedral-letter-long-edge.pdf') as pdf:
    page=pdf[0].get_pixmap(matrix=fitz.Matrix(1,1),alpha=False)
    sheet=Image.frombytes('RGB',[page.width,page.height],page.samples)
sheet.thumbnail((530,700),Image.Resampling.LANCZOS)
preview=Image.new('RGB',(1000,780),'#171b28')
ImageDraw.Draw(preview).rectangle((41,33,45+sheet.width,37+sheet.height),fill='#090b13')
preview.paste(sheet,(35,28))
with Image.open(ROOT/'cards/gothic/back.webp') as source:
    back=source.convert('RGB')
back.thumbnail((280,420),Image.Resampling.LANCZOS)
preview.paste(back,(645,155))
preview.save(ROOT/'decks/gothic/print-preview.webp',quality=93,method=6)
print('Rendered the published front sheet and original back for the gallery.')
