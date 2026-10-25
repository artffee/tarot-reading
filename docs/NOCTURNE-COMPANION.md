# Nocturne Cathedral illustrated companion

The complete first edition contains 192 pages, including two pages for each of
the 78 cards. It reuses all original Gothic fronts and the shared back from
source commit `dd8de4736f909acda605c91a83db6908ef582e14`.

- Page: `/decks/gothic/companion`
- PDF: `/decks/gothic/downloads/nocturne-cathedral-companion.pdf`
- Metadata and checksum: `/decks/gothic/companion-manifest.json`

The gallery has a book feature and direct PDF download. The collections and
Gothic print pages link to the companion. Existing reader code, both editorial
datasets, all original illustrations and all 17 pre-existing PDFs remain
byte-for-byte unchanged. The service worker version changes but retains the
existing exclusion for PDFs/downloads.

## Editorial source and scope

`decks/gothic/content.json` remains the authoritative card text. The book copies
names, numbers, keywords, symbolism, upright/reversed meanings, affirmations and
reflection questions directly. Do not substitute the new companion guidance
for those established meanings.

New essays and exercises are in `companion/chapters.json`. Individual practical
guidance is in `companion/guidance.tsv`, keyed by card ID. Historical sources are
cited in the book, with links and an access date. Modern reading frameworks,
the five original spreads and the three creative rituals are identified as
interpretation or invention, not recovered historical traditions. Existing
AI-assisted artwork is credited accurately.

## Rebuild

Use Python 3 and the pinned packages in `companion/requirements.txt`. The exact
Noto Serif and Liberation Sans font files are in `companion/fonts`, with their
SIL Open Font Licenses. They are embedded in the PDF. `NOCTURNE_FONT_DIR` or
`--font-dir` can override the source directory for a future edition.

```sh
python3 -m pip install -r companion/requirements.txt
python3 scripts/build-nocturne-companion.py
python3 scripts/build-companion-page.py
python3 scripts/build-gothic.py --ready
python3 scripts/render-companion-preview.py
python3 tests/verify-companion.py
npm ci --prefix tests
npm run --prefix tests test:decks
python3 tests/verify-gothic-downloads.py
python3 tests/verify-downloads.py
```

The companion verifier checks page dimensions, all original card text, exact
source hashes, all 78 mapped illustration streams at their original pixel
dimensions, 79 unique embedded images including the back, embedded fonts,
internal/external link structures, card bookmarks and local website targets.
The existing download checks still require every prior printable PDF; the
gallery additionally requires the companion download.

The book is a 7 × 10 inch RGB digital and print-preparation edition. Its 4 × 6
inch illustration display yields 224 ppi from the 896 × 1344 pixel originals.
Full composition and pixel dimensions are retained with JPEG quality 90 and
no chroma subsampling in the download edition. Original WebP files are untouched.
It is not a PDF/X production file. Commercial printing still needs the chosen
printer's color profile, binding/cover specifications and a physical proof.

## Release verification

All 192 pages were rasterized and inspected in contact sheets. Index and journal
spacing corrections were checked in full-size Poppler renders. Representative
card text and original artwork were inspected at reading size. The website
preview was checked in the cloud browser; see release notes for live download
and publication results. Physical printing is outside digital verification.

The branch-scoped publication workflow rebuilds the PDF with pinned tools and
requires every hash in `tests/companion-release-hashes.json` to match the reviewed
release. It commits only the verified companion PDF. The artwork streams use
binary PDF encoding to remove ASCII85 overhead without changing image quality;
all 192 pages were checked pixel-for-pixel against the reviewed render.
