"""Independent PDF checks: exact artwork pixels, vector cut marks, and duplex registration."""
import hashlib
import io
import json
from html.parser import HTMLParser
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MM = 25.4 / 72
IDS = [f"{n:02d}" for n in range(5, 39)]
ART = {}
for card in [*IDS, "back"]:
    image = Image.open(ROOT / "cards" / f"{card}.webp").convert("RGB")
    ART[card] = (image.size, hashlib.sha256(image.tobytes()).hexdigest())


class Downloads(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href", "").startswith("/deck/downloads/"):
            assert "download" in attrs, "Download links must work without JavaScript"
            self.links.append(attrs["href"].split("/")[-1])


def close(actual, expected, tolerance=.15):
    assert abs(actual - expected) <= tolerance, (actual, expected)


def slots(sheet, side, flip):
    front = [IDS[(sheet - 1) * 6 + i] if (sheet - 1) * 6 + i < len(IDS) else "" for i in range(6)]
    if side == "front":
        return front
    return [front[i] for i in ([2, 1, 0, 5, 4, 3] if flip == "long" else [3, 4, 5, 0, 1, 2])]


report = []
for paper, width, height in [("letter", 215.9, 279.4), ("a4", 210, 297)]:
    for flip in ["long", "short"]:
        for calibration in [False, True]:
            name = f"cat-priestess-{paper}-{flip}-edge{'-calibration' if calibration else ''}.pdf"
            path = ROOT / "deck" / "downloads" / name
            doc = fitz.open(path)
            assert len(doc) == (2 if calibration else 12), name
            registration = {}
            fronts, backs = [], []
            embedded = {}
            for index, page in enumerate(doc):
                sheet, side = index // 2 + 1, "front" if index % 2 == 0 else "back"
                close(page.rect.width * MM, width, .25)
                close(page.rect.height * MM, height, .25)
                page_slots = slots(sheet, side, flip)
                populated = [(slot, card) for slot, card in enumerate(page_slots) if card]
                images = page.get_image_info(xrefs=True)
                assert len(images) == len(populated), (name, index, "artwork count")
                drawings = page.get_drawings()
                guides = [d for d in drawings if len(d["items"]) == 8 and all(item[0] == "l" for item in d["items"])]
                scales = [d for d in drawings if len(d["items"]) == 3 and all(item[0] == "l" for item in d["items"])]
                assert len(guides) == len(populated), (name, index, "cut guide count")
                assert len(scales) == 1, (name, index, "calibration line count")
                scale = scales[0]["items"][1]
                close(abs(scale[2].x - scale[1].x) * MM, 50)
                assert "SCREEN PREVIEW" not in page.get_text() and "Before you print" not in page.get_text()
                assert f"Sheet {sheet} of 6" in page.get_text() and side.upper() in page.get_text()
                for (slot, card), info, guide in zip(populated, images, guides):
                    reference = card if side == "front" else "back"
                    xref = info["xref"]
                    if xref not in embedded:
                        image = Image.open(io.BytesIO(doc.extract_image(xref)["image"])).convert("RGB")
                        embedded[xref] = (image.size, hashlib.sha256(image.tobytes()).hexdigest())
                    assert embedded[xref] == ART[reference], (name, index, card, "original decoded artwork pixels")
                    a, b, c, d, _, _ = info["transform"]
                    assert a > 0 and d > 0 and abs(b) < .001 and abs(c) < .001, "Artwork must stay upright and unmirrored"
                    left = (width - 188) / 2 + (slot % 3) * 64
                    top = (height - 184) / 2 + (slot // 3) * 94
                    right, bottom = left + 60, top + 90
                    expected_marks = [
                        ((left - 2, top), (left - .5, top)),
                        ((left, top - 2), (left, top - .5)),
                        ((right + .5, top), (right + 2, top)),
                        ((right, top - 2), (right, top - .5)),
                        ((left - 2, bottom), (left - .5, bottom)),
                        ((left, bottom + .5), (left, bottom + 2)),
                        ((right + .5, bottom), (right + 2, bottom)),
                        ((right, bottom + .5), (right, bottom + 2)),
                    ]
                    close(guide["width"] * MM, .18, .01)
                    for item, target in zip(guide["items"], expected_marks):
                        for point, position in zip(item[1:], target):
                            close(point.x * MM, position[0])
                            close(point.y * MM, position[1])
                            assert min(point.x * MM, width - point.x * MM, point.y * MM, height - point.y * MM) >= 8.9
                    cut = (guide["items"][1][1].x * MM, guide["items"][0][1].y * MM,
                           guide["items"][3][1].x * MM, guide["items"][4][1].y * MM)
                    close(cut[2] - cut[0], 60)
                    close(cut[3] - cut[1], 90)
                    art_box = tuple(n * MM for n in info["bbox"])
                    assert min(art_box[0] - cut[0], art_box[1] - cut[1], cut[2] - art_box[2], cut[3] - art_box[3]) >= 1.9, "Nominal 2 mm safe border (PDF rounding tolerance 0.1 mm)"
                    registration[(sheet, side, card)] = cut
                    (fronts if side == "front" else backs).append(card)
            expected_cards = IDS[:6] if calibration else IDS
            assert fronts == expected_cards and sorted(backs) == expected_cards, (name, "complete matching front/back set")
            for (sheet, side, card), cut in registration.items():
                if side != "front":
                    continue
                reflected = ((width - cut[2], cut[1], width - cut[0], cut[3]) if flip == "long"
                             else (cut[0], height - cut[3], cut[2], height - cut[1]))
                for actual, target in zip(registration[(sheet, "back", card)], reflected):
                    close(actual, target)
            report.append({"file": name, "pages": len(doc), "fronts": len(fronts), "backs": len(backs),
                           "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
            doc.close()

links = Downloads()
links.feed((ROOT / "deck" / "print.html").read_text())
assert sorted(links.links) == sorted(item["file"] for item in report), "Every released PDF must have a working direct link"
(ROOT / "tests" / "output" / "downloads-verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(f"PASS: {len(report)} downloadable PDFs, 56 pages, 320 exact original artwork placements; 60 x 90 mm vector cut guides; 50 mm lines; front/back registration for both edges; safe borders; direct download links.")
