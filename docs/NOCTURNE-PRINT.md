# Nocturne Cathedral printable edition

The separate `/decks/gothic/print` workspace and printable section on
`/decks/gothic#printable-deck` publish the existing 78-card collection. No image
generation is involved. All 79 source WebPs (78 fronts and the reversible back)
retain the hashes in `docs/gothic-artwork.json`. The eight original oracle PDFs
in `deck/downloads/` retain the hashes in `tests/original-assets.json`.

## Files and physical layout

`decks/gothic/downloads/` contains four complete 26-page PDFs, four two-page
calibration PDFs, a one-page printing guide, and a manifest of file hashes,
source/embedded image hashes, dimensions, and every card placement. Complete
editions cover Letter and A4, each with long-edge and short-edge duplex options.
Complete files are about 85.5 MB each; calibration files are about 7.7 MB.

| Property | Value |
| --- | --- |
| Cut size | 60 x 90 mm |
| Artwork size | 56 x 84 mm, uncropped, same aspect ratio |
| Safe white border | 2 mm left/right; 3 mm top/bottom |
| Gutter | 4 mm |
| Layout | 3 columns x 2 rows, centered on the paper |
| Grid | 188 x 184 mm |
| Letter | 215.9 x 279.4 mm |
| A4 | 210 x 297 mm |
| Smallest cut-guide paper margin | 9 mm (A4 left/right) |
| Scale ruler | 50 mm, vector |
| Total | 78 cards, 13 physical sheets, 26 alternating front/back pages |

Long-edge backs reverse columns (`2,1,0,5,4,3`); short-edge backs reverse rows
(`3,4,5,0,1,2`). Slot indexes start at zero in the front's upper-left corner.
Art is never mirrored. The common back is visually reversible, so no 180-degree
artwork rotation is needed. Calibration A/B/C/D targets are deliberately
asymmetric, and are reflected using the same edge transform.

Every full PDF begins with front sheet 1, then back sheet 1, through sheet 13.
The calibration file is a separate, two-page document using the actual first
six fronts and six matching backs at the same coordinates, plus A/B/C/D targets.
The guide is separate and cannot accidentally enter the duplex sequence.

## Artwork preservation and PDF encoding

Source WebPs are reused as-is in the website's live print workspace. Download
PDFs embed the same original-resolution 896 x 1344 illustrations as high-quality
JPEG, quality 98, 4:4:4 (no chroma subsampling), without cropping, retouching,
resizing, redrawing, or regenerating the images. At 56 mm width this is about
406 pixels per inch. JPEG is a lossy export encoding; the downloadable PDFs are
not claimed to be pixel-identical lossless archives. Unmodified source WebPs
remain available in Git and via the existing artwork URLs.

An ordinary lossless RGB export of the full collection is about 225 MB before
additional PDF overhead. The chosen encoding keeps each complete PDF below
GitHub's standard 100 MiB per-file limit. Independent checks verify each embedded
JPEG stream hash, resolution, order and image transform, and require PSNR above
40 dB against its unchanged source. No additional production dependency exists.

## Regeneration and verification

Python dependencies used: Pillow 12.3.0, ReportLab 4.4.9, PyMuPDF 1.26.6 and
pypdf 6.10.0. Node dependencies are pinned in `tests/package-lock.json`.

```bash
npm ci --prefix tests
python3 scripts/build-gothic-print.py
python3 scripts/build-gothic.py --ready
python3 scripts/render-gothic-print-preview.py
python3 tests/verify-gothic-downloads.py
npm run --prefix tests test:decks
npx --prefix tests playwright install chromium
npm run --prefix tests test:gothic-print
npm test --prefix tests
```

`CHROMIUM_PATH` can point at an existing Chromium binary. Tests use a real local
browser, without sending emails or invoking production APIs. The Gothic suite
checks all paper/flip/side/test combinations, reverse manual order, decoded
images, exact source URLs, CSS geometry, print-media page breaks, previews,
missing-art protection, the legacy 34-card default, responsive widths, static
download links with JavaScript disabled, and complete file downloads under
Android touch/user-agent emulation. It hashes all nine downloaded files.

Independent PDF inspection verifies 113 published pages, 672 artwork
placements, each of the 78 front identities exactly once per full deck, matching
backs, exact page size, 60 x 90 mm cutting guides, minimum safe borders, 50 mm
rulers, both front/back reflection transforms, calibration target coordinates,
PDF integrity, viewer preferences and original-file preservation. The published
PDFs are checked independently from browser print exports.

The shared `deck/print.js` now accepts `window.PrintDeck` configuration. Without
that configuration it keeps the original oracle as the default. Its historic
source hash remains in the original fixture for reference, but that one source
file is intentionally excluded from the blanket source-preservation assertion;
the original real-browser print suite verifies its behavior instead. No original
oracle PDF or other protected original source was changed.

PDF requests bypass service-worker app-shell caching/fallbacks, so an offline
download cannot accidentally receive homepage HTML instead of a PDF. New print
files are direct, same-origin links and do not require JavaScript.

## Home printing and limits of verification

Use portrait, actual size / 100%, one page per sheet; disable fit/shrink,
borderless expansion, browser headers and footers. Match paper and duplex edge
to the filename. PDF `/PrintScaling /None` and `/Duplex` preferences are helpful
hints; printer drivers may override them. Manual printing uses fronts only,
then backs only with sheet numbers and a configurable back-pass order.

**Software-verified alignment is mathematical page registration. It does not
calibrate a physical printer.** Print the matching calibration PDF on one plain
sheet, measure the 50 mm line and 60 x 90 mm card, and hold the sheet to the light
to compare A/B/C/D targets and cutting guides. Refeed direction, registration
offsets, feed skew, and paper/stock handling require that real printed test.
Printer settings apply to both sides; do not resize one side to hide an offset.
These are home-print PDFs with a white safe border, not commercial bleed files.

Browser verification uses Chromium and Android emulation, not a physical phone
or native iOS PDF/print workflow. Rendered PDF and desktop/mobile previews are
reviewed separately from the automated geometry checks.

After Git-linked deployment, `python3 tests/verify-production.py` checks served
content hashes for the new routes, all original and new artwork, original PDFs,
and nine new downloads. `node tests/verify-gothic-live.cjs` checks the production
gallery/workspace and Android-emulated download URLs in Chromium.
